/**
 * Phase 3 unit — review-velocity helper.
 *
 * Both consumers (the Phase 3 derived `ReviewVelocityBadge` and the
 * Phase 8 `REVIEW_VOLUME_*` trigger detector) must agree on the
 * window math. This test pins:
 *   - rolling-window bucketing (last-30d vs days-31-60)
 *   - empty-window handling (null avg / null delta, deltaPct=0 when
 *     prior is empty)
 *   - badge classification (surge / dip / null)
 *   - trigger classification with the stricter Phase 8 guards
 *     (recent ≥ 8 for surge, prior ≥ 5 for dip)
 */
import { describe, expect, it } from "vitest";
import {
  classifyVelocityBadge,
  classifyVelocityTrigger,
  computeReviewVelocity,
  type ReviewWindowInput,
} from "@/lib/lead-detail/review-velocity";

const NOW = new Date("2026-04-15T00:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function reviewAtDaysAgo(days: number, rating: number): ReviewWindowInput {
  return {
    rating,
    publishTime: new Date(NOW.getTime() - days * DAY),
  };
}

describe("computeReviewVelocity", () => {
  it("returns zero counts when input is empty", () => {
    const v = computeReviewVelocity([], NOW);
    expect(v.recentCount30d).toBe(0);
    expect(v.priorCount30d).toBe(0);
    expect(v.deltaPct).toBe(0);
    expect(v.recent30dAvgRating).toBeNull();
    expect(v.prior30dAvgRating).toBeNull();
    expect(v.ratingDelta).toBeNull();
  });

  it("buckets reviews into last-30d vs prior-30d windows", () => {
    const v = computeReviewVelocity(
      [
        reviewAtDaysAgo(1, 5),
        reviewAtDaysAgo(15, 4),
        reviewAtDaysAgo(29, 5),
        reviewAtDaysAgo(35, 3),
        reviewAtDaysAgo(50, 4),
        reviewAtDaysAgo(70, 5), // outside both windows — ignored
      ],
      NOW,
    );
    expect(v.recentCount30d).toBe(3);
    expect(v.priorCount30d).toBe(2);
  });

  it("ignores future-dated reviews (clock skew defense)", () => {
    const v = computeReviewVelocity(
      [reviewAtDaysAgo(-2, 5), reviewAtDaysAgo(5, 4)],
      NOW,
    );
    expect(v.recentCount30d).toBe(1);
  });

  it("computes deltaPct as integer percent vs prior", () => {
    const v = computeReviewVelocity(
      [
        ...Array.from({ length: 12 }, (_, i) => reviewAtDaysAgo(i + 1, 5)),
        ...Array.from({ length: 6 }, (_, i) => reviewAtDaysAgo(35 + i, 5)),
      ],
      NOW,
    );
    expect(v.recentCount30d).toBe(12);
    expect(v.priorCount30d).toBe(6);
    expect(v.deltaPct).toBe(100); // (12 - 6) / 6 * 100
  });

  it("avoids divide-by-zero when prior is empty (deltaPct = 0)", () => {
    const v = computeReviewVelocity(
      [reviewAtDaysAgo(1, 5), reviewAtDaysAgo(10, 4)],
      NOW,
    );
    expect(v.priorCount30d).toBe(0);
    expect(v.deltaPct).toBe(0);
  });

  it("returns avg ratings rounded to 2dp + signed ratingDelta", () => {
    const v = computeReviewVelocity(
      [
        reviewAtDaysAgo(5, 5),
        reviewAtDaysAgo(10, 4),
        reviewAtDaysAgo(40, 4),
        reviewAtDaysAgo(50, 3),
      ],
      NOW,
    );
    expect(v.recent30dAvgRating).toBe(4.5);
    expect(v.prior30dAvgRating).toBe(3.5);
    expect(v.ratingDelta).toBe(1);
  });
});

