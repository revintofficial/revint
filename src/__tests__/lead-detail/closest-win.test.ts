/**
 * Phase 3 — `findClosestWin` pure-function unit test.
 *
 * Tier × trigger fixture matrix. Asserts:
 *   - Cross-workspace InsightPerformance rows are dropped (PLAN §6
 *     risk #13: shared trigger×framework×tier across workspaces).
 *   - Trigger-specific rows beat trigger-null rows.
 *   - Tier-specific rows beat tier-null rows.
 *   - Higher win-rate (Wilson lower bound) wins ties on specificity.
 *   - Returns null when no row clears the floor.
 *
 * The aggregator gates the whole feature to PRO+ and to MEDDPICC ≥ 4/7
 * cells; those gates live OUTSIDE this helper so the test stays focused.
 */
import { describe, expect, it } from "vitest";

import {
  findClosestWin,
  type ClosestWinInsightPerformanceInput,
  type ClosestWinLeadInput,
} from "@/lib/lead-detail/closest-win";

const wsA = "ws_a";
const wsB = "ws_b";

function lead(args: Partial<ClosestWinLeadInput> = {}): ClosestWinLeadInput {
  return {
    id: "lead_a",
    workspaceId: wsA,
    nicheSlug: "italian-restaurant",
    subNicheSlug: "italian-restaurant-trattoria",
    accountTier: "TIER_1",
    triggerTypes: ["RATING_DROP"],
    ...args,
  };
}

function perf(
  args: Partial<ClosestWinInsightPerformanceInput> & { id: string },
): ClosestWinInsightPerformanceInput {
  return {
    workspaceId: wsA,
    insightId: `ins_${args.id}`,
    nicheSlug: null,
    triggerType: null,
    segmentTier: null,
    framework: null,
    applied: 10,
    won: 3,
    meetingBooked: 0,
    ...args,
  };
}

describe("findClosestWin — workspace isolation", () => {
  it("drops InsightPerformance rows from other workspaces", () => {
    const result = findClosestWin(
      wsA,
      lead(),
      [
        perf({
          id: "foreign",
          workspaceId: wsB,
          triggerType: "RATING_DROP",
          won: 100,
          applied: 100,
        }),
      ],
      [],
    );
    expect(result).toBeNull();
  });

  it("returns null when called with mismatched lead workspace", () => {
    const result = findClosestWin(
      wsA,
      lead({ workspaceId: wsB }),
      [perf({ id: "x", triggerType: "RATING_DROP" })],
      [],
    );
    expect(result).toBeNull();
  });

  it("returns null when called with empty workspaceId", () => {
    const result = findClosestWin(
      "",
      lead(),
      [perf({ id: "x", triggerType: "RATING_DROP" })],
      [],
    );
    expect(result).toBeNull();
  });
});

describe("findClosestWin — specificity ranking", () => {
  it("prefers trigger-specific rows over trigger-null rows", () => {
    const result = findClosestWin(
      wsA,
      lead(),
      [
        perf({ id: "wide", triggerType: null, won: 50, applied: 100 }),
        perf({ id: "narrow", triggerType: "RATING_DROP", won: 5, applied: 20 }),
      ],
      [],
    );
    expect(result?.insightId).toBe("ins_narrow");
  });

  it("prefers tier-specific rows over tier-null rows", () => {
    const result = findClosestWin(
      wsA,
      lead(),
      [
        perf({
          id: "wide",
          triggerType: "RATING_DROP",
          segmentTier: null,
          won: 30,
          applied: 100,
        }),
        perf({
          id: "narrow",
          triggerType: "RATING_DROP",
          segmentTier: "TIER_1",
          won: 3,
          applied: 12,
        }),
      ],
      [],
    );
    expect(result?.insightId).toBe("ins_narrow");
  });

  it("breaks ties on Wilson lower bound (more wins beats fewer wins)", () => {
    const result = findClosestWin(
      wsA,
      lead(),
      [
        perf({
          id: "low",
          triggerType: "RATING_DROP",
          segmentTier: "TIER_1",
          won: 1,
          applied: 5,
        }),
        perf({
          id: "high",
          triggerType: "RATING_DROP",
          segmentTier: "TIER_1",
          won: 8,
          applied: 12,
        }),
      ],
      [],
    );
    expect(result?.insightId).toBe("ins_high");
  });
});

