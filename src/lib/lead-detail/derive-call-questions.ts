/**
 * derive-call-questions — Phase 2.5 (V2 Richness Absorption, Phase 1.7).
 *
 * Pure, no-network helper that produces the "3 SORU" row of the
 * FourThingsCard. The industry SDR formula (2026) calls for three
 * concrete discovery questions the rep can read out loud in the
 * first 3 minutes of a cold call. We never spend a Gemini round-trip
 * for this — every signal we need is already in cache by the time
 * the decision-surface aggregator runs.
 *
 * Priority (highest-quality source first):
 *
 *   1. **SPIN PROBLEM items** — when a discovery session exists, the
 *      SDR has already captured real problem statements. Each one
 *      gets a `?` if it doesn't already end with one.
 *   2. **Brief `confirmedPainPoints`** — pain phrases the
 *      LEAD_INTELLIGENCE_BRIEF *verified* against an audit boolean
 *      or a review quote. We turn each pain into an open question
 *      ("How are you handling X today?"). This is the most common
 *      path for COLD leads after enrichment.
 *   3. **Brief `painPoints`** — pain phrases the brief surfaced but
 *      may not have hard-verified. Same template as (2), but only
 *      consulted when confirmedPainPoints is empty.
 *   4. **Niche-aware generic fallback** — when nothing else is
 *      available we emit three safe-and-broad questions seeded by
 *      the niche. Reps still see a card with three real lines (no
 *      "Brief generating..." dead air) which is the central UX
 *      promise of FourThingsCard.
 *
 * Output cap: 3 items, each <= 140 chars, deduplicated by
 * lowercased prefix so two near-identical SPIN + pain entries don't
 * collide on the same question.
 */

export interface DeriveCallQuestionsInput {
  /** SPIN PROBLEM items from `latestDiscoverySession.items.PROBLEM`. */
  spinProblems: Array<{ text: string }>;
  /** Brief `confirmedPainPoints` — audit/review-verified pain shortlist. */
  confirmedPainPoints: string[];
  /** Brief `painPoints` — broader (possibly unverified) pain list. */
  painPoints: string[];
  /**
   * Workspace niche, used for the generic fallback wording. Accepts
   * raw `WorkspaceNiche` enum values; `null` collapses to a safe
   * generic phrasing.
   */
  niche?: string | null;
  /**
   * Business sub-niche slug ("italian_restaurant", "dental_clinic",
   * ...). Optional — surfaces in the generic fallback so the rep
   * doesn't see "your business" when we have a better word.
   */
  subNicheLabel?: string | null;
}

const MAX_QUESTIONS = 3;
const MAX_LEN = 140;

function ensureQuestionMark(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  if (trimmed.endsWith("?")) return trimmed;
  if (/[.!:;]$/.test(trimmed)) return `${trimmed.slice(0, -1)}?`;
  return `${trimmed}?`;
}

function painToQuestion(pain: string): string {
  const cleaned = pain.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  // Already phrased as a question — keep verbatim.
  if (cleaned.endsWith("?")) return cleaned;
  // Lowercase the first letter so it slots into the template
  // grammatically ("How are you handling slow service today?").
  const lowered = cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
  return `How are you handling ${lowered} today?`;
}

/**
 * Helper that tracks the dedupe set as items are added so callers
 * can keep pulling from the next source when a duplicate is rejected.
 * Returns `true` if the item was accepted (counts toward the cap).
 */
function addUnique(
  out: string[],
  seen: Set<string>,
  raw: string,
): boolean {
  if (!raw) return false;
  const clipped = raw.length > MAX_LEN ? `${raw.slice(0, MAX_LEN - 1)}…` : raw;
  const key = clipped.toLowerCase().slice(0, 60);
  if (seen.has(key)) return false;
  seen.add(key);
  out.push(clipped);
  return true;
}

function genericFallback(
  niche: string | null | undefined,
  subNicheLabel: string | null | undefined,
): string[] {
  const audience = subNicheLabel
    ? subNicheLabel.replace(/[_-]+/g, " ")
    : niche === "RESTAURANT_TECH"
      ? "restaurant"
      : niche === "DENTAL"
        ? "practice"
        : niche === "REAL_ESTATE"
          ? "agency"
          : niche === "WEB_AGENCY"
            ? "agency"
            : "business";

  return [
    `What's the biggest bottleneck slowing down your ${audience} this quarter?`,
    `When you last looked at ${audience} growth, what felt out of your control?`,
    "Who else weighs in when you decide to bring in a new partner?",
  ];
}

export function deriveCallQuestions(
  input: DeriveCallQuestionsInput,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  // 1. SPIN PROBLEM rows — already-real discovery questions.
  for (const item of input.spinProblems) {
    if (out.length >= MAX_QUESTIONS) break;
    addUnique(out, seen, ensureQuestionMark(item.text));
  }

  // 2. Confirmed pain points (audit / review verified).
  for (const p of input.confirmedPainPoints) {
    if (out.length >= MAX_QUESTIONS) break;
    addUnique(out, seen, painToQuestion(p));
  }

  // 3. Broader brief pain points.
  for (const p of input.painPoints) {
    if (out.length >= MAX_QUESTIONS) break;
    addUnique(out, seen, painToQuestion(p));
  }

  // 4. Niche-aware fallback to fill any remaining slots.
  if (out.length < MAX_QUESTIONS) {
    for (const g of genericFallback(input.niche, input.subNicheLabel)) {
      if (out.length >= MAX_QUESTIONS) break;
      addUnique(out, seen, g);
    }
  }

  return out;
}
