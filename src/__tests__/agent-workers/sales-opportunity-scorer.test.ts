/**
 * Unit tests for SALES_OPPORTUNITY_SCORER worker.
 *
 * Covers:
 *   - Happy path: deterministic + Gemini analysis blend into final
 *     score (clamped to 100). Persisted via salesOpportunity.upsert.
 *     reasonCodes is a string[] merged from both sources (dedup'd).
 *   - Out-of-range Gemini score: the worker clamps at 100 via
 *     Math.min(100, ...). Zero floor is not explicitly enforced in
 *     code; we assert what the worker actually does.
 *   - Missing websiteAudit: worker still runs (scoring accepts a null
 *     features argument); final output still produced.
 *   - Gemini failure: worker gracefully falls back to the deterministic
 *     analysis (try/catch around analyzeLeadWithGemini).
 *
 * Divergences from spec:
 *   - The worker fetches the lead + websiteAudit via
 *     `prisma.lead.findUniqueOrThrow({ include: { websiteAudit: true }})`
 *     rather than using ctx.lead.websiteAudit; tests mock findUniqueOrThrow.
 *   - Final score clamps at 100 (upper bound) but the blended formula
 *     can never go below 0 for reasonable inputs, so the spec's
 *     "clamps to 0-100 or rejects" is asserted as "clamps at 100".
 *   - reasonCodes shape is string[] (not object[]).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentWorkerContext } from "@/lib/agent-workers/types";

const { analyzeLeadWithGeminiMock } = vi.hoisted(() => ({
  analyzeLeadWithGeminiMock: vi.fn(),
}));

vi.mock("@/lib/gemini", () => ({
  analyzeLeadWithGemini: analyzeLeadWithGeminiMock,
}));

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    lead: {
      update: vi.fn().mockResolvedValue({}),
      findUniqueOrThrow: vi.fn(),
    },
    salesOpportunity: {
      upsert: vi.fn().mockResolvedValue({}),
    },
    // P0.5 — scorer now also pre-loads service packages, workspace
    // settings (target_sub_niches), and active sales sequences so
    // the prompt and the deterministic ICP-fit adjustment have
    // workspace-level context. Default mocks return empty / null so
    // the legacy tests stay neutral on personalization.
    servicePackage: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    workspace: {
      findUnique: vi.fn().mockResolvedValue({ targetSubNiches: [] }),
    },
    sequence: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { run } from "@/lib/agent-workers/sales-opportunity-scorer";

function makeLeadRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "lead_1",
    workspaceId: "ws_1",
    businessName: "Acme HVAC",
    formattedAddress: "1 Main St",
    borough: "Brooklyn",
    phone: null,
    websiteUrl: "https://acme.example",
    hasWebsite: true,
    googleMapsUri: null,
    rating: 4.4,
    reviewCount: 85,
    businessStatus: "OPERATIONAL",
    primaryType: "hvac_contractor",
    sourceQuery: null,
    sourceLat: null,
    sourceLng: null,
    placeId: "p1",
    crawlStatus: "CRAWLED",
    analyzeStatus: "PENDING",
    reviewAnalysisStatus: "PENDING",
    createdAt: new Date(),
    updatedAt: new Date(),
    websiteAudit: {
      leadId: "lead_1",
      rawFeaturesJson: {
        url: "https://acme.example",
        reachable: true,
        https: true,
        mobileFriendlyGuess: true,
        hasContactForm: true,
        hasBookingSystem: false,
        servicesDetected: ["repair"],
      },
    },
    ...overrides,
  };
}

function makeCtx(overrides: Partial<AgentWorkerContext> = {}): AgentWorkerContext {
  return {
    runId: "run_1",
    workspaceId: "ws_1",
    workspacePlan: "PRO",
    leadId: "lead_1",
    userId: "user_1",
    lead: { id: "lead_1" } as never,
    workspace: {
      id: "ws_1",
      name: "Test",
      slug: "test",
      plan: "PRO",
      language: "en",
      tone: null,
      offerName: null,
      valueProposition: null,
      offerHook: null,
      objective: null,
      senderName: null,
      conversionLink: null,
      socialProof: null,
      branding: null,
      niche: "WEB_AGENCY",
    },
    memory: [],
    plannerSessionId: null,
    emit: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function geminiOutput(overrides: Record<string, unknown> = {}) {
  return {
    opportunity_score: 70,
    reason_codes: ["weak_seo"],
    why_good_target: "Solid reviews, weak site",
    likely_pain_points: ["slow site"],
    best_sales_angle: "Modernize frontend",
    suggested_offer: "growth" as const,
    personalized_first_message: "Hi Acme...",
    expected_price_band: "£800-1500",
    ...overrides,
  };
}

beforeEach(() => {
  analyzeLeadWithGeminiMock.mockReset();
  prismaMock.lead.update.mockReset().mockResolvedValue({});
  prismaMock.lead.findUniqueOrThrow.mockReset();
  prismaMock.salesOpportunity.upsert.mockReset().mockResolvedValue({});
  prismaMock.servicePackage.findMany.mockReset().mockResolvedValue([]);
  prismaMock.workspace.findUnique.mockReset().mockResolvedValue({ targetSubNiches: [] });
  prismaMock.sequence.findMany.mockReset().mockResolvedValue([]);
});

describe("SALES_OPPORTUNITY_SCORER - happy path", () => {
  it("blends deterministic + Gemini into final score (0-100) and upserts SalesOpportunity", async () => {
    prismaMock.lead.findUniqueOrThrow.mockResolvedValue(makeLeadRow());
    analyzeLeadWithGeminiMock.mockResolvedValue(geminiOutput({ opportunity_score: 70 }));

    const result = await run(makeCtx());

    expect(prismaMock.salesOpportunity.upsert).toHaveBeenCalledTimes(1);
    const upsertArgs = prismaMock.salesOpportunity.upsert.mock.calls[0][0];
    expect(upsertArgs.where).toEqual({ leadId: "lead_1" });

    const score = upsertArgs.create.opportunityScore as number;
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
    expect(Number.isInteger(score)).toBe(true);

    const out = result.output as { opportunityScore: number; reasonCodes: string[] };
    expect(out.opportunityScore).toBe(score);
  });

  it("reasonCodes: array of strings, deduplicated across deterministic + Gemini sources", async () => {
    prismaMock.lead.findUniqueOrThrow.mockResolvedValue(makeLeadRow());
    analyzeLeadWithGeminiMock.mockResolvedValue(
      // "no_booking" may show up in both deterministic reasons and Gemini
      // reason_codes; merge should dedup.
      geminiOutput({ reason_codes: ["no_booking", "weak_seo"] }),
    );

    const result = await run(makeCtx());
    const out = result.output as { reasonCodes: string[] };
    expect(Array.isArray(out.reasonCodes)).toBe(true);
    for (const r of out.reasonCodes) expect(typeof r).toBe("string");
    expect(new Set(out.reasonCodes).size).toBe(out.reasonCodes.length);
  });

  it("persists personalizedFirstMessage from Gemini", async () => {
    prismaMock.lead.findUniqueOrThrow.mockResolvedValue(makeLeadRow());
    analyzeLeadWithGeminiMock.mockResolvedValue(
      geminiOutput({ personalized_first_message: "Hey there - saw your reviews..." }),
    );

    await run(makeCtx());
    const upsertArgs = prismaMock.salesOpportunity.upsert.mock.calls[0][0];
    expect(upsertArgs.create.personalizedFirstMessage).toBe("Hey there - saw your reviews...");
  });
});

describe("SALES_OPPORTUNITY_SCORER - out-of-range Gemini score", () => {
  it("clamps final score to 100 when Gemini returns 250 (worker uses Math.min(100, ...))", async () => {
    prismaMock.lead.findUniqueOrThrow.mockResolvedValue(makeLeadRow());
    analyzeLeadWithGeminiMock.mockResolvedValue(geminiOutput({ opportunity_score: 250 }));

    const result = await run(makeCtx());
    const out = result.output as { opportunityScore: number };
    expect(out.opportunityScore).toBe(100);
  });

  it("clamps a wildly negative Gemini score to 0 (P0.5 added Math.max(0, ...) to support the ICP-fit penalty path safely)", async () => {
    // Older versions of the worker had only an upper-bound clamp.
    // P0.5 added the deterministic ICP-fit penalty (-8) and with it
    // a symmetric Math.max(0, ...) floor so a negative Gemini score
    // (or a -8 penalty pushing a near-0 lead into negative territory)
    // can never produce a sub-zero opportunityScore.
    prismaMock.lead.findUniqueOrThrow.mockResolvedValue(
      makeLeadRow({ hasWebsite: true, rating: 5, reviewCount: 500, websiteAudit: null }),
    );
    analyzeLeadWithGeminiMock.mockResolvedValue(geminiOutput({ opportunity_score: -1000 }));

    const result = await run(makeCtx());
    const out = result.output as { opportunityScore: number };
    expect(out.opportunityScore).toBeGreaterThanOrEqual(0);
    expect(out.opportunityScore).toBeLessThanOrEqual(100);
  });
});

describe("SALES_OPPORTUNITY_SCORER - missing websiteAudit", () => {
  it("runs without an audit row; features=null is accepted by the deterministic scorer", async () => {
    prismaMock.lead.findUniqueOrThrow.mockResolvedValue(
      makeLeadRow({ websiteAudit: null }),
    );
    analyzeLeadWithGeminiMock.mockResolvedValue(geminiOutput());

    const result = await run(makeCtx());
    expect(prismaMock.salesOpportunity.upsert).toHaveBeenCalledTimes(1);
    const out = result.output as { opportunityScore: number };
    expect(typeof out.opportunityScore).toBe("number");
  });
});

describe("SALES_OPPORTUNITY_SCORER - Gemini error handling", () => {
  it("re-throws when Gemini fails so the run is marked FAILED and no synthetic analysis is written", async () => {
    // Previously the scorer silently fabricated a placeholder
    // 'AI analysis' when Gemini threw and wrote it into
    // SalesOpportunity as if real. That behaviour is gone: a Gemini
    // failure is a real failure, the run surfaces it, and the
    // existing SalesOpportunity row (if any) stays intact.
    prismaMock.lead.findUniqueOrThrow.mockResolvedValue(makeLeadRow());
    analyzeLeadWithGeminiMock.mockRejectedValue(new Error("gemini 500"));

    await expect(run(makeCtx())).rejects.toThrow(/gemini 500/);
    expect(prismaMock.salesOpportunity.upsert).not.toHaveBeenCalled();

    const statuses = prismaMock.lead.update.mock.calls.map(
      (c) => (c[0] as { data: { analyzeStatus: string } }).data.analyzeStatus,
    );
    // ANALYZING -> FAILED (the catch block runs because the worker
    // rethrows the Gemini error instead of silently substituting
    // placeholder copy).
    expect(statuses).toEqual(["ANALYZING", "FAILED"]);
  });

  it("re-throws on unexpected errors (e.g. lead lookup fails) and marks analyzeStatus=FAILED", async () => {
    prismaMock.lead.findUniqueOrThrow.mockRejectedValue(new Error("lead missing"));

    await expect(run(makeCtx())).rejects.toThrow(/lead missing/);

    const statuses = prismaMock.lead.update.mock.calls.map(
      (c) => (c[0] as { data: { analyzeStatus: string } }).data.analyzeStatus,
    );
    expect(statuses).toContain("FAILED");
  });

  it("throws 'requires a lead context' when ctx.lead is null", async () => {
    await expect(run(makeCtx({ lead: null }))).rejects.toThrow(/requires a lead/);
  });
});

describe("SALES_OPPORTUNITY_SCORER - P0.5 ICP-fit adjustment", () => {
  // Stable inputs across these tests — only the workspace target list
  // and lead niche slugs change. analyzeLeadWithGemini returns a
  // mid-range opportunity_score so we have headroom to detect the
  // +5 / -8 deterministic adjustment without hitting the [0, 100]
  // clamp boundaries.
  const baseGemini = geminiOutput({
    opportunity_score: 60,
    reason_codes: ["weak_seo"],
  });

  it("adds +5 + 'icp_fit' reason when lead's subNicheSlug is in workspace.targetSubNiches", async () => {
    prismaMock.lead.findUniqueOrThrow.mockResolvedValue(
      makeLeadRow({ subNicheSlug: "fnb-bar-club", nicheSlug: "fnb" }),
    );
    prismaMock.workspace.findUnique.mockResolvedValue({
      targetSubNiches: ["fnb-bar-club", "fnb-fine-dining"],
    });
    analyzeLeadWithGeminiMock.mockResolvedValue(baseGemini);

    await run(makeCtx());
    const upsertArgs = prismaMock.salesOpportunity.upsert.mock.calls[0][0];
    const baseline = Math.round(0 * 0.4 + 60 * 0.6); // det score is 0 for a perfect audit
    expect(upsertArgs.create.opportunityScore).toBeGreaterThanOrEqual(baseline + 5);
    expect(upsertArgs.create.reasonCodes).toContain("icp_fit");
    expect(upsertArgs.create.reasonCodes).not.toContain("outside_icp");
  });

  it("subtracts 8 + 'outside_icp' reason when targetSubNiches is non-empty AND the lead is outside it", async () => {
    prismaMock.lead.findUniqueOrThrow.mockResolvedValue(
      makeLeadRow({ subNicheSlug: "hvac", nicheSlug: "home-services" }),
    );
    prismaMock.workspace.findUnique.mockResolvedValue({
      targetSubNiches: ["fnb-bar-club"],
    });
    analyzeLeadWithGeminiMock.mockResolvedValue(baseGemini);

    await run(makeCtx());
    const upsertArgs = prismaMock.salesOpportunity.upsert.mock.calls[0][0];
    expect(upsertArgs.create.reasonCodes).toContain("outside_icp");
    expect(upsertArgs.create.reasonCodes).not.toContain("icp_fit");
    // Score is clamped to >=0 even if the penalty pushes it negative.
    expect(upsertArgs.create.opportunityScore).toBeGreaterThanOrEqual(0);
  });

  it("matches an active campaign niche → +5 + 'icp_fit' + matchedCampaignId surfaced on output", async () => {
    prismaMock.lead.findUniqueOrThrow.mockResolvedValue(
      makeLeadRow({ subNicheSlug: "dental-clinic", nicheSlug: "dental" }),
    );
    prismaMock.workspace.findUnique.mockResolvedValue({ targetSubNiches: [] });
    prismaMock.sequence.findMany.mockResolvedValue([
      { id: "seq_1", name: "Dental Q2", niche: "dental-clinic", description: null },
    ]);
    analyzeLeadWithGeminiMock.mockResolvedValue(baseGemini);

    const result = await run(makeCtx());
    const out = result.output as {
      opportunityScore: number;
      reasonCodes: string[];
      icpFit: { delta: number; code: string | null; matchedCampaignId: string | null };
    };
    expect(out.reasonCodes).toContain("icp_fit");
    expect(out.icpFit).toEqual({
      delta: 5,
      code: "icp_fit",
      matchedCampaignId: "seq_1",
    });
  });

  it("stays neutral when targetSubNiches is empty AND no campaign niche matches", async () => {
    prismaMock.lead.findUniqueOrThrow.mockResolvedValue(
      makeLeadRow({ subNicheSlug: "dental-clinic", nicheSlug: "dental" }),
    );
    prismaMock.workspace.findUnique.mockResolvedValue({ targetSubNiches: [] });
    prismaMock.sequence.findMany.mockResolvedValue([
      { id: "seq_other", name: "Restaurants Q2", niche: "fnb-bar-club", description: null },
    ]);
    analyzeLeadWithGeminiMock.mockResolvedValue(baseGemini);

    const result = await run(makeCtx());
    const out = result.output as {
      reasonCodes: string[];
      icpFit: { delta: number; code: string | null };
    };
    expect(out.reasonCodes).not.toContain("icp_fit");
    expect(out.reasonCodes).not.toContain("outside_icp");
    expect(out.icpFit).toEqual({ delta: 0, code: null, matchedCampaignId: null });
  });
});