describe("findClosestWin — filters", () => {
  it("filters out rows with zero wins", () => {
    const result = findClosestWin(
      wsA,
      lead(),
      [perf({ id: "stale", triggerType: "RATING_DROP", won: 0, applied: 5 })],
      [],
    );
    expect(result).toBeNull();
  });

  it("filters by lead trigger types when row has a triggerType", () => {
    const result = findClosestWin(
      wsA,
      lead({ triggerTypes: ["HIRING_MARKETING"] }),
      [perf({ id: "wrong", triggerType: "RATING_DROP", won: 5, applied: 10 })],
      [],
    );
    expect(result).toBeNull();
  });

  it("filters by accountTier when row has segmentTier", () => {
    const result = findClosestWin(
      wsA,
      lead({ accountTier: "TIER_3" }),
      [
        perf({
          id: "wrong",
          triggerType: "RATING_DROP",
          segmentTier: "TIER_1",
          won: 5,
          applied: 10,
        }),
      ],
      [],
    );
    expect(result).toBeNull();
  });

  it("filters by nicheSlug when row has a niche", () => {
    const result = findClosestWin(
      wsA,
      lead({ nicheSlug: "salon", subNicheSlug: null }),
      [
        perf({
          id: "wrong",
          triggerType: "RATING_DROP",
          nicheSlug: "italian-restaurant",
          won: 5,
          applied: 10,
        }),
      ],
      [],
    );
    expect(result).toBeNull();
  });

  it("matches when subNicheSlug equals row's nicheSlug", () => {
    const result = findClosestWin(
      wsA,
      lead({
        nicheSlug: "restaurant",
        subNicheSlug: "italian-restaurant",
      }),
      [
        perf({
          id: "match",
          triggerType: "RATING_DROP",
          nicheSlug: "italian-restaurant",
          won: 5,
          applied: 10,
        }),
      ],
      [],
    );
    expect(result?.insightId).toBe("ins_match");
  });
});

describe("findClosestWin — sister lead surfacing", () => {
  it("surfaces a same-workspace sister lead id when provided", () => {
    const result = findClosestWin(
      wsA,
      lead(),
      [perf({ id: "x", triggerType: "RATING_DROP", won: 5, applied: 10 })],
      [
        {
          id: "sister_a",
          workspaceId: wsA,
          borough: "Polanco",
          formattedAddress: null,
        },
      ],
    );
    expect(result?.sisterLeadId).toBe("sister_a");
  });

  it("filters cross-workspace sister leads out", () => {
    const result = findClosestWin(
      wsA,
      lead(),
      [perf({ id: "x", triggerType: "RATING_DROP", won: 5, applied: 10 })],
      [
        {
          id: "foreign_sister",
          workspaceId: wsB,
          borough: "Polanco",
          formattedAddress: null,
        },
      ],
    );
    expect(result?.sisterLeadId).toBeNull();
  });
});

describe("findClosestWin — tier × trigger matrix", () => {
  const matrix: Array<{
    tier: "TIER_1" | "TIER_2" | "TIER_3" | "TIER_4";
    trigger: "RATING_DROP" | "HIRING_MARKETING";
  }> = [
    { tier: "TIER_1", trigger: "RATING_DROP" },
    { tier: "TIER_2", trigger: "HIRING_MARKETING" },
    { tier: "TIER_3", trigger: "RATING_DROP" },
    { tier: "TIER_4", trigger: "HIRING_MARKETING" },
  ];

  for (const cell of matrix) {
    it(`returns the matching row for ${cell.tier} × ${cell.trigger}`, () => {
      const result = findClosestWin(
        wsA,
        lead({
          accountTier: cell.tier,
          triggerTypes: [cell.trigger],
        }),
        [
          perf({
            id: "match",
            triggerType: cell.trigger,
            segmentTier: cell.tier,
            won: 4,
            applied: 10,
          }),
          perf({
            id: "noise_other_tier",
            triggerType: cell.trigger,
            segmentTier: cell.tier === "TIER_1" ? "TIER_4" : "TIER_1",
            won: 50,
            applied: 100,
          }),
        ],
        [],
      );
      expect(result?.insightId).toBe("ins_match");
    });
  }
});
