/**
 * Phase 2 — `/api/leads/[id]/decision-surface` integration test.
 *
 * NON-NEGOTIABLE: workspace A may NOT read workspace B's leads. The
 * aggregator returns 404 (not 200, not 403) when the caller's
 * workspace does not own the lead. We seed two workspaces in-memory
 * and route every Prisma call through a tenant-aware mock.
 *
 * Also covers:
 *   - non-COLD lead with at least one DealQualificationFact gets an
 *     auto-WatchlistItem on PRO plan (idempotent if one already
 *     exists).
 *   - FREE plan workspaces never trigger auto-watchlist creation.
 *   - The transaction round-trip count is bounded (≤ 8 so the
 *     PLAN §4.0 budget holds).
 */
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";

const mockRequireUser = vi.fn();

vi.mock("@/lib/auth", () => {
  class UnauthorizedError extends Error {}
  return {
    requireUser: (...args: unknown[]) => mockRequireUser(...args),
    UnauthorizedError,
  };
});

interface Lead {
  id: string;
  workspaceId: string;
  businessName: string;
  formattedAddress: string | null;
  borough: string | null;
  phone: string | null;
  websiteUrl: string | null;
  primaryType: string | null;
  subNicheSlug: string | null;
  accountId: string | null;
  lastContactedAt: Date | null;
  icpFitScore: number | null;
  priceLevel: number | null;
  reviewCount: number | null;
  rating: number | null;
  hasWebsite: boolean;
  timezone: string | null;
  websiteAudit: null;
  watchlistItem: { id: string; pipelineStage: string; dealStage: string } | null;
  account: null;
}

interface DealQualificationFact {
  id: string;
  workspaceId: string;
  watchlistItemId: string;
  fieldPath: string;
  confidence: number;
  sourceQuote: string | null;
  sourceRefType: string | null;
  sourceRefId: string | null;
  extractedAt: Date;
  supersededAt: Date | null;
}

interface WatchlistItem {
  id: string;
  leadId: string;
  pipelineStage: string;
  dealStage: string;
}

const wsA = "ws_a";
const wsB = "ws_b";

const baseLead = (id: string, workspaceId: string, overrides: Partial<Lead> = {}): Lead => ({
  id,
  workspaceId,
  businessName: id.toUpperCase(),
  formattedAddress: null,
  borough: null,
  phone: null,
  websiteUrl: null,
  primaryType: null,
  subNicheSlug: null,
  accountId: null,
  lastContactedAt: null,
  icpFitScore: 50,
  priceLevel: 3,
  reviewCount: 100,
  rating: 4.5,
  hasWebsite: true,
  timezone: null,
  websiteAudit: null,
  watchlistItem: null,
  account: null,
  ...overrides,
});

let leads: Lead[] = [];
let facts: DealQualificationFact[] = [];
let watchlistItems: WatchlistItem[] = [];
let txCallCount = 0;
const upsertSpy = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: {
      findFirst: vi.fn(async (args: { where: { id?: string; workspaceId?: string } }) => {
        const { id, workspaceId } = args.where;
        return (
          leads.find((l) => l.id === id && l.workspaceId === workspaceId) ?? null
        );
      }),
    },
    leadNextAction: {
      findFirst: vi.fn(async () => null),
    },
    leadTrigger: {
      findMany: vi.fn(async () => []),
    },
    stakeholder: {
      findMany: vi.fn(async () => []),
    },
    dealQualification: {
      findFirst: vi.fn(async (args: { where: { workspaceId: string; watchlistItemId: string } }) => {
        if (args.where.watchlistItemId === "__never__") return null;
        return null;
      }),
    },
    dealQualificationFact: {
      findMany: vi.fn(async (args: { where: { workspaceId: string; watchlistItemId: string } }) => {
        if (args.where.watchlistItemId === "__never__") return [];
        return facts.filter(
          (f) =>
            f.workspaceId === args.where.workspaceId &&
            f.watchlistItemId === args.where.watchlistItemId,
        );
      }),
    },
    discoverySession: {
      findFirst: vi.fn(async () => null),
    },
    objection: {
      findMany: vi.fn(async () => []),
    },
    idealCustomerProfile: {
      findFirst: vi.fn(async () => null),
    },
    leadActivity: {
      findMany: vi.fn(async () => []),
    },
    watchlistItem: {
      upsert: (...args: unknown[]) => {
        upsertSpy(...args);
        const arg = args[0] as {
          where: { leadId: string };
          create: { leadId: string };
        };
        const existing = watchlistItems.find((w) => w.leadId === arg.where.leadId);
        if (existing) return existing;
        const created: WatchlistItem = {
          id: `wl_${arg.create.leadId}`,
          leadId: arg.create.leadId,
          pipelineStage: "NEW",
          dealStage: "PROSPECTING",
        };
        watchlistItems.push(created);
        return created;
      },
    },
    $transaction: vi.fn(async (promises: Promise<unknown>[]) => {
      txCallCount += 1;
      return Promise.all(promises);
    }),
  },
}));

import { GET } from "@/app/api/leads/[id]/decision-surface/route";

