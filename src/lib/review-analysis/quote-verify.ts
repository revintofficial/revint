/**
 * A pain phrase is evidence only when a guest actually wrote it. The
 * model returns verbatim fragments; this keeps the ones found in a real
 * review and counts how many distinct reviews carry one.
 *
 * Counting is done here, never by the model: the model labels each
 * review (`ReviewLabel`), this file checks every quote against the
 * stored review text and counts distinct reviews per category.
 */
import { normalizeForGrounding } from "./kpi-filter";
import {
  UNSELLABLE_CATEGORIES,
  guardPainCategory,
  type PainCategory,
  type PainPhrase,
  type ReviewLabel,
} from "./pain-phrases";

const MIN_QUOTE_WORDS = 3;
const MAX_QUOTES_PER_PHRASE = 5;
/** "Recent" = written in the last 12 months. */
export const RECENT_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;

export interface ReviewRef {
  text: string | null;
  publishTime?: Date | string | null;
}

export interface CategoryCount {
  /** Distinct reviews with a verified quote for this category. */
  mentions: number;
  /** Of those, written in the last 12 months. `null` = no review carries a date. */
  recentMentions: number | null;
  /** Verified quotes, newest review first. */
  quotes: string[];
}

export interface LabelCounts {
  /** Distinct reviews with at least one verified complaint, any category, any star rating. */
  complaintReviews: number;
  byCategory: Partial<Record<PainCategory, CategoryCount>>;
}

function toRefs(reviews: ReadonlyArray<string | null | ReviewRef>): ReviewRef[] {
  return reviews.map((r) => (r !== null && typeof r === "object" ? r : { text: r }));
}

function timeOf(ref: ReviewRef): number | null {
  if (!ref.publishTime) return null;
  const t = ref.publishTime instanceof Date ? ref.publishTime.getTime() : Date.parse(ref.publishTime);
  return Number.isFinite(t) ? t : null;
}

function recentCount(indexes: Iterable<number>, refs: ReviewRef[], now: Date): number | null {
  let dated = false;
  let recent = 0;
  for (const i of indexes) {
    const t = timeOf(refs[i]);
    if (t === null) continue;
    dated = true;
    if (now.getTime() - t <= RECENT_WINDOW_MS) recent += 1;
  }
  return dated ? recent : null;
}

/**
 * Count the model's per-review labels. A label counts only when its
 * quote is found in a stored review (the numbered one first, any review
 * otherwise: the model sometimes miscounts the index). One review
 * counts once per category.
 */
export function countReviewLabels(
  labels: readonly ReviewLabel[],
  reviews: ReadonlyArray<string | null | ReviewRef>,
  now: Date = new Date(),
): LabelCounts {
  const refs = toRefs(reviews);
  const corpus = refs.map((r) => normalizeForGrounding(r.text ?? ""));
  const byCategory = new Map<PainCategory, Map<number, string>>();
  const complaints = new Set<number>();

  for (const label of labels) {
    const needle = normalizeForGrounding(label.quote);
    if (needle.split(" ").length < MIN_QUOTE_WORDS) continue;
    const numbered = label.i - 1;
    const at = corpus[numbered]?.includes(needle) ? numbered : corpus.findIndex((c) => c.includes(needle));
    if (at === -1) continue;
    const category = guardPainCategory(label.category, label.quote) ?? label.category;
    complaints.add(at);
    const seen = byCategory.get(category) ?? new Map<number, string>();
    if (!seen.has(at)) seen.set(at, label.quote.trim());
    byCategory.set(category, seen);
  }

  const out: LabelCounts = { complaintReviews: complaints.size, byCategory: {} };
  for (const [category, seen] of byCategory) {
    const indexes = [...seen.keys()].sort((a, b) => a - b);
    out.byCategory[category] = {
      mentions: indexes.length,
      recentMentions: recentCount(indexes, refs, now),
      quotes: indexes.map((i) => seen.get(i)!),
    };
  }
  return out;
}

export function verifyPainQuotes(
  phrases: PainPhrase[],
  reviews: ReadonlyArray<string | null | ReviewRef>,
  now: Date = new Date(),
): PainPhrase[] {
  const refs = toRefs(reviews);
  const corpus = refs.map((r) => normalizeForGrounding(r.text ?? ""));
  return phrases.map((p) => {
    const found = new Set<number>();
    const kept: string[] = [];
    for (const quote of p.quotes ?? []) {
      const needle = normalizeForGrounding(quote);
      if (needle.split(" ").length < MIN_QUOTE_WORDS) continue;
      const at = corpus.findIndex((c) => c.includes(needle));
      if (at === -1 || found.has(at)) continue;
      found.add(at);
      kept.push(quote.trim());
    }
    const recent = recentCount(found, refs, now);
    return { ...p, quotes: kept, mentions: found.size, ...(recent !== null ? { recentMentions: recent } : {}) };
  });
}

/**
 * Put the code-side counts on the phrases. A phrase takes its
 * category's count when that is larger than its own verified quotes
 * (the model lists at most five quotes per phrase). A sellable category
 * the labels found in two or more reviews but no phrase mentions gets a
 * phrase of its own, so Room 1 never misses a counted complaint.
 */
export function mergeLabelCounts(phrases: PainPhrase[], counts: LabelCounts): PainPhrase[] {
  if (counts.complaintReviews === 0) return phrases;
  const covered = new Set<PainCategory>();
  const out = phrases.map((p) => {
    const c = p.category ? counts.byCategory[p.category] : undefined;
    if (!p.category || !c) return { ...p, complaintReviews: counts.complaintReviews };
    covered.add(p.category);
    const own = p.mentions ?? 0;
    const quotes = [...new Set([...(p.quotes ?? []), ...c.quotes])].slice(0, MAX_QUOTES_PER_PHRASE);
    return {
      ...p,
      quotes,
      mentions: Math.max(own, c.mentions),
      ...(c.recentMentions !== null ? { recentMentions: Math.max(p.recentMentions ?? 0, c.recentMentions) } : {}),
      complaintReviews: counts.complaintReviews,
    };
  });
  for (const [category, c] of Object.entries(counts.byCategory) as Array<[PainCategory, CategoryCount]>) {
    if (covered.has(category) || c.mentions < 2 || UNSELLABLE_CATEGORIES.has(category)) continue;
    if (category === "other" || category === "wait") continue;
    out.push({
      text: c.quotes[0],
      sellable: true,
      category,
      quotes: c.quotes.slice(0, MAX_QUOTES_PER_PHRASE),
      mentions: c.mentions,
      ...(c.recentMentions !== null ? { recentMentions: c.recentMentions } : {}),
      complaintReviews: counts.complaintReviews,
    });
  }
  return out;
}
