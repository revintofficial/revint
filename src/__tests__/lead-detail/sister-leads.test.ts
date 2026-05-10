/**
 * Phase 4 — `fetchSisterLeads` multi-tenant guard + pagination.
 *
 * NON-NEGOTIABLE (PLAN §6 risk #6 — highest-severity Phase 4 risk):
 *   Two workspaces sharing the same external `placeId` MUST NOT see
 *   each other's leads through the sister-leads helper. The fixture
 *   below seeds workspace A and workspace B each with a 4-location
 *   chain whose Lead rows share Place IDs. The helper, called with
 *   workspace A's id, must only return workspace A's rows.
 *
 * Also covers:
 *   - 60-row chain pagination (request 20 → next 20 → next 20):
 *     totals correct, no duplicates, ordering preserved.
 *   - Empty state: `accountId` with zero sister leads returns total 0.
 *   - Ordering by `lastContactedAt desc` (nulls last).
 *
 * The Prisma client is mocked so the test runs in-memory; the helper's
 * full where-clause shape is asserted to ensure `workspaceId` is never
 * dropped.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Lead {
  id: string;
  workspaceId: string;
  accountId: string | null;
  placeId: string;
  businessName: string;
  borough: string | null;
  subNicheSlug: string | null;
  pipelineStatus: string;
  icpFitScore: number | null;
  salesConfidence: number | null;
  lastContactedAt: Date | null;
  lastDisposition: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  watchlistItem: { dealStage: string; pipelineStage: string } | null;
}

const store: { leads: Lead[] } = { leads: [] };

const lastFindManyArgs: { value: unknown } = { value: null };
const lastCountArgs: { value: unknown } = { value: null };

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: {
      findMany: vi.fn(async (args: {
        where: {
          workspaceId: string;
          accountId: string;
          id: { not: string };
          archivedAt: null;
        };
        take?: number;
        cursor?: { id: string };
        skip?: number;
      }) => {
        lastFindManyArgs.value = args;
        let rows = store.leads.filter(
          (l) =>
            l.workspaceId === args.where.workspaceId &&
            l.accountId === args.where.accountId &&
            l.id !== args.where.id.not &&
            l.archivedAt == null,
        );
        rows.sort((a, b) => {
          const at = a.lastContactedAt?.getTime() ?? -Infinity;
          const bt = b.lastContactedAt?.getTime() ?? -Infinity;
          if (bt !== at) return bt - at;
          return b.createdAt.getTime() - a.createdAt.getTime();
        });
        if (args.cursor) {
          const idx = rows.findIndex((r) => r.id === args.cursor!.id);
          if (idx >= 0) rows = rows.slice(idx + (args.skip ?? 0));
        }
        if (args.take) rows = rows.slice(0, args.take);
        return rows;
      }),
      count: vi.fn(async (args: { where: { workspaceId: string; accountId: string; id: { not: string }; archivedAt: null } }) => {
        lastCountArgs.value = args;
        return store.leads.filter(
          (l) =>
            l.workspaceId === args.where.workspaceId &&
            l.accountId === args.where.accountId &&
            l.id !== args.where.id.not &&
            l.archivedAt == null,
        ).length;
      }),
    },
    $transaction: vi.fn(async (promises: Promise<unknown>[]) => {
      return Promise.all(promises);
    }),
  },
}));

vi.mock("@/generated/prisma/client", () => ({
  Prisma: {},
}));

import { fetchSisterLeads } from "@/lib/lead-detail/sister-leads";

const wsA = "ws_a";
const wsB = "ws_b";
const acctA = "acct_a";
const acctB = "acct_b";

function makeLead(
  id: string,
  workspaceId: string,
  accountId: string | null,
  overrides: Partial<Lead> = {},
): Lead {
  return {
    id,
    workspaceId,
    accountId,
    placeId: `place_shared_${id.slice(-3)}`,
    businessName: id.toUpperCase(),
    borough: null,
    subNicheSlug: null,
    pipelineStatus: "OK",
    icpFitScore: 60,
    salesConfidence: 70,
    lastContactedAt: null,
    lastDisposition: null,
    archivedAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    watchlistItem: null,
    ...overrides,
  };
}

beforeEach(() => {
  store.leads = [];
  lastFindManyArgs.value = null;
  lastCountArgs.value = null;
});

describe("fetchSisterLeads — multi-tenant scope (PLAN risk #6)", () => {
  it("never returns workspace B's leads when called with workspace A's id (shared placeId)", async () => {
    const sharedPlaceId = "place_shared";
    store.leads.push(
      makeLead("a_roma", wsA, acctA, {
        placeId: sharedPlaceId,
        businessName: "ROMA-A",
      }),
      makeLead("a_polanco", wsA, acctA, {
        businessName: "POLANCO-A",
      }),
      makeLead("a_condesa", wsA, acctA, {
        businessName: "CONDESA-A",
      }),
      makeLead("a_coyoacan", wsA, acctA, {
        businessName: "COYOACAN-A",
      }),
      makeLead("b_roma", wsB, acctB, {
        placeId: sharedPlaceId,
        businessName: "ROMA-B",
      }),
      makeLead("b_polanco", wsB, acctB, {
        businessName: "POLANCO-B",
      }),
    );

    const result = await fetchSisterLeads({
      workspaceId: wsA,
      accountId: acctA,
      currentLeadId: "a_roma",
    });

    expect(result.total).toBe(3);
    expect(result.items).toHaveLength(3);
    for (const item of result.items) {
      expect(item.id.startsWith("a_")).toBe(true);
      expect(item.businessName.endsWith("-A")).toBe(true);
    }
  });

  it("includes workspaceId in BOTH the findMany and count where clauses", async () => {
    store.leads.push(makeLead("a_one", wsA, acctA));

    await fetchSisterLeads({
      workspaceId: wsA,
      accountId: acctA,
      currentLeadId: "current",
    });

    const findArgs = lastFindManyArgs.value as { where: { workspaceId: string } };
    const countArgs = lastCountArgs.value as { where: { workspaceId: string } };
    expect(findArgs.where.workspaceId).toBe(wsA);
    expect(countArgs.where.workspaceId).toBe(wsA);
  });

  it("excludes the current lead from the result", async () => {
    store.leads.push(
      makeLead("a_self", wsA, acctA),
      makeLead("a_other", wsA, acctA),
    );

    const result = await fetchSisterLeads({
      workspaceId: wsA,
      accountId: acctA,
      currentLeadId: "a_self",
    });

    expect(result.items.map((i) => i.id)).toEqual(["a_other"]);
    expect(result.total).toBe(1);
  });

  it("excludes archived leads", async () => {
    store.leads.push(
      makeLead("a_live", wsA, acctA),
      makeLead("a_archived", wsA, acctA, {
        archivedAt: new Date("2026-04-01T00:00:00Z"),
      }),
    );

    const result = await fetchSisterLeads({
      workspaceId: wsA,
      accountId: acctA,
      currentLeadId: "current",
    });

    expect(result.total).toBe(1);
    expect(result.items.map((i) => i.id)).toEqual(["a_live"]);
  });
});

describe("fetchSisterLeads — chain pagination (60+ rows)", () => {
  beforeEach(() => {
    for (let i = 0; i < 60; i++) {
      store.leads.push(
        makeLead(`chain_${String(i).padStart(2, "0")}`, wsA, acctA, {
          createdAt: new Date(2026, 0, 1, 0, i),
          lastContactedAt: new Date(2026, 0, 1, 0, i),
        }),
      );
    }
  });

  it("returns the first 20 rows and a nextCursor", async () => {
    const page1 = await fetchSisterLeads({
      workspaceId: wsA,
      accountId: acctA,
      currentLeadId: "non_member",
      take: 20,
    });
    expect(page1.items).toHaveLength(20);
    expect(page1.total).toBe(60);
    expect(page1.nextCursor).toBe(page1.items[page1.items.length - 1].id);
  });

  it("paginates 20 → 20 → 20 with no duplicates", async () => {
    const page1 = await fetchSisterLeads({
      workspaceId: wsA,
      accountId: acctA,
      currentLeadId: "non_member",
      take: 20,
    });
    const page2 = await fetchSisterLeads({
      workspaceId: wsA,
      accountId: acctA,
      currentLeadId: "non_member",
      take: 20,
      cursor: page1.nextCursor!,
    });
    const page3 = await fetchSisterLeads({
      workspaceId: wsA,
      accountId: acctA,
      currentLeadId: "non_member",
      take: 20,
      cursor: page2.nextCursor!,
    });

    expect(page2.items).toHaveLength(20);
    expect(page3.items).toHaveLength(20);

    const seen = new Set<string>();
    for (const page of [page1, page2, page3]) {
      for (const item of page.items) {
        expect(seen.has(item.id)).toBe(false);
        seen.add(item.id);
      }
    }
    expect(seen.size).toBe(60);
    expect(page3.nextCursor).toBeNull();
  });

  it("clamps take to the hard cap of 50", async () => {
    const result = await fetchSisterLeads({
      workspaceId: wsA,
      accountId: acctA,
      currentLeadId: "non_member",
      take: 9999,
    });
    expect(result.items.length).toBeLessThanOrEqual(50);
  });
});

describe("fetchSisterLeads — empty + ordering", () => {
  it("returns an empty list when the account has no other leads", async () => {
    store.leads.push(makeLead("a_only", wsA, acctA));
    const result = await fetchSisterLeads({
      workspaceId: wsA,
      accountId: acctA,
      currentLeadId: "a_only",
    });
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.nextCursor).toBeNull();
  });

  it("orders by lastContactedAt desc, nulls last", async () => {
    store.leads.push(
      makeLead("a_old", wsA, acctA, {
        lastContactedAt: new Date("2025-01-01T00:00:00Z"),
      }),
      makeLead("a_recent", wsA, acctA, {
        lastContactedAt: new Date("2026-04-01T00:00:00Z"),
      }),
      makeLead("a_never", wsA, acctA, {
        lastContactedAt: null,
      }),
    );

    const result = await fetchSisterLeads({
      workspaceId: wsA,
      accountId: acctA,
      currentLeadId: "current",
    });

    expect(result.items.map((i) => i.id)).toEqual([
      "a_recent",
      "a_old",
      "a_never",
    ]);
  });
});

describe("fetchSisterLeads — derived stage", () => {
  it("derives stage = COLD when no watchlist item is attached", async () => {
    store.leads.push(makeLead("a_one", wsA, acctA));
    const result = await fetchSisterLeads({
      workspaceId: wsA,
      accountId: acctA,
      currentLeadId: "current",
    });
    expect(result.items[0].stage).toBe("COLD");
  });

  it("derives stage = WON from WatchlistItem.dealStage", async () => {
    store.leads.push(
      makeLead("a_won", wsA, acctA, {
        watchlistItem: { dealStage: "WON", pipelineStage: "WON" },
      }),
    );
    const result = await fetchSisterLeads({
      workspaceId: wsA,
      accountId: acctA,
      currentLeadId: "current",
    });
    expect(result.items[0].stage).toBe("WON");
    expect(result.items[0].isWon).toBe(true);
  });
});
