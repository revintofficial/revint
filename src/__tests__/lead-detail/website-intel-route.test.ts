/**
 * Phase 2.5 — `/api/leads/[id]/website-intel` integration test.
 *
 * NON-NEGOTIABLE: workspace A may NOT read workspace B's audit.
 * The route returns 404 (not 200, not 403) when the caller's
 * workspace does not own the lead.
 *
 * Also covers (PLAN §4 Phase 2.5 DoD):
 *   - query-count budget ≤ 4 (1 pre-check + 1 transaction = 2).
 *   - response shape matches `WebsiteIntelResponse`:
 *     `{ hasWebsite, audit, checklist, deepResearch, planGate }`.
 *   - PRO+ plans get `audit.rawFeaturesJson` populated; FREE plans
 *     see it null even when the column has data.
 *   - audit-less leads return `audit: null` and `checklist: null`.
 *   - run snippet is trimmed to 400 chars and falls back through
 *     summary → title → body → markdown.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireUser = vi.fn();

vi.mock("@/lib/auth", () => {
  class UnauthorizedError extends Error {}
  return {
    requireUser: (...args: unknown[]) => mockRequireUser(...args),
    UnauthorizedError,
  };
});

// Stub the (heavy) audit checklist with a deterministic counter so
// the test does not need to construct a full WebsiteFeatures fixture.
const mockRunAuditChecklist = vi.fn();

vi.mock("@/lib/audit-checklist", () => ({
  runAuditChecklist: (...args: unknown[]) => mockRunAuditChecklist(...args),
}));

interface LeadRow {
  id: string;
  workspaceId: string;
  websiteUrl: string | null;
  hasWebsite: boolean;
  primaryType: string | null;
  subNicheSlug: string | null;
}

interface AuditRow {
  id: string;
  leadId: string;
  url: string;
  reachable: boolean;
  crawlAttemptedAt: Date | null;
  crawlError: string | null;
  httpStatus: number | null;
  loadTimeMs: number | null;
  https: boolean;
  mobileFriendlyGuess: boolean;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  hasContactForm: boolean;
  hasWhatsappLink: boolean;
  hasBookingSystem: boolean;
  bookingProvider: string | null;
  hasEcommerce: boolean;
  servicesDetected: unknown;
  navItems: unknown;
  ctaLinks: unknown;
  contactEmails: unknown;
  contactEmailsVerified: unknown;
  socialProfiles: unknown;
  brokenLinksCount: number;
  structuredDataPresent: boolean;
  rawFeaturesJson: unknown;
  createdAt: Date;
}

interface AgentRunRow {
  id: string;
  workspaceId: string;
  leadId: string;
  workerKind: string;
  status: string;
  finishedAt: Date | null;
  outputJson: unknown;
}

const wsA = "ws_a";
const wsB = "ws_b";

let leads: LeadRow[] = [];
let audits: AuditRow[] = [];
let runs: AgentRunRow[] = [];
let txCallCount = 0;

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: {
      findFirst: vi.fn(
        async (args: { where: { id: string; workspaceId: string } }) =>
          leads.find(
            (l) => l.id === args.where.id && l.workspaceId === args.where.workspaceId,
          ) ?? null,
      ),
    },
    websiteAudit: {
      findUnique: vi.fn(async (args: { where: { leadId: string } }) =>
        audits.find((a) => a.leadId === args.where.leadId) ?? null,
      ),
    },
    agentRun: {
      findFirst: vi.fn(
        async (args: {
          where: {
            workspaceId: string;
            leadId: string;
            status: string;
            workerKind: { in: string[] };
          };
        }) =>
          runs
            .filter(
              (r) =>
                r.workspaceId === args.where.workspaceId &&
                r.leadId === args.where.leadId &&
                r.status === args.where.status &&
                args.where.workerKind.in.includes(r.workerKind),
            )
            .sort(
              (a, b) =>
                (b.finishedAt?.getTime() ?? 0) - (a.finishedAt?.getTime() ?? 0),
            )[0] ?? null,
      ),
    },
    $transaction: vi.fn(async (promises: Promise<unknown>[]) => {
      txCallCount += 1;
      return Promise.all(promises);
    }),
  },
}));

import { GET } from "@/app/api/leads/[id]/website-intel/route";

function makeReq() {
  return new Request("http://localhost/api/leads/x/website-intel");
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function setSession(
  workspaceId: string,
  plan: "FREE" | "PRO" | "PRO_TEAM" | "AGENCY" = "PRO",
) {
  mockRequireUser.mockResolvedValue({
    user: { id: "u1", email: "u@u.com", fullName: null, avatarUrl: null },
    workspaceId,
    workspace: { id: workspaceId, name: "Test", slug: "test", plan },
    role: "OWNER",
  });
}

function makeLead(overrides: Partial<LeadRow> = {}): LeadRow {
  return {
    id: "lead_a",
    workspaceId: wsA,
    websiteUrl: "https://example.com",
    hasWebsite: true,
    primaryType: "RESTAURANT_TECH",
    subNicheSlug: "fnb-fine-dining",
    ...overrides,
  };
}

function makeAudit(overrides: Partial<AuditRow> = {}): AuditRow {
  return {
    id: "au1",
    leadId: "lead_a",
    url: "https://example.com",
    reachable: true,
    crawlAttemptedAt: new Date("2026-04-15T00:00:00Z"),
    crawlError: null,
    httpStatus: 200,
    loadTimeMs: 1200,
    https: true,
    mobileFriendlyGuess: true,
    title: "Example",
    metaDescription: "A description",
    h1: "Welcome",
    hasContactForm: true,
    hasWhatsappLink: false,
    hasBookingSystem: true,
    bookingProvider: "OpenTable",
    hasEcommerce: false,
    servicesDetected: ["dinner", "tasting menu"],
    navItems: ["Home", "Menu"],
    ctaLinks: ["Reserve"],
    contactEmails: ["info@example.com"],
    contactEmailsVerified: [],
    socialProfiles: { instagram: "https://instagram.com/example" },
    brokenLinksCount: 0,
    structuredDataPresent: true,
    rawFeaturesJson: { reachable: true, https: true },
    createdAt: new Date("2026-04-15T00:00:00Z"),
    ...overrides,
  };
}

beforeEach(() => {
  leads = [];
  audits = [];
  runs = [];
  txCallCount = 0;
  mockRequireUser.mockReset();
  mockRunAuditChecklist.mockReset();
  mockRunAuditChecklist.mockReturnValue({
    seo: [],
    performance: [],
    security: [],
    accessibility: [],
    ux: [],
    pwa: [],
    form: [],
    summary: { totalChecks: 10, passed: 7, failed: 2, unknown: 1, scorePercent: 78 },
  });
});

describe("/api/leads/[id]/website-intel — multi-tenant guard", () => {
  it("returns 404 when workspace A asks for a lead in workspace B", async () => {
    leads.push(makeLead({ id: "lead_b", workspaceId: wsB }));
    setSession(wsA);
    const res = await GET(makeReq(), makeParams("lead_b"));
    expect(res.status).toBe(404);
  });

  it("returns 200 when workspace A reads its own lead", async () => {
    leads.push(makeLead());
    setSession(wsA);
    const res = await GET(makeReq(), makeParams("lead_a"));
    expect(res.status).toBe(200);
  });
});

describe("/api/leads/[id]/website-intel — query-count budget", () => {
  it("performs ≤ 4 round-trips (1 pre-check + 1 transaction)", async () => {
    leads.push(makeLead());
    audits.push(makeAudit());
    setSession(wsA);
    await GET(makeReq(), makeParams("lead_a"));
    expect(txCallCount).toBe(1);
  });
});

describe("/api/leads/[id]/website-intel — plan gating", () => {
  it("populates rawFeaturesJson for PRO+ plans", async () => {
    leads.push(makeLead());
    audits.push(makeAudit());
    setSession(wsA, "PRO");
    const res = await GET(makeReq(), makeParams("lead_a"));
    const body = await res.json();
    expect(body.audit.rawFeaturesJson).toEqual({ reachable: true, https: true });
    expect(body.planGate.rawFeaturesUnlocked).toBe(true);
  });

  it("nulls rawFeaturesJson for FREE plans even when populated", async () => {
    leads.push(makeLead());
    audits.push(makeAudit());
    setSession(wsA, "FREE");
    const res = await GET(makeReq(), makeParams("lead_a"));
    const body = await res.json();
    expect(body.audit.rawFeaturesJson).toBeNull();
    expect(body.planGate.rawFeaturesUnlocked).toBe(false);
  });
});

describe("/api/leads/[id]/website-intel — response shape", () => {
  it("returns audit:null + checklist:null when no audit row exists", async () => {
    leads.push(makeLead({ hasWebsite: false }));
    setSession(wsA);
    const res = await GET(makeReq(), makeParams("lead_a"));
    const body = await res.json();
    expect(body.audit).toBeNull();
    expect(body.checklist).toBeNull();
    expect(body.hasWebsite).toBe(false);
  });

  it("includes the deepResearch snippet from the latest matching run", async () => {
    leads.push(makeLead());
    audits.push(makeAudit());
    runs.push({
      id: "run1",
      workspaceId: wsA,
      leadId: "lead_a",
      workerKind: "APIFY_WEB_CRAWL_DEEP",
      status: "SUCCEEDED",
      finishedAt: new Date("2026-04-10T00:00:00Z"),
      outputJson: { summary: "Crawled 12 pages and found OpenTable widget." },
    });
    setSession(wsA);
    const res = await GET(makeReq(), makeParams("lead_a"));
    const body = await res.json();
    expect(body.deepResearch).toMatchObject({
      runId: "run1",
      workerKind: "APIFY_WEB_CRAWL_DEEP",
      snippet: "Crawled 12 pages and found OpenTable widget.",
    });
  });

  it("trims deepResearch snippet to 400 chars", async () => {
    leads.push(makeLead());
    audits.push(makeAudit());
    const longText = "A".repeat(800);
    runs.push({
      id: "run1",
      workspaceId: wsA,
      leadId: "lead_a",
      workerKind: "WEBSITE_AUDITOR",
      status: "SUCCEEDED",
      finishedAt: new Date(),
      outputJson: { body: longText },
    });
    setSession(wsA);
    const res = await GET(makeReq(), makeParams("lead_a"));
    const body = await res.json();
    expect(body.deepResearch.snippet.length).toBe(400);
    expect(body.deepResearch.snippet.endsWith("…")).toBe(true);
  });

  it("returns checklist with scorePercent when audit + features present", async () => {
    leads.push(makeLead());
    audits.push(makeAudit());
    setSession(wsA);
    const res = await GET(makeReq(), makeParams("lead_a"));
    const body = await res.json();
    expect(body.checklist).toMatchObject({
      summary: { scorePercent: 78 },
    });
    expect(mockRunAuditChecklist).toHaveBeenCalledWith(
      { reachable: true, https: true },
      true,
      "RESTAURANT_TECH",
      "fnb-fine-dining",
    );
  });
});
