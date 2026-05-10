/**
 * Phase 3 — GET /api/leads/queue integration test.
 *
 * Multi-tenant guard (PLAN §6 — second-highest cross-tenant leak risk):
 *   Workspace A's queue must NEVER include workspace B's leads. We seed
 *   two workspaces and assert the response only contains workspace-A
 *   rows.
 *
 * Also covers:
 *   - Per-rep scope (PLAN §6 risk #14 optimistic claim): leads
 *     assigned to other users in the same workspace are excluded.
 *   - Snoozed-out filter: leads with `snoozeUntil > now` are excluded.
 *   - FREE plan returns `{ items: [], locked: true }`.
 *   - Sort order: nextActionDueAt asc nulls last, salesConfidence desc.
 *   - 401 surfaces when requireUser throws.
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

interface FakeLead {
  id: string;
  workspaceId: string;
  assignedToUserId: string | null;
  businessName: string;
  archivedAt: Date | null;
  discardedAt: Date | null;
  snoozeUntil: Date | null;
  nextActionDueAt: Date | null;
  salesConfidence: number | null;
  lastContactedAt: Date | null;
  account: { tier: "TIER_1" | "TIER_2" | "TIER_3" | "TIER_4" } | null;
  triggers: Array<{ type: string; impactPrediction: string | null }>;
}

let leads: FakeLead[] = [];

interface FindManyArgs {
  where: {
    workspaceId: string;
    assignedToUserId?: string | null;
    archivedAt?: null;
    discardedAt?: null;
    AND?: Array<{
      workspaceId?: string;
      assignedToUserId?: string;
      OR?: Array<{ snoozeUntil: null | { lte: Date } }>;
      id?: { not: string };
    }>;
    OR?: Array<{ snoozeUntil: null | { lte: Date } }>;
  };
  take?: number;
  orderBy?: unknown;
}

function applyWhere(args: FindManyArgs): FakeLead[] {
  const baseWhere = args.where.AND?.[0] ?? args.where;
  const cursorClause = args.where.AND?.[1] ?? null;
  const now = new Date();
  const out = leads.filter((l) => {
    if (l.workspaceId !== baseWhere.workspaceId) return false;
    if (
      "assignedToUserId" in baseWhere &&
      baseWhere.assignedToUserId &&
      l.assignedToUserId !== baseWhere.assignedToUserId
    )
      return false;
    if ("archivedAt" in baseWhere && l.archivedAt != null) return false;
    if ("discardedAt" in baseWhere && l.discardedAt != null) return false;
    if (l.snoozeUntil != null && l.snoozeUntil.getTime() > now.getTime())
      return false;
    if (cursorClause?.id?.not && l.id === cursorClause.id.not) return false;
    return true;
  });
  out.sort((a, b) => {
    const ad = a.nextActionDueAt?.getTime() ?? Number.POSITIVE_INFINITY;
    const bd = b.nextActionDueAt?.getTime() ?? Number.POSITIVE_INFINITY;
    if (ad !== bd) return ad - bd;
    const ac = a.salesConfidence ?? -Infinity;
    const bc = b.salesConfidence ?? -Infinity;
    return bc - ac;
  });
  return out.slice(0, args.take ?? out.length);
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: {
      findMany: vi.fn(async (args: FindManyArgs) => {
        const rows = applyWhere(args);
        return rows.map((l) => ({
          id: l.id,
          businessName: l.businessName,
          nextActionDueAt: l.nextActionDueAt,
          salesConfidence: l.salesConfidence,
          account: l.account,
          triggers: l.triggers,
        }));
      }),
      count: vi.fn(async (args: { where: { workspaceId: string } }) => {
        const w = args.where as {
          workspaceId: string;
          assignedToUserId?: string;
          lastContactedAt?: { gte: Date };
        };
        return leads.filter(
          (l) =>
            l.workspaceId === w.workspaceId &&
            (!w.assignedToUserId || l.assignedToUserId === w.assignedToUserId) &&
            (!w.lastContactedAt ||
              (l.lastContactedAt != null &&
                l.lastContactedAt.getTime() >= w.lastContactedAt.gte.getTime())),
        ).length;
      }),
    },
    $transaction: vi.fn(async (promises: Promise<unknown>[]) =>
      Promise.all(promises),
    ),
  },
}));

import { GET } from "@/app/api/leads/queue/route";

const wsA = "ws_a";
const wsB = "ws_b";
const userA = "user_a";
const userOther = "user_other";

function setSession(args: {
  workspaceId: string;
  userId?: string;
  plan?: "FREE" | "PRO" | "PRO_TEAM" | "AGENCY";
}) {
  mockRequireUser.mockResolvedValue({
    user: {
      id: args.userId ?? userA,
      email: "u@u.com",
      fullName: null,
      avatarUrl: null,
    },
    workspaceId: args.workspaceId,
    workspace: {
      id: args.workspaceId,
      name: "T",
      slug: "t",
      plan: args.plan ?? "PRO",
    },
    role: "OWNER",
  });
}

function makeReq(qs?: string) {
  return new Request(`http://localhost/api/leads/queue${qs ? `?${qs}` : ""}`);
}

beforeEach(() => {
  leads = [];
  mockRequireUser.mockReset();
});

function makeLead(args: Partial<FakeLead> & { id: string; workspaceId: string }): FakeLead {
  return {
    assignedToUserId: userA,
    businessName: args.id.toUpperCase(),
    archivedAt: null,
    discardedAt: null,
    snoozeUntil: null,
    nextActionDueAt: null,
    salesConfidence: 50,
    lastContactedAt: null,
    account: null,
    triggers: [],
    ...args,
  };
}

describe("GET /api/leads/queue — multi-tenant guard", () => {
  it("never returns leads from a foreign workspace", async () => {
    leads.push(makeLead({ id: "lead_a", workspaceId: wsA }));
    leads.push(makeLead({ id: "lead_b", workspaceId: wsB }));
    setSession({ workspaceId: wsA });
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const json = (await res.json()) as { items: Array<{ id: string }> };
    expect(json.items.map((i) => i.id)).toEqual(["lead_a"]);
  });
});

describe("GET /api/leads/queue — per-rep scope (optimistic claim)", () => {
  it("excludes leads assigned to other reps in the same workspace", async () => {
    leads.push(makeLead({ id: "mine", workspaceId: wsA, assignedToUserId: userA }));
    leads.push(
      makeLead({ id: "theirs", workspaceId: wsA, assignedToUserId: userOther }),
    );
    setSession({ workspaceId: wsA });
    const res = await GET(makeReq());
    const json = (await res.json()) as { items: Array<{ id: string }> };
    expect(json.items.map((i) => i.id)).toEqual(["mine"]);
  });

  it("silently coerces a foreign assignedToUserId param to the caller's id", async () => {
    leads.push(
      makeLead({ id: "theirs", workspaceId: wsA, assignedToUserId: userOther }),
    );
    setSession({ workspaceId: wsA });
    const res = await GET(makeReq(`assignedToUserId=${userOther}`));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { items: Array<{ id: string }> };
    expect(json.items).toEqual([]);
  });
});

describe("GET /api/leads/queue — snooze filter", () => {
  it("excludes leads with snoozeUntil in the future", async () => {
    leads.push(
      makeLead({
        id: "active",
        workspaceId: wsA,
        snoozeUntil: null,
      }),
    );
    leads.push(
      makeLead({
        id: "snoozed",
        workspaceId: wsA,
        snoozeUntil: new Date(Date.now() + 60_000),
      }),
    );
    setSession({ workspaceId: wsA });
    const res = await GET(makeReq());
    const json = (await res.json()) as { items: Array<{ id: string }> };
    expect(json.items.map((i) => i.id)).toEqual(["active"]);
  });

  it("includes leads whose snoozeUntil has elapsed", async () => {
    leads.push(
      makeLead({
        id: "elapsed",
        workspaceId: wsA,
        snoozeUntil: new Date(Date.now() - 60_000),
      }),
    );
    setSession({ workspaceId: wsA });
    const res = await GET(makeReq());
    const json = (await res.json()) as { items: Array<{ id: string }> };
    expect(json.items.map((i) => i.id)).toEqual(["elapsed"]);
  });
});

describe("GET /api/leads/queue — sort order", () => {
  it("sorts by nextActionDueAt asc (nulls last) then salesConfidence desc", async () => {
    leads.push(
      makeLead({
        id: "due_now",
        workspaceId: wsA,
        nextActionDueAt: new Date(Date.now() - 60_000),
        salesConfidence: 60,
      }),
    );
    leads.push(
      makeLead({
        id: "due_later",
        workspaceId: wsA,
        nextActionDueAt: new Date(Date.now() + 60_000),
        salesConfidence: 60,
      }),
    );
    leads.push(
      makeLead({
        id: "no_due",
        workspaceId: wsA,
        nextActionDueAt: null,
        salesConfidence: 90,
      }),
    );
    setSession({ workspaceId: wsA });
    const res = await GET(makeReq());
    const json = (await res.json()) as { items: Array<{ id: string }> };
    expect(json.items.map((i) => i.id)).toEqual(["due_now", "due_later", "no_due"]);
  });
});

describe("GET /api/leads/queue — plan gating", () => {
  it("returns locked envelope on FREE plan", async () => {
    leads.push(makeLead({ id: "lead_a", workspaceId: wsA }));
    setSession({ workspaceId: wsA, plan: "FREE" });
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const json = (await res.json()) as { items: unknown[]; locked: boolean };
    expect(json.locked).toBe(true);
    expect(json.items).toEqual([]);
  });

  it("returns the queue on PRO and above", async () => {
    leads.push(makeLead({ id: "lead_a", workspaceId: wsA }));
    setSession({ workspaceId: wsA, plan: "PRO" });
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const json = (await res.json()) as { items: Array<{ id: string }>; locked: boolean };
    expect(json.locked).toBe(false);
    expect(json.items).toHaveLength(1);
  });
});

describe("GET /api/leads/queue — auth", () => {
  it("returns 401 when requireUser throws", async () => {
    const auth = await import("@/lib/auth");
    mockRequireUser.mockRejectedValue(new auth.UnauthorizedError("nope"));
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });
});
