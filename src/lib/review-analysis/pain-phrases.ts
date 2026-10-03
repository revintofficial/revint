/**
 * Pain phrase shape shared by REVIEW_ANALYST (writer) and every reader
 * of `ReviewAnalysis.painPhrases`.
 *
 * New rows store `Array<{ text: string; sellable: boolean }>`. Rows
 * written before Task 2 store `string[]`. Readers go through
 * `normalizePainPhrases` / `painPhraseTexts` so both shapes work.
 *
 * `sellable` answers "can FineDine sell against this complaint?".
 * Taste and food poisoning are never a sales angle (no product fixes
 * them, and quoting them to an owner is an insult). Waiting,
 * reservations, order errors and the bill are.
 */

/**
 * Closed set the analyst assigns; Room 1 maps these onto wedges
 * (`CATEGORY_WEDGE` in head-agent.ts). The split that matters: what a
 * guest-facing ordering / payment / booking product fixes (`bill`,
 * `order_wait`, `order_error`, `reservation`, `table_wait`, `delivery`,
 * `menu`) versus what it does not (`kitchen_wait`, `price`,
 * `food_quality`, `staff`, `ambiance`). Waiting is two categories on
 * purpose: a queue for a table is a booking problem, slow food is the
 * kitchen's (docs/research/2026-10-03-playbook-research.md, Q2).
 */
export const PAIN_CATEGORIES = [
  "bill",
  "order_wait",
  "order_error",
  "reservation",
  "table_wait",
  "delivery",
  "menu",
  "repeat",
  "language",
  "kitchen_wait",
  "price",
  "food_quality",
  "staff",
  "ambiance",
  "other",
] as const;
export type PainCategory = (typeof PAIN_CATEGORIES)[number];

/** Never a sales angle, whatever the model said about `sellable`. */
export const UNSELLABLE_CATEGORIES: ReadonlySet<PainCategory> = new Set<PainCategory>([
  "kitchen_wait",
  "price",
  "food_quality",
  "staff",
  "ambiance",
  "other",
]);

export type PainPhrase = {
  text: string;
  sellable: boolean;
  category?: PainCategory;
  /** Verbatim review fragments. After `verifyPainQuotes`: only the ones found in a real review. */
  quotes?: string[];
  /** Distinct reviews carrying this complaint (verified quotes or verified per-review labels). */
  mentions?: number;
  /** Of those, how many were written in the last 12 months. Missing = dates unknown. */
  recentMentions?: number;
  /** Of those, how many were written in the last 24 months. Missing = dates unknown. */
  recent24Mentions?: number;
  /** Distinct reviews with any verified complaint: the denominator for `mentions`. */
  complaintReviews?: number;
};

/** One complaint the model found in one numbered review. Counting is done in code. */
export type ReviewLabel = { i: number; category: PainCategory; quote: string };

const PRICE_WORDS =
  /(\bexpensive\b|overpriced|\bpric(e|es|ey|ed|ing)\b|\bcost(s|ly)?\b|astronomical|rip[- ]?off|value for money|not worth|worth what|overcharg|too much money|\btax(es)?\b|service charge|pahal[ıi]|fiyat|kaz[ıi]k|fazla öde)/i;
const BILL_PROCESS =
  /(\bwait|\btook\b|\bages\b|forever|\bminutes?\b|\bmins?\b|\bchas(e|ed|ing)\b|ask(ed)? (for|twice|three|several)|never (came|arrived|brought)|card (machine|reader)|\bsplit|bekle|dakika|kart makines|hesab[ıi] (iste|böl)|gelmedi)/i;
