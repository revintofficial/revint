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

export type PainPhrase = { text: string; sellable: boolean };

/** Read-side shape: legacy string rows have unknown sellability. */
export type StoredPainPhrase = { text: string; sellable: boolean | null };

// Taste / food-quality / poisoning — never sellable, wins over ops words
// ("waited an hour and the food was bland" is still a taste complaint).
const NOT_SELLABLE =
  /\b(bland|tasteless|flavou?r\w*|tast(e|ed|es|y|ing)|salty|greasy|oily|undercooked|overcooked|burnt|stale|soggy|disgusting|inedible|food poisoning|poison\w*|got sick|fell ill|sick after|vomit\w*|diarrh\w*|stomach|lezzet\w*|tats[ıi]z\w*|tuzlu|bayat|zehirlen\w*|midem)\b/i;

// Operational pains a restaurant-tech product addresses.
const SELLABLE =
  /\b(wait\w*|queue\w*|slow|took (ages|forever|so long|too long)|reserv\w*|booking\w*|booked|table|order\w*|wrong (dish|item|food)|forgot|bill|check|pay\w*|charged|overcharg\w*|card machine|service charge|rezervasyon\w*|sipari\w*|hesab?\w*|bekle\w*|s[ıi]ra)\b/i;

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
    if (typeof item === "string") {
      text = item;
    } else if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      text = typeof o.text === "string" ? o.text : typeof o.phrase === "string" ? o.phrase : "";
      modelSellable = o.sellable === true;
    }
    text = text.trim();
    if (!text) continue;
    out.push({ text, sellable: isSellablePainText(text, modelSellable) });
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
