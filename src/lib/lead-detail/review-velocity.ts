/**
 * Review velocity — shared rolling-window math.
 *
 * One source of truth for "recent 30d vs prior 30d" review counts and
 * average ratings, per PLAN §6 risk #20: the Phase 3 derived
 * `ReviewVelocityBadge` and the Phase 8 `REVIEW_VOLUME_*` trigger row
 * MUST agree on the same lead. They do, because they both call this.
 *
 * Used by:
 *   - `/api/leads/[id]/decision-surface` aggregator → `reviewVelocity`
 *     summary field.
 *   - `ReviewVelocityBadge` component → display thresholds.
 *   - `src/lib/agent-workers/trigger-detector.ts` (Phase 8 review-volume
 *     rule) → `REVIEW_VOLUME_SURGE` / `_DIP` detection.
 *
 * Pure function. Same input always produces same output. No DB I/O,
 * no clock reads (caller passes `now` so the test matrix is
 * deterministic).
 */
export interface ReviewWindowInput {
  rating: number;
  publishTime: Date;
}

export interface ReviewVelocity {
  /** Reviews published in the last 30 days. */
  recentCount30d: number;
  /** Reviews published in the prior 30 days (days 31-60). */
  priorCount30d: number;
  /**
   * Percent change vs prior window. `+100` = doubled, `-50` = halved.
   * Returns `0` when prior is 0 (avoid divide-by-zero — surge with
   * no baseline is "infinite", not a usable percentage).
   */
  deltaPct: number;
  /** Mean rating of the recent-30d bucket. `null` if bucket empty. */
  recent30dAvgRating: number | null;
  /** Mean rating of the prior-30d bucket. `null` if bucket empty. */
  prior30dAvgRating: number | null;
  /**
   * `recentAvg - priorAvg`. Negative = stars dropped vs prior window.
   * `null` if either bucket is empty (no comparison possible).
   */
  ratingDelta: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Compute rolling 30-day windows over the supplied review corpus.
 *
 * The caller is responsible for fetching the rows (the trigger detector
 * pre-loads them via the executor's `requiredIncludes.googleReviews`;
 * the aggregator reuses the same rows it fetches for BANT timing input).
 * We never touch the DB here — pure math.
 */
export function computeReviewVelocity(
  reviews: ReadonlyArray<ReviewWindowInput>,
  now: Date = new Date(),
): ReviewVelocity {
  const nowMs = now.getTime();
  const recent: ReviewWindowInput[] = [];
  const prior: ReviewWindowInput[] = [];

  for (const r of reviews) {
    const age = nowMs - r.publishTime.getTime();
    if (age < 0) continue; // future-dated rows are noise; ignore
    if (age <= 30 * DAY_MS) {
      recent.push(r);
    } else if (age <= 60 * DAY_MS) {
      prior.push(r);
    }
  }

  const recent30dAvgRating =
    recent.length > 0
      ? Number(
          (recent.reduce((s, r) => s + r.rating, 0) / recent.length).toFixed(2),
        )
      : null;
  const prior30dAvgRating =
    prior.length > 0
      ? Number(
          (prior.reduce((s, r) => s + r.rating, 0) / prior.length).toFixed(2),
        )
      : null;

  const ratingDelta =
    recent30dAvgRating != null && prior30dAvgRating != null
      ? Number((recent30dAvgRating - prior30dAvgRating).toFixed(2))
      : null;

  // Avoid divide-by-zero. When prior is 0 we can't compute a percent —
  // 0 keeps the badge dormant; the trigger detector has its own
  // `prior30dCount >= 5` guard for the surge rule so a 0-baseline
  // never falsely fires.
  const deltaPct =
    prior.length > 0
      ? Math.round(((recent.length - prior.length) / prior.length) * 100)
      : 0;

  return {
    recentCount30d: recent.length,
    priorCount30d: prior.length,
    deltaPct,
    recent30dAvgRating,
    prior30dAvgRating,
    ratingDelta,
  };
}

/**
 * UI threshold helper — returns "surge" / "dip" / null per the Phase 3
 * `ReviewVelocityBadge` rules from PLAN §4 (Phase 3 demo-able outcome).
 *
 * `null` when no badge should render. The thresholds intentionally
 * differ from the Phase 8 detector's stricter guards (which add
 * `recent30dCount >= 8` / `priorCount30d >= 5` to prevent
 * micro-volume false positives). The badge is presentational; the
 * trigger row is durable signal.
 */
export type ReviewVelocityBadgeKind = "surge" | "dip";

export function classifyVelocityBadge(
  v: ReviewVelocity,
): ReviewVelocityBadgeKind | null {
  if (v.recentCount30d + v.priorCount30d < 6) return null;
  if (v.deltaPct >= 50) return "surge";
  if (v.deltaPct <= -30) return "dip";
  return null;
}

/**
 * Phase 8 detector thresholds. Tighter than the badge thresholds —
 * see PLAN §4 Phase 8 fixture matrix and the false-positive guards
 * in PLAN §6 risk #19.
 */
export interface ReviewVelocityTriggerKind {
  kind: "REVIEW_VOLUME_SURGE" | "REVIEW_VOLUME_DIP";
  /** Severity 0..100 mapped from delta magnitude. */
  severity: number;
}

export function classifyVelocityTrigger(
  v: ReviewVelocity,
): ReviewVelocityTriggerKind | null {
  if (v.recentCount30d + v.priorCount30d < 6) return null;
  // Surge: needs both a >= +50% jump AND >= 8 absolute recent reviews.
  if (v.deltaPct >= 50 && v.recentCount30d >= 8) {
    return {
      kind: "REVIEW_VOLUME_SURGE",
      // Severity scales with delta magnitude, capped at 80 (a +400%
      // surge is impressive but not catastrophic-priority).
      severity: Math.min(80, Math.round(40 + v.deltaPct / 5)),
    };
  }
  // Dip: needs both a <= -30% drop AND >= 5 prior reviews (so a
  // 5→2 micro-business doesn't fire).
  if (v.deltaPct <= -30 && v.priorCount30d >= 5) {
    return {
      kind: "REVIEW_VOLUME_DIP",
      // Severity scales with magnitude. Dip is treated as the stronger
      // buying signal (operations gap → SDR opening) so the floor is
      // higher than surge's.
      severity: Math.min(95, Math.round(60 + Math.abs(v.deltaPct) / 3)),
    };
  }
  return null;
}
