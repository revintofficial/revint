/**
 * Truth Layer contract — `SwitchSignal` + `SwitchDirection`.
 *
 * Producer: T-C Evidence Calibration (`src/lib/agent-workers/review-analyst.ts`).
 * Consumers: T-F NBA Hygiene, ReviewIntelligenceSummary, trigger-detector.
 *
 * "Switch direction" disambiguates the very ambiguous v1 `switchSignals[]`
 * Json column. v1 stored a flat string array of phrases; reviewers use
 * "X is way better than us" (inbound — they're considering switching TO us)
 * vs "we used to use X but moved" (outbound — they already switched AWAY).
 * Treating these the same caused trigger-detector to fire COMPETITOR_PRESSURE
 * on inbound signals (which is a positive intent signal, not a threat).
 *
 * The `direction` field is added to the `ReviewSwitchSignal` row by T-C
 * (W1 schema delta #5). Legacy rows backfill to `null` and the consumer
 * MUST treat null as "comparison_neutral".
 */

import type { SeverityScore } from "./severity";

export const __contractVersion = 1;

export type SwitchDirection =
  | "inbound" // Reviewer is moving TOWARD the prospect's category
  | "outbound" // Reviewer left the prospect's brand
  | "comparison_neutral"; // Mention without directional intent

export interface SwitchSignal {
  competitor: string;
  direction: SwitchDirection;
  quote: string;
  reviewId: string;
  severity: SeverityScore;
}
