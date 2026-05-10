/**
 * Predicted-vs-real objection diff — pure helper.
 *
 * Buckets a lead's predicted-objection list (`LeadNextAction.
 * predictedObjections String[]`) against the real `Objection` rows
 * (`source: REAL`) into three audit-friendly groups for the v2
 * HISTORY block:
 *
 *   - `predictedAndReal`  — the planner predicted it AND the customer
 *     raised it. If a rebuttal was used, the bar shows it landed.
 *   - `predictedNotReal`  — predicted but never came up. Useful so
 *     the rep stops rehearsing rebuttals to ghosts.
 *   - `realOnly`          — the customer raised it but the planner
 *     missed it. Inline `[+ rebuttal]` capture surfaces here.
 *
 * Match heuristic: case-insensitive token-overlap > 0.5. Either side
 * tokenises by word boundary, removes English/Turkish stopwords, and
 * compares token-set Jaccard. Stricter than substring but still
 * forgiving of "we use Rappel" vs "Rappel is our incumbent". Phase 2
 * does NOT call Gemini for similarity — that would re-introduce the
 * "no new Gemini-calling endpoint" rule the plan explicitly forbids.
 */

export interface PredictedObjectionInput {
  text: string;
}

export interface RealObjectionInput {
  id: string;
  text: string;
  rebuttalUsed: string | null;
  resolvedAt: Date | string | null;
  category: string | null;
}

export interface PredictedAndRealRow {
  predicted: string;
  real: {
    id: string;
    text: string;
    rebuttalUsed: string | null;
    resolved: boolean;
  };
}

export interface PredictedNotRealRow {
  predicted: string;
}

export interface RealOnlyRow {
  id: string;
  text: string;
  rebuttalUsed: string | null;
  resolved: boolean;
  category: string | null;
}

export interface ObjectionDiff {
  predictedAndReal: PredictedAndRealRow[];
  predictedNotReal: PredictedNotRealRow[];
  realOnly: RealOnlyRow[];
}

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "we",
  "our",
  "us",
  "is",
  "are",
  "was",
  "were",
  "to",
  "of",
  "for",
  "with",
  "on",
  "at",
  "in",
  "from",
  "by",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "as",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "not",
  "no",
  "yes",
  // TR stopwords
  "ve",
  "veya",
  "ile",
  "bir",
  "bu",
  "şu",
  "o",
  "biz",
  "siz",
  "onlar",
  "için",
  "değil",
  "var",
  "yok",
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]+/gu, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOPWORDS.has(t)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  const union = a.size + b.size - intersection;
  if (union === 0) return 0;
  return intersection / union;
}

const SIMILARITY_THRESHOLD = 0.5;

export function deriveObjectionDiff(
  predicted: PredictedObjectionInput[] | string[],
  real: RealObjectionInput[],
): ObjectionDiff {
  const predNormalized: PredictedObjectionInput[] = predicted.map((p) =>
    typeof p === "string" ? { text: p } : p,
  );

  const predTokens = predNormalized.map((p) => ({
    raw: p.text,
    tokens: tokenize(p.text),
  }));
  const realTokens = real.map((r) => ({
    raw: r,
    tokens: tokenize(r.text),
  }));

  const matchedRealIds = new Set<string>();
  const matchedPredIdx = new Set<number>();

  const predictedAndReal: PredictedAndRealRow[] = [];

  for (let i = 0; i < predTokens.length; i += 1) {
    const p = predTokens[i];
    let best: { idx: number; score: number } | null = null;
    for (let j = 0; j < realTokens.length; j += 1) {
      if (matchedRealIds.has(realTokens[j].raw.id)) continue;
      const score = jaccard(p.tokens, realTokens[j].tokens);
      if (score >= SIMILARITY_THRESHOLD && (best == null || score > best.score)) {
        best = { idx: j, score };
      }
    }
    if (best != null) {
      const r = realTokens[best.idx].raw;
      predictedAndReal.push({
        predicted: p.raw,
        real: {
          id: r.id,
          text: r.text,
          rebuttalUsed: r.rebuttalUsed,
          resolved: r.resolvedAt != null,
        },
      });
      matchedRealIds.add(r.id);
      matchedPredIdx.add(i);
    }
  }

  const predictedNotReal: PredictedNotRealRow[] = predTokens
    .map((p, i) => ({ raw: p.raw, i }))
    .filter((row) => !matchedPredIdx.has(row.i))
    .map((row) => ({ predicted: row.raw }));

  const realOnly: RealOnlyRow[] = realTokens
    .filter((r) => !matchedRealIds.has(r.raw.id))
    .map((r) => ({
      id: r.raw.id,
      text: r.raw.text,
      rebuttalUsed: r.raw.rebuttalUsed,
      resolved: r.raw.resolvedAt != null,
      category: r.raw.category,
    }));

  return { predictedAndReal, predictedNotReal, realOnly };
}
