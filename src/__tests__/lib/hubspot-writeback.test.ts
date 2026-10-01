/**
 * HubSpot writeback — property mapping + targets + idempotency.
 *
 * Production regression (portal 148499892): restaurants arrive in HubSpot
 * as Companies, but writeback only targeted contacts/deals, so a
 * company-only lead was SKIPPED (`no_crm_linkage`) and nothing was
 * written. These tests pin the fixed behaviour:
 *   - company-linked leads get all `revint_*` properties on the Company
 *   - the head-agent brief shape (wedge / talkTrack / recommendedPackage)
 *     and the legacy shape (primaryAngle) both map defensively
 *   - a brief-run-keyed writeback happens at most once per run
 *   - HubSpot failures are recorded FAILED on CrmSyncLog, never thrown
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getHubspotClient: vi.fn(),
  client: {
    updateContact: vi.fn(),
    updateCompany: vi.fn(),
    updateDeal: vi.fn(),
    createCall: vi.fn(),
    getAssociations: vi.fn(),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/integrations/hubspot/client", () => {
  class HubspotNotConnectedError extends Error {}
  return {
    getHubspotClient: mocks.getHubspotClient,
    HubspotNotConnectedError,
  };
});
vi.mock("@/lib/playbook/resolve", () => ({
  getPlaybook: vi.fn(async () => ({ stages: [], angles: [] })),
}));
vi.mock("@/lib/playbook/angle", () => ({
  pickAngle: vi.fn(() => ({ angle: { label: "Deterministic Angle" }, matchedTriggers: ["no_booking"] })),
  absenceSignalsFromAudit: vi.fn(() => ({})),
  hasSlowServiceSignal: vi.fn(() => false),
}));

import {
  buildRevintProperties,
  enqueueCrmWriteback,
} from "@/lib/integrations/hubspot/writeback";
import { REVINT_PROPERTY_NAMES } from "@/lib/integrations/hubspot/properties";

const WS = "ws_1";
const LEAD = "lead_1";

function baseLead(over: Record<string, unknown> = {}) {
  return {
    id: LEAD,
    workspaceId: WS,
    businessName: "Dishoom Shoreditch",
    hasWebsite: true,
    rating: 4.6,
    reviewCount: 900,
    priceLevel: 2,
    accountId: null,
    salesConfidence: 78,
    leadTemperature: "HOT",
    subNicheSlug: "fnb-casual-dining",
    playbookStageKey: null,
    crmContactId: null,
    crmCompanyId: "company_9",
    crmDealId: null,
    qualification: null,
    websiteAudit: null,
    reviewAnalysis: null,
    ...over,
  };
}

// Shape per the [B] contract (scratchpad/contracts.md).
const HEAD_AGENT_OUTPUT = {
  briefMode: "head-agent",
  salesConfidence: 81,
  missingSources: [],
  headAgent: {
    packId: "fnb",
    recommendedPackage: "growth",
    wedge: "bill_wait",
    primaryAngle: "Hesap bekleme → Growth",
    talkTrack: "Open with the 40-minute Friday wait reviews, then pitch Order & Pay.",
    confidence: 81,
    evidenceRefs: ['yorum: "waited 40 minutes for the bill"', "https://x — no online ordering"],
    sourceConflicts: [],
  },
};

function makePrisma(opts: {
  lead?: Record<string, unknown> | null;
  briefOutput?: unknown;
  salesOpportunity?: Record<string, unknown> | null;
  priorLog?: { status: string } | null;
  runningBrief?: boolean;
  higherRanked?: number;
} = {}) {
  const lead = opts.lead === undefined ? baseLead() : opts.lead;
  const prisma = {
    lead: {
      findFirst: vi.fn(async (args: { where: Record<string, unknown> }) => {
        // Company-ownership lookup (another lead already owns the company).
        if (args.where.crmCompanyId) return null;
        return lead;
      }),
      count: vi.fn(async () => opts.higherRanked ?? 4),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    leadNextAction: {
      findFirst: vi.fn(async () => null),
    },
    agentRun: {
      findFirst: vi.fn(async (args: { where: Record<string, unknown> }) => {
        if (args.where.status === "RUNNING") {
          return opts.runningBrief ? { id: "run_running" } : null;
        }
        return opts.briefOutput === undefined ? null : { id: "run_brief", outputJson: opts.briefOutput };
      }),
    },
    salesOpportunity: {
      findFirst: vi.fn(async () => opts.salesOpportunity ?? null),
    },
    crmConnection: {
      findUnique: vi.fn(async () => ({ fieldMappingJson: {}, defaultPipelineId: null })),
    },
    crmSyncLog: {
      findUnique: vi.fn(async () => opts.priorLog ?? null),
      upsert: vi.fn(async () => ({ id: "log_1" })),
      update: vi.fn(async () => ({})),
    },
    $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
  };
  return prisma;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getHubspotClient.mockResolvedValue(mocks.client);
  mocks.client.updateContact.mockResolvedValue({ id: "contact_1", properties: {} });
  mocks.client.updateCompany.mockResolvedValue({ id: "company_9", properties: {} });
  mocks.client.getAssociations.mockResolvedValue({ results: [] });
  process.env.NEXT_PUBLIC_APP_URL = "https://app.revint.dev";
});

describe("buildRevintProperties", () => {
  it("maps the head-agent brief onto the revint_* properties", async () => {
    const prisma = makePrisma({ briefOutput: HEAD_AGENT_OUTPUT });
    const built = await buildRevintProperties(prisma as never, WS, LEAD, { briefRunId: "run_brief" });
    const p = built!.properties;

    expect(p.revint_sales_confidence).toBe("78");
    expect(p.revint_lead_temperature).toBe("HOT");
    expect(p.revint_today_priority).toBe("5"); // 4 leads rank higher
    expect(p.revint_recommended_angle).toBe("Hesap bekleme → Growth");
    expect(p.revint_next_best_action).toContain("40-minute Friday wait");
    expect(p.revint_qualification_status).toBe("not_started");
    expect(p.revint_detected_sub_niche).toBe("fnb-casual-dining");
    expect(p.revint_evidence_summary).toContain("81%");
    expect(p.revint_evidence_summary).toContain("Package: Growth");
    expect(p.revint_evidence_summary).toContain("Wedge: Bill wait / Order & Pay");
    expect(p.revint_evidence_summary).toContain("waited 40 minutes for the bill");
    expect(p.revint_source_conflicts).toBeDefined();
    expect(p.revint_action_sheet_url).toBe("https://app.revint.dev/app/leads/lead_1");
    // Only canonical names are ever written.
    for (const k of Object.keys(p)) expect(REVINT_PROPERTY_NAMES).toContain(k);

    // Reads the SPECIFIC run that just finished, scoped to the workspace.
    expect(prisma.agentRun.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "run_brief", workspaceId: WS, leadId: LEAD }),
      }),
    );
  });

  it("falls back to the legacy headAgent.primaryAngle shape", async () => {
    const prisma = makePrisma({
      briefOutput: { headAgent: { primaryAngle: "QR Menu", confidence: 60, evidenceRefs: ["x"] } },
    });
    const built = await buildRevintProperties(prisma as never, WS, LEAD);
    expect(built!.properties.revint_recommended_angle).toBe("QR Menu");
  });

  it("labels a wedge id with its package when primaryAngle is absent", async () => {
    const { primaryAngle: _drop, ...noAngle } = HEAD_AGENT_OUTPUT.headAgent;
    void _drop;
    const prisma = makePrisma({ briefOutput: { ...HEAD_AGENT_OUTPUT, headAgent: noAngle } });
    const built = await buildRevintProperties(prisma as never, WS, LEAD);
    expect(built!.properties.revint_recommended_angle).toBe("Bill wait / Order & Pay — Package: Growth");
  });

  it("falls back to the SalesOpportunity projection, then the playbook angle", async () => {
    const withOpp = makePrisma({
      briefOutput: { skipped: "head_agent_off" },
      salesOpportunity: { bestSalesAngle: "reservation", recommendedPackageReason: "Premium · Rezervasyon" },
    });
    const a = await buildRevintProperties(withOpp as never, WS, LEAD);
    expect(a!.properties.revint_recommended_angle).toBe("Premium · Rezervasyon");

    const wedgeOnly = makePrisma({
      briefOutput: null,
      salesOpportunity: { bestSalesAngle: "reservation", recommendedPackageReason: null },
    });
    const w = await buildRevintProperties(wedgeOnly as never, WS, LEAD);
    expect(w!.properties.revint_recommended_angle).toBe("Reservations");

    const bare = makePrisma({ briefOutput: null });
    const b = await buildRevintProperties(bare as never, WS, LEAD);
    expect(b!.properties.revint_recommended_angle).toBe("Deterministic Angle");
  });

  it("passes a 'no call' plain card through and does not advertise a package", async () => {
    const prisma = makePrisma({
      briefOutput: {
        ...HEAD_AGENT_OUTPUT,
        headAgent: {
          ...HEAD_AGENT_OUTPUT.headAgent,
          recommendedPackage: "none",
          wedge: "none",
          primaryAngle: "Arama yok",
          talkTrack: "",
        },
      },
    });
    const built = await buildRevintProperties(prisma as never, WS, LEAD);
    expect(built!.properties.revint_recommended_angle).toBe("Arama yok");
    expect(built!.properties.revint_evidence_summary).not.toContain("Package");
    expect(built!.properties.revint_next_best_action).toBeUndefined();
  });

  it("scopes the SalesOpportunity read through the lead's workspace", async () => {
    const prisma = makePrisma({ briefOutput: null });
    await buildRevintProperties(prisma as never, WS, LEAD);
    expect(prisma.salesOpportunity.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { leadId: LEAD, lead: { workspaceId: WS } } }),
    );
  });
});

describe("enqueueCrmWriteback", () => {
  it("writes all properties to the Company for a company-only lead", async () => {
    const prisma = makePrisma({ briefOutput: HEAD_AGENT_OUTPUT });
    const res = await enqueueCrmWriteback(prisma as never, {
      workspaceId: WS,
      leadId: LEAD,
      reason: "analysis",
      briefRunId: "run_brief",
    });
    expect(res.status).toBe("SUCCESS");
    expect(mocks.client.updateCompany).toHaveBeenCalledWith(
      "company_9",
      expect.objectContaining({ revint_sales_confidence: "78", revint_lead_temperature: "HOT" }),
    );
    expect(mocks.client.updateContact).not.toHaveBeenCalled();
    expect(prisma.crmSyncLog.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "SUCCESS" }) }),
    );
    // Lead bookkeeping stays workspace-scoped.
    expect(prisma.lead.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: LEAD, workspaceId: WS } }),
    );
  });

  it("writes to both the contact and the company when both are linked", async () => {
    const prisma = makePrisma({
      briefOutput: HEAD_AGENT_OUTPUT,
      lead: baseLead({ crmContactId: "contact_1" }),
    });
    const res = await enqueueCrmWriteback(prisma as never, { workspaceId: WS, leadId: LEAD, reason: "analysis" });
    expect(res.status).toBe("SUCCESS");
    expect(mocks.client.updateContact).toHaveBeenCalledTimes(1);
    expect(mocks.client.updateCompany).toHaveBeenCalledTimes(1);
  });

  it("resolves the contact's primary associated company when the lead has no company id", async () => {
    mocks.client.getAssociations.mockResolvedValue({
      results: [{ toObjectId: 555, associationTypes: [{ label: "Primary", typeId: 1 }] }],
    });
    const prisma = makePrisma({
      briefOutput: null,
      lead: baseLead({ crmContactId: "contact_1", crmCompanyId: null }),
    });
    await enqueueCrmWriteback(prisma as never, { workspaceId: WS, leadId: LEAD, reason: "analysis" });
    expect(mocks.client.updateCompany).toHaveBeenCalledWith("555", expect.any(Object));
  });

  it("skips leads with no HubSpot linkage at all", async () => {
    const prisma = makePrisma({ lead: baseLead({ crmCompanyId: null }) });
    const res = await enqueueCrmWriteback(prisma as never, { workspaceId: WS, leadId: LEAD, reason: "analysis" });
    expect(res).toEqual(expect.objectContaining({ status: "SKIPPED", reason: "no_crm_linkage" }));
    expect(mocks.getHubspotClient).not.toHaveBeenCalled();
  });

  it("is idempotent per brief run: a prior SUCCESS for the run is a no-op", async () => {
    const prisma = makePrisma({ briefOutput: HEAD_AGENT_OUTPUT, priorLog: { status: "SUCCESS" } });
    const res = await enqueueCrmWriteback(prisma as never, {
      workspaceId: WS,
      leadId: LEAD,
      reason: "analysis",
      briefRunId: "run_brief",
    });
    expect(res).toEqual(expect.objectContaining({ status: "SKIPPED", reason: "duplicate" }));
    expect(mocks.client.updateCompany).not.toHaveBeenCalled();
  });

  it("keys the brief-run log on the run id, not the payload", async () => {
    const a = makePrisma({ briefOutput: HEAD_AGENT_OUTPUT });
    await enqueueCrmWriteback(a as never, { workspaceId: WS, leadId: LEAD, reason: "analysis", briefRunId: "run_A" });
    const b = makePrisma({ briefOutput: HEAD_AGENT_OUTPUT, lead: baseLead({ salesConfidence: 12 }) });
    await enqueueCrmWriteback(b as never, { workspaceId: WS, leadId: LEAD, reason: "analysis", briefRunId: "run_A" });
    const hashA = (a.crmSyncLog.findUnique.mock.calls[0][0] as { where: { workspaceId_direction_payloadHash: { payloadHash: string } } }).where.workspaceId_direction_payloadHash.payloadHash;
    const hashB = (b.crmSyncLog.findUnique.mock.calls[0][0] as { where: { workspaceId_direction_payloadHash: { payloadHash: string } } }).where.workspaceId_direction_payloadHash.payloadHash;
    expect(hashA).toBe(hashB);
  });

  it("records HubSpot failures as FAILED with the error, without throwing", async () => {
    const err = Object.assign(new Error('HubSpot PATCH → 400: {"category":"VALIDATION_ERROR","message":"Property \\"revint_sales_confidence\\" does not exist"}'), { status: 400 });
    mocks.client.updateCompany.mockRejectedValue(err);
    const prisma = makePrisma({ briefOutput: HEAD_AGENT_OUTPUT });
    const res = await enqueueCrmWriteback(prisma as never, { workspaceId: WS, leadId: LEAD, reason: "analysis", briefRunId: "r" });
    expect(res.status).toBe("FAILED");
    expect(prisma.crmSyncLog.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          lastError: expect.stringContaining("company:company_9"),
        }),
      }),
    );
  });

  it("defers an in-run analysis writeback to the post-run hook while the brief is RUNNING", async () => {
    const prisma = makePrisma({ briefOutput: HEAD_AGENT_OUTPUT, runningBrief: true });
    const res = await enqueueCrmWriteback(prisma as never, { workspaceId: WS, leadId: LEAD, reason: "analysis" });
    expect(res).toEqual(expect.objectContaining({ status: "SKIPPED", reason: "deferred_to_brief_completion" }));
    expect(mocks.getHubspotClient).not.toHaveBeenCalled();
    expect(prisma.crmSyncLog.upsert).not.toHaveBeenCalled();
  });
});
