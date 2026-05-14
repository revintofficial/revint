/**
 * Truth Layer contract — `SeverityScore` + base-rate normalisation.
 *
 * Producer: T-C Evidence Calibration.
 * Consumers: T-D Brief Grounding, EvidenceChip, trigger-detector.
 *
 * `normalizeSeverity` is the canonical formula for collapsing a raw
 * negative-review count into a 0..100 severity. The point is to STOP
 * surfacing "9/11 reviews mention wait time = 82% pain" as if 82% of
 * the operator's customers are unhappy — when the operator has 397
 * total reviews, 11 negatives is statistical background noise and 9
 * mentions is ~2% of the relevant denominator, not 82%.
 *
 * Formula (with rationale baked into the comments):
 *   - `negRatio = negCount / max(totalCount, 1)` is the operator-level
 *     base rate of negative reviews.
 *   - `mentionRatio = mentionCount / max(negCount, 1)` is the within-
 *     negatives concentration (the "82% of negatives mention this").
 *   - `severity = baseSeverity * negRatio * mentionRatio * recencyDecay
 *                 * visibilityFactor`
 *   - `recencyDecay = clamp(1 - recentDaysOld / 365, 0.2, 1)` so
 *     a 6-month-old wave matters less than last week's.
 *   - `visibilityFactor` defaults to 1; bump to 1.5 for high-traffic
 *     leads (review surface is more visible to other prospects).
 *
 * Output is `0..100`. Never returns NaN — guards against zero denoms.
 */

export const __contractVersion = 1;

export type SeverityScore = number;

export interface SeverityCalcInput {
  /** 0..100 — the raw "how bad is the underlying claim" judgment. */
  baseSeverity: number;
  /** Count of reviews that mention the specific claim. */
  mentionCount: number;
  /** Count of all negative reviews in the corpus. */
  negCount: number;
  /** Count of all reviews in the corpus (negative + neutral + positive). */
  totalCount: number;
  /** How old the most-recent matching review is, in days. */
  recentDaysOld: number;
  /** 1.0 default; 1.5 for high-traffic operators (>1k reviews). */
  visibilityFactor?: number;
}

function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

export function normalizeSeverity(input: SeverityCalcInput): SeverityScore {
  const total = Math.max(input.totalCount, 1);
  const negs = Math.max(input.negCount, 1);
  const negRatio = clamp(input.negCount / total, 0, 1);
  const mentionRatio = clamp(input.mentionCount / negs, 0, 1);
  const recencyDecay = clamp(1 - input.recentDaysOld / 365, 0.2, 1);
  const visibility = input.visibilityFactor ?? 1;
  const raw =
    input.baseSeverity * negRatio * mentionRatio * recencyDecay * visibility;
  return Math.round(clamp(raw, 0, 100));
}