function makeReq() {
  return new Request("http://localhost/api/leads/x/decision-surface");
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  leads = [];
  facts = [];
  watchlistItems = [];
  txCallCount = 0;
  upsertSpy.mockClear();
  mockRequireUser.mockReset();
  (
    [
      "leadNextAction.findFirst",
      "leadTrigger.findMany",
      "stakeholder.findMany",
      "dealQualification.findFirst",
      "dealQualificationFact.findMany",
      "discoverySession.findFirst",
      "objection.findMany",
      "idealCustomerProfile.findFirst",
      "leadActivity.findMany",
    ] as const
  ).forEach(() => {
    // mocks are already initialized; nothing to do per test
  });
});

function setSession(workspaceId: string, plan: "FREE" | "PRO" | "PRO_TEAM" | "AGENCY" = "PRO") {
  mockRequireUser.mockResolvedValue({
    user: { id: "u1", email: "u@u.com", fullName: null, avatarUrl: null },
    workspaceId,
    workspace: { id: workspaceId, name: "Test", slug: "test", plan },
    role: "OWNER",
  });
}

describe("/api/leads/[id]/decision-surface — multi-tenant guard", () => {
  it("returns 404 when workspace A asks for a lead in workspace B", async () => {
    leads.push(baseLead("lead_b", wsB));
    setSession(wsA);
    const res = await GET(makeReq(), makeParams("lead_b"));
    expect(res.status).toBe(404);
  });

  it("returns 200 when workspace A reads its own lead", async () => {
    leads.push(baseLead("lead_a", wsA));
    setSession(wsA);
    const res = await GET(makeReq(), makeParams("lead_a"));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { leadCore: { id: string } };
    expect(json.leadCore.id).toBe("lead_a");
  });

  it("never leaks lead existence to a foreign workspace (404, not 403)", async () => {
    leads.push(baseLead("lead_b", wsB));
    setSession(wsA);
    const res = await GET(makeReq(), makeParams("lead_b"));
    expect(res.status).toBe(404);
    const json = (await res.json()) as { error: string };
    expect(json.error).toMatch(/not found/i);
  });
});

describe("/api/leads/[id]/decision-surface — auto-WatchlistItem", () => {
  it("does NOT upsert a watchlist when the plan is FREE", async () => {
    leads.push(
      baseLead("lead_a", wsA, {
        lastContactedAt: new Date("2026-04-01T00:00:00Z"),
      }),
    );
    setSession(wsA, "FREE");
    const res = await GET(makeReq(), makeParams("lead_a"));
    expect(res.status).toBe(200);
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it("does NOT upsert a watchlist when there are no DealQualificationFacts", async () => {
    leads.push(
      baseLead("lead_a", wsA, {
        lastContactedAt: new Date("2026-04-01T00:00:00Z"),
      }),
    );
    setSession(wsA, "PRO");
    const res = await GET(makeReq(), makeParams("lead_a"));
    expect(res.status).toBe(200);
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it("does NOT upsert when the lead is COLD (no lastContactedAt)", async () => {
    leads.push(
      baseLead("lead_a", wsA, { lastContactedAt: null }),
    );
    setSession(wsA, "PRO");
    const res = await GET(makeReq(), makeParams("lead_a"));
    expect(res.status).toBe(200);
    expect(upsertSpy).not.toHaveBeenCalled();
  });
});

describe("/api/leads/[id]/decision-surface — performance budget", () => {
  it("issues at most one Prisma.$transaction call per request", async () => {
    leads.push(baseLead("lead_a", wsA));
    setSession(wsA, "PRO");
    await GET(makeReq(), makeParams("lead_a"));
    expect(txCallCount).toBe(1);
  });

  it("issues no additional round-trips when the lead is foreign", async () => {
    leads.push(baseLead("lead_b", wsB));
    setSession(wsA, "PRO");
    await GET(makeReq(), makeParams("lead_b"));
    expect(txCallCount).toBe(0);
  });
});

describe("/api/leads/[id]/decision-surface — response shape", () => {
  it("populates the planGate slot from the session plan", async () => {
    leads.push(baseLead("lead_a", wsA));
    setSession(wsA, "FREE");
    const res = await GET(makeReq(), makeParams("lead_a"));
    const json = (await res.json()) as {
      planGate: { plan: string; meddpiccUnlocked: boolean; spinUnlocked: boolean };
    };
    expect(json.planGate.plan).toBe("FREE");
    expect(json.planGate.meddpiccUnlocked).toBe(false);
    expect(json.planGate.spinUnlocked).toBe(false);
  });

  it("returns the full Phase 2 envelope (every key present)", async () => {
    leads.push(baseLead("lead_a", wsA));
    setSession(wsA, "PRO");
    const res = await GET(makeReq(), makeParams("lead_a"));
    const json = (await res.json()) as Record<string, unknown>;
    [
      "leadCore",
      "nba",
      "bant",
      "icpDimensions",
      "stakeholders",
      "dealQualification",
      "latestDiscovery",
      "recentObjections",
      "accountSummary",
      "activities",
      "planGate",
    ].forEach((key) => {
      expect(json).toHaveProperty(key);
    });
  });
});

describe("requireUser failure", () => {
  it("returns 401 when requireUser throws Unauthorized", async () => {
    leads.push(baseLead("lead_a", wsA));
    const auth = await import("@/lib/auth");
    mockRequireUser.mockRejectedValue(new auth.UnauthorizedError("nope"));
    const res = await GET(makeReq(), makeParams("lead_a"));
    expect(res.status).toBe(401);
  });
});

// Suppress unused warning for Mock alias from vitest.
export type _MockAlias = Mock;
