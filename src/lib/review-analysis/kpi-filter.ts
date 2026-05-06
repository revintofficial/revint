/**
 * Beta finding §2/§3 — shared KPI post-process filter.
 *
 * Applied identically by:
 *   - `src/lib/agent-workers/review-analyst.ts` (AI Core path)
 *   - `src/lib/review-analysis/run-job.ts` (legacy BullMQ path)
 *
 * Round 2 §3.10 / §3.11 hardening pass:
 *
 *   1. Pool floor. If the rating-banded pool that produced this side of
 *      the analysis is too small, no KPI on that side survives.
 *      Defaults: weakness ≥3 negative reviews, strength ≥5 positive.
 *      S.O.S Coffee Camden's 14-review sample (1 negative review)
 *      previously emitted "Expensive 100%" — now drops at the gate.
 *
 *   2. Count integrity. Gemini sometimes inflates `count` past the pool
 *      size on the same side ("Rude Staff appears in 3 of 1 negative
 *      reviews"). We treat that as a hallucination and drop the KPI
 *      rather than silently clamping.
 *
 *   3. Label-fusion gate. A label that fuses two distinct concerns with
 *      `&` / `and` / `/` / `+` (e.g. "Rude Staff & Toilet Access") is
 *      always wrong: even when both happened, they should be two KPIs,
 *      and most of the time only one was in the source. Fused labels
 *      drop, full stop.
 *
 *   4. Label-echo / tiny-example gates. An example that is just a
 *      restatement of the label ("Expensive: This was expensive.") or
 *      shorter than 4 words ("£7.10") carries no real evidence; we
 *      drop those examples before grounding so the survivors-≥2 floor
 *      is honest.
 *
 *   5. Stricter grounding. Tokens-length 1 or 2 was previously enough
 *      to "ground" a phrase against the review corpus (every English
 *      review contains "the" / "is"). Round 2: phrases shorter than 3
 *      tokens are no longer considered grounded — Gemini must produce
 *      a real 3-word window from the source review.
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
 * contiguous substring in any normalized review.
 *
 * Round 2 tightening: phrases shorter than 3 tokens are no longer
 * considered grounded. Single-token "expensive" or 1-token amounts
 * like "£7.10" are too noisy as evidence — they would match almost
 * any English review by accident. Gemini must surface a real 3-word
 * window from the source review for the example to survive.
 */
export function isGroundedInCorpus(phrase: string, corpus: string[]): boolean {
  const tokens = normalizeForGrounding(phrase).split(" ").filter(Boolean);
  if (tokens.length < 3) return false;
  for (let i = 0; i <= tokens.length - 3; i++) {
    const window = tokens.slice(i, i + 3).join(" ");
    if (corpus.some((c) => c.includes(window))) return true;
  }
  return false;
}

// Round 2 §3.10 — fused-label detector. A label that joins two distinct
// concerns with one of these connectors is always rejected: even if
// both occurred, they should be separate KPIs, and most of the time
// only one was actually in the source review.
const LABEL_FUSION_RE = /\s+(?:&|and|\/|\+)\s+/i;

export function isLabelFusion(label: string): boolean {
  return LABEL_FUSION_RE.test(label);
}

// Round 2 §3.10 — example that just echoes the label is not evidence.
// Implementation: strip punctuation + lowercase both sides, confirm the
// label appears as a contiguous substring of the example, then count
// the tokens that remain after the label is removed. An example that
// only adds 0-1 connector words ("expensive" → "very expensive") is
// dropped; an example that contributes ≥2 tokens of real context
// ("slow response" → "had slow response times") survives.
export function isLabelEchoExample(label: string, example: string): boolean {
  const lab = normalizeForGrounding(label);
  const ex = normalizeForGrounding(example);
  if (!lab || !ex) return false;
  if (!ex.includes(lab)) return false;
  const remainder = ex.replace(lab, " ").trim().replace(/\s+/g, " ");
  const remainingTokens = remainder.split(" ").filter(Boolean).length;
  return remainingTokens < 2;
}

// Round 2 §3.10 — a 1-3 word "example" carries no evidence. The S.O.S
// Coffee report's "£7.10" was a single token; "rude" / "expensive" are
// the labels, not the support.
export function isExampleTooShort(example: string): boolean {
  const tokens = normalizeForGrounding(example).split(" ").filter(Boolean);
  return tokens.length < 4;
}

export interface KpiFilterStats {
  inCount: number;
  outCount: number;
  droppedForPoolFloor: number;
  droppedForLowCount: number;
  droppedForCountInflation: number;
  droppedForLabelFusion: number;
  droppedForUngroundedExamples: number;
}

export interface KpiFilterOptions {
  /**
   * Side of the analysis the KPI came from. Drives the pool floor
   * default (weakness=3, strength=5). Defaults to "weakness" so the
   * stricter floor wins if the caller forgets to pass it.
   */
  kind?: "weakness" | "strength";
}

const DEFAULT_POOL_FLOOR = {
  weakness: 3,
  strength: 5,
} as const;

export function filterReviewKpis(
  kpis: ReviewKpi[],
  poolCount: number,
  corpusNormalized: string[],
  opts?: KpiFilterOptions,
): { kpis: ReviewKpi[]; stats: KpiFilterStats } {
  const kind = opts?.kind ?? "weakness";
  const stats: KpiFilterStats = {
    inCount: kpis.length,
    outCount: 0,
    droppedForPoolFloor: 0,
    droppedForLowCount: 0,
    droppedForCountInflation: 0,
    droppedForLabelFusion: 0,
    droppedForUngroundedExamples: 0,
  };

  // §3.10 pool floor — when the rating-banded pool is too small, no
  // KPI on this side is statistically meaningful. Drop them all and
  // record the count for the telemetry dashboard
  // (`review_analyst.dropped_for_pool_floor` per the unified plan).
  const poolFloor = DEFAULT_POOL_FLOOR[kind];
  if (poolCount < poolFloor) {
    stats.droppedForPoolFloor = kpis.length;
    return { kpis: [], stats };
  }

  const out: ReviewKpi[] = [];
  for (const k of kpis) {
    // §3.10 — fused labels are always wrong; drop before any other
    // gate so they don't pollute the example-ground stats.
    if (isLabelFusion(k.label)) {
      stats.droppedForLabelFusion += 1;
      continue;
    }

    // §3.11 — count integrity. Gemini occasionally claims a count
    // larger than the pool itself. That's a hallucination, not a
    // rounding error — drop instead of clamping.
    if ((k.count ?? 0) > poolCount) {
      stats.droppedForCountInflation += 1;
      continue;
    }

    // §3.10 — example filter: drop label echoes, tiny one-token
    // "examples", and ungrounded paraphrases BEFORE the
    // examples ≥ 2 floor. This way the floor only counts examples
    // that actually pass evidence.
    const filteredExamples = (k.examples ?? []).filter(
      (e): e is string => {
        if (typeof e !== "string") return false;
        if (isLabelEchoExample(k.label, e)) return false;
        if (isExampleTooShort(e)) return false;
        if (!isGroundedInCorpus(e, corpusNormalized)) return false;
        return true;
      },
    );

    if (filteredExamples.length < 2) {
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
      examples: filteredExamples.slice(0, 4),
      percent: truePercent,
    });
  }
  stats.outCount = out.length;
  return { kpis: out, stats };
}
