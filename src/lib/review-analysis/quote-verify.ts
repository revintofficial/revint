/**
 * A pain phrase is evidence only when a guest actually wrote it. The
 * model returns verbatim fragments; this keeps the ones found in a real
 * review and counts how many distinct reviews carry one.
 */
import { normalizeForGrounding } from "./kpi-filter";
import type { PainPhrase } from "./pain-phrases";

const MIN_QUOTE_WORDS = 3;

export function verifyPainQuotes(phrases: PainPhrase[], reviewTexts: Array<string | null>): PainPhrase[] {
  const corpus = reviewTexts.map((t) => normalizeForGrounding(t ?? ""));
  return phrases.map((p) => {
    const reviews = new Set<number>();
    const kept: string[] = [];
    for (const quote of p.quotes ?? []) {
      const needle = normalizeForGrounding(quote);
      if (needle.split(" ").length < MIN_QUOTE_WORDS) continue;
      const at = corpus.findIndex((c) => c.includes(needle));
      if (at === -1 || reviews.has(at)) continue;
      reviews.add(at);
      kept.push(quote.trim());
    }
    return { ...p, quotes: kept, mentions: reviews.size };
  });
}
