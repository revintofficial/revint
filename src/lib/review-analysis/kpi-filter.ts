/**
 * Beta finding §2/§3 — shared KPI post-process filter.
 *
 * Applied identically by:
 *   - `src/lib/agent-workers/review-analyst.ts` (AI Core path)
 *   - `src/lib/review-analysis/run-job.ts` (legacy BullMQ path)
 *
 * Two failure modes this guards against:
 *
 *   1. Single-review KPIs. A 5-review sample where one reviewer says
 *      "rude staff" makes Gemini happily emit `Rude Staff 20%`. With
 *      `count` and `examples ≥ 2` the bar disappears, which is the
 *      honest answer for "we don't have enough evidence".
 *
 *   2. Hallucinated examples. Gemini sometimes paraphrases the source
 *      review rather than quoting it verbatim — the cold-outreach copy
 *      then includes a pain phrase the reviewer never wrote, which is
 *      unrecoverable embarrassing. Each example must contain at least a
 *      3-word window from one of the actual review texts before it
 *      survives this filter.
 *
 * The function additionally re-derives `percent` from the true
 * negative/positive pool size — Gemini's percent field is a frequent
 * miss on small samples, and a server-side correction is cheaper than
 * teaching the model to do it consistently.
 */

import type { ReviewKpi } from "@/lib/prompts/review-analysis-prompt";

/**
 * Strips punctuation, lowercases, and collapses whitespace. Identical
 * to the pain-phrase grounding helper in `review-analyst.ts`; we
 * duplicate it here rather than re-export so this module is dependency-
 * free for the legacy path.
 */
export function normalizeForGrounding(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\p{Diacritic}]/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Returns true when any 3-word window of `phrase` appears as a
 * contiguous substring in any normalized review. Mirrors
 * review-analyst.ts; see comment block there for the rationale.
 */
export function isGroundedInCorpus(phrase: string, corpus: string[]): boolean {
  const tokens = normalizeForGrounding(phrase).split(" ").filter(Boolean);
  if (tokens.length === 0) return false;
  if (tokens.length <= 2) {
    return corpus.some((c) => c.includes(tokens.join(" ")));
  }
  for (let i = 0; i <= tokens.length - 3; i++) {
    const window = tokens.slice(i, i + 3).join(" ");
    if (corpus.some((c) => c.includes(window))) return true;
  }
  return false;
}

export interface KpiFilterStats {
  inCount: number;
  outCount: number;
  droppedForLowCount: number;
  droppedForUngroundedExamples: number;
}

export function filterReviewKpis(
  kpis: ReviewKpi[],
  poolCount: number,
  corpusNormalized: string[],
): { kpis: ReviewKpi[]; stats: KpiFilterStats } {
  const stats: KpiFilterStats = {
    inCount: kpis.length,
    outCount: 0,
    droppedForLowCount: 0,
    droppedForUngroundedExamples: 0,
  };
  const out: ReviewKpi[] = [];
  for (const k of kpis) {
    const groundedExamples = (k.examples ?? []).filter(
      (e): e is string =>
        typeof e === "string" && isGroundedInCorpus(e, corpusNormalized),
    );
    if (groundedExamples.length < 2) {
      stats.droppedForUngroundedExamples += 1;
      continue;
    }
    if ((k.count ?? 0) < 2) {
      stats.droppedForLowCount += 1;
      continue;
    }
    const truePercent =
      poolCount > 0
        ? Math.max(0, Math.min(100, Math.round((k.count / poolCount) * 100)))
        : 0;
    out.push({
      ...k,
      examples: groundedExamples.slice(0, 4),
      percent: truePercent,
    });
  }
  stats.outCount = out.length;
  return { kpis: out, stats };
}