describe("classifyVelocityBadge", () => {
  it("returns null when total volume is too low (<6)", () => {
    const v = computeReviewVelocity(
      [reviewAtDaysAgo(5, 5), reviewAtDaysAgo(40, 5)],
      NOW,
    );
    expect(classifyVelocityBadge(v)).toBeNull();
  });

  it("returns 'surge' when delta ≥ +50%", () => {
    const v = computeReviewVelocity(
      [
        ...Array.from({ length: 6 }, (_, i) => reviewAtDaysAgo(i + 1, 5)),
        ...Array.from({ length: 3 }, (_, i) => reviewAtDaysAgo(35 + i, 5)),
      ],
      NOW,
    );
    expect(v.deltaPct).toBe(100);
    expect(classifyVelocityBadge(v)).toBe("surge");
  });

  it("returns 'dip' when delta ≤ -30%", () => {
    const v = computeReviewVelocity(
      [
        ...Array.from({ length: 4 }, (_, i) => reviewAtDaysAgo(i + 1, 4)),
        ...Array.from({ length: 10 }, (_, i) => reviewAtDaysAgo(35 + i, 5)),
      ],
      NOW,
    );
    expect(v.deltaPct).toBe(-60);
    expect(classifyVelocityBadge(v)).toBe("dip");
  });

  it("returns null in the dead zone (-29% .. +49%)", () => {
    const v = computeReviewVelocity(
      [
        ...Array.from({ length: 7 }, (_, i) => reviewAtDaysAgo(i + 1, 4)),
        ...Array.from({ length: 6 }, (_, i) => reviewAtDaysAgo(35 + i, 4)),
      ],
      NOW,
    );
    expect(v.deltaPct).toBe(17);
    expect(classifyVelocityBadge(v)).toBeNull();
  });
});

describe("classifyVelocityTrigger (Phase 8 guards)", () => {
  it("emits SURGE only when recent ≥ 8 AND delta ≥ +50%", () => {
    // recent 12, prior 6 → delta +100%, recent ≥ 8 ✓
    const surge = computeReviewVelocity(
      [
        ...Array.from({ length: 12 }, (_, i) => reviewAtDaysAgo(i + 1, 5)),
        ...Array.from({ length: 6 }, (_, i) => reviewAtDaysAgo(35 + i, 4)),
      ],
      NOW,
    );
    expect(classifyVelocityTrigger(surge)?.kind).toBe("REVIEW_VOLUME_SURGE");

    // recent 7, prior 4 → delta +75% but recent < 8 → skip
    const tooThin = computeReviewVelocity(
      [
        ...Array.from({ length: 7 }, (_, i) => reviewAtDaysAgo(i + 1, 5)),
        ...Array.from({ length: 4 }, (_, i) => reviewAtDaysAgo(35 + i, 4)),
      ],
      NOW,
    );
    expect(classifyVelocityTrigger(tooThin)).toBeNull();
  });

  it("emits DIP only when prior ≥ 5 AND delta ≤ -30%", () => {
    // recent 4, prior 10 → delta -60%, prior ≥ 5 ✓
    const dip = computeReviewVelocity(
      [
        ...Array.from({ length: 4 }, (_, i) => reviewAtDaysAgo(i + 1, 4)),
        ...Array.from({ length: 10 }, (_, i) => reviewAtDaysAgo(35 + i, 5)),
      ],
      NOW,
    );
    expect(classifyVelocityTrigger(dip)?.kind).toBe("REVIEW_VOLUME_DIP");

    // recent 2, prior 4 → -50% but prior < 5 → no trigger (micro-volume guard)
    const microVolume = computeReviewVelocity(
      [
        ...Array.from({ length: 2 }, (_, i) => reviewAtDaysAgo(i + 1, 5)),
        ...Array.from({ length: 4 }, (_, i) => reviewAtDaysAgo(35 + i, 5)),
      ],
      NOW,
    );
    expect(classifyVelocityTrigger(microVolume)).toBeNull();
  });

  it("returns null in the dead zone matching the badge dead zone", () => {
    const v = computeReviewVelocity(
      [
        ...Array.from({ length: 7 }, (_, i) => reviewAtDaysAgo(i + 1, 4)),
        ...Array.from({ length: 6 }, (_, i) => reviewAtDaysAgo(35 + i, 4)),
      ],
      NOW,
    );
    expect(classifyVelocityTrigger(v)).toBeNull();
  });

  it("scales DIP severity higher than SURGE (dip is the stronger buying signal)", () => {
    const dip = computeReviewVelocity(
      [
        ...Array.from({ length: 2 }, (_, i) => reviewAtDaysAgo(i + 1, 4)),
        ...Array.from({ length: 8 }, (_, i) => reviewAtDaysAgo(35 + i, 5)),
      ],
      NOW,
    );
    const surge = computeReviewVelocity(
      [
        ...Array.from({ length: 12 }, (_, i) => reviewAtDaysAgo(i + 1, 5)),
        ...Array.from({ length: 6 }, (_, i) => reviewAtDaysAgo(35 + i, 4)),
      ],
      NOW,
    );
    const dipResult = classifyVelocityTrigger(dip);
    const surgeResult = classifyVelocityTrigger(surge);
    expect(dipResult?.severity ?? 0).toBeGreaterThan(
      surgeResult?.severity ?? 0,
    );
  });
});