const ORDER_ERROR =
  /(add(ed|ing)?\b.{0,30}\b(to|on) (my|our|the) bill|wrong (item|dish|order|food)|charged (us |me )?for .{0,40}(didn'?t|never|not) (order|have|get|receive)|yanl[ıi]ş (sipariş|ürün)|hesaba .{0,20}ekle)/i;

/**
 * Deterministic guard over the model's category. A "bill" complaint
 * that is really about the amount ("the bill was astronomically high",
 * "paying by card adds tax") is `price`; items put on the bill that
 * were never ordered are `order_error`. Waiting for the bill, the card
 * machine and splitting stay `bill`.
 */
export function guardPainCategory(
  category: PainCategory | undefined,
  text: string,
  quotes: readonly string[] = [],
): PainCategory | undefined {
  if (category !== "bill") return category;
  const blob = [text, ...quotes].join(" ");
  if (ORDER_ERROR.test(blob)) return "order_error";
  if (PRICE_WORDS.test(blob) && !BILL_PROCESS.test(blob)) return "price";
  return category;
}

/** Read-side shape: legacy string rows have unknown sellability. */
export type StoredPainPhrase = { text: string; sellable: boolean | null };

// Taste / food-quality / poisoning — never sellable, wins over ops words
// ("waited an hour and the food was bland" is still a taste complaint).
const NOT_SELLABLE =
  /\b(bland|tasteless|flavou?r\w*|tast(e|ed|es|y|ing)|salty|greasy|oily|undercooked|overcooked|burnt|stale|soggy|disgusting|inedible|food poisoning|poison\w*|got sick|fell ill|sick after|vomit\w*|diarrh\w*|stomach|lezzet\w*|tats[ıi]z\w*|tuzlu|bayat|zehirlen\w*|midem)\b/i;

// Operational pains a restaurant-tech product addresses.
const SELLABLE =
  /\b(wait\w*|queue\w*|slow|took (ages|forever|so long|too long)|reserv\w*|booking\w*|booked|table|order\w*|wrong (dish|item|food)|forgot|bill|check|card machine|rezervasyon\w*|sipari\w*|hesab?\w*|bekle\w*|s[ıi]ra)\b/i;

/**
 * Deterministic guard over the model's `sellable` flag. Taste /
 * poisoning is forced to `false`; clear operational pains are forced
 * to `true`; anything else keeps the model's call.
 */
export function isSellablePainText(text: string, modelSellable: boolean): boolean {
  if (NOT_SELLABLE.test(text)) return false;
  if (SELLABLE.test(text)) return true;
  return modelSellable;
}

/**
 * Coerce whatever Gemini returned (objects on the new schema, bare
 * strings on the old one) into `PainPhrase[]`, applying the guard.
 */
export function toPainPhrases(raw: unknown): PainPhrase[] {
  if (!Array.isArray(raw)) return [];
  const out: PainPhrase[] = [];
  for (const item of raw) {
    let text = "";
    let modelSellable = false;
    let category: PainCategory | undefined;
    let quotes: string[] = [];
    if (typeof item === "string") {
      text = item;
    } else if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      text = typeof o.text === "string" ? o.text : typeof o.phrase === "string" ? o.phrase : "";
      modelSellable = o.sellable === true;
      if (typeof o.category === "string" && (PAIN_CATEGORIES as readonly string[]).includes(o.category)) {
        category = o.category as PainCategory;
      }
      if (Array.isArray(o.quotes)) {
        quotes = o.quotes.filter((q): q is string => typeof q === "string" && q.trim() !== "").slice(0, 5);
      }
    }
    text = text.trim();
    if (!text) continue;
    category = guardPainCategory(category, text, quotes);
    const sellable = category && UNSELLABLE_CATEGORIES.has(category) ? false : isSellablePainText(text, modelSellable);
    out.push({ text, sellable, ...(category ? { category } : {}), quotes });
  }
  return out;
}

const MAX_REVIEW_LABELS = 600;

/** Coerce the model's per-review labels; anything malformed is dropped. */
export function toReviewLabels(raw: unknown): ReviewLabel[] {
  if (!Array.isArray(raw)) return [];
  const out: ReviewLabel[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const i = typeof o.i === "number" ? Math.floor(o.i) : Number.NaN;
    const quote = typeof o.quote === "string" ? o.quote.trim() : "";
    if (!Number.isFinite(i) || i < 1 || !quote) continue;
    if (typeof o.category !== "string" || !(PAIN_CATEGORIES as readonly string[]).includes(o.category)) continue;
    out.push({ i, category: o.category as PainCategory, quote });
    if (out.length >= MAX_REVIEW_LABELS) break;
  }
  return out;
}

/** Read a stored `painPhrases` column (either shape). */
export function normalizePainPhrases(raw: unknown): StoredPainPhrase[] {
  if (!Array.isArray(raw)) return [];
  const out: StoredPainPhrase[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      if (item.trim()) out.push({ text: item, sellable: null });
      continue;
    }
    if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      const text = typeof o.text === "string" ? o.text : typeof o.phrase === "string" ? o.phrase : "";
      if (!text.trim()) continue;
      out.push({ text, sellable: typeof o.sellable === "boolean" ? o.sellable : null });
    }
  }
  return out;
}

/** Just the phrase texts, for readers that only need strings. */
export function painPhraseTexts(raw: unknown): string[] {
  return normalizePainPhrases(raw).map((p) => p.text);
}
