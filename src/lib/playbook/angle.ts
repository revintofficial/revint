/**
 * FineDine v1 update — pick the best playbook angle for a lead.
 *
 * The "FineDine Angle Card" needs a recommended pitch angle. The NBA
 * worker can be extended to choose from the playbook angles, but until
 * then this deterministic picker derives lightweight signals from the
 * lead's existing analysis (website / reviews / price level) and matches
 * them against each angle's `triggers`, returning the highest-scoring
 * angle. This guarantees the Action Sheet always has an angle to show.
 */
import type { PlaybookAngle, PlaybookShape } from "./types";

export interface AngleLeadSignals {
  hasWebsite: boolean;
  rating: number | null;
  reviewCount: number | null;
  priceLevel: number | null;
  isMultiLocation: boolean;
  /** Signals extracted from the website audit features, if available. */
  noReservationSystem?: boolean;
  noOnlineOrdering?: boolean;
}

/** Map raw lead signals to the trigger keys used by playbook angles. */
export function deriveTriggers(signals: AngleLeadSignals): string[] {
  const t: string[] = [];
  if (!signals.hasWebsite) t.push("no_website");
  if (signals.rating !== null && signals.rating < 4) t.push("low_rating");
  if (signals.rating !== null && signals.rating >= 4.5) t.push("high_rating");
  if (signals.reviewCount !== null && signals.reviewCount >= 100) {
    t.push("many_reviews", "repeat_customers");
  }
  if (signals.priceLevel !== null && signals.priceLevel <= 1) t.push("casual_dining");
  if (signals.isMultiLocation) t.push("multi_location", "is_group_brand");
  if (signals.noReservationSystem) t.push("no_reservation_system");
  if (signals.noOnlineOrdering) t.push("no_online_ordering");
  return t;
}

export interface PickedAngle {
  angle: PlaybookAngle;
  score: number;
  matchedTriggers: string[];
}

/**
 * Choose the best angle. Score = number of overlapping triggers. Ties
 * break on playbook order (first declared wins). Falls back to the first
 * angle when nothing matches so the card is never empty.
 */
export function pickAngle(
  playbook: PlaybookShape,
  signals: AngleLeadSignals,
): PickedAngle | null {
  if (playbook.angles.length === 0) return null;
  const triggers = new Set(deriveTriggers(signals));

  let best: PickedAngle | null = null;
  for (const angle of playbook.angles) {
    const matched = (angle.triggers ?? []).filter((t) => triggers.has(t));
    const score = matched.length;
    if (!best || score > best.score) {
      best = { angle, score, matchedTriggers: matched };
    }
  }

  if (best && best.score === 0) {
    // No trigger overlap — surface the first angle but flag zero score so
    // the UI can soften the "why" copy.
    return { angle: playbook.angles[0], score: 0, matchedTriggers: [] };
  }
  return best;
}
