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
  /**
   * Review-analysis weakness KPIs mention waits, the bill, or slow
   * service. Only set when that evidence exists — never inferred from
   * review volume alone.
   */
  slowServiceReviews?: boolean;
}

const SLOW_SERVICE_LABEL = /wait|slow service|bill|queue|understaff/i;

/**
 * A digital menu page is not the same thing as order-and-pay. Passing
 * `menuUrl` stops us calling a grand café with a full HTML menu
 * "no online ordering" and pitching them a QR menu.
 */
export function absenceSignalsFromAudit(
  audit: {
    reachable: boolean;
    hasBookingSystem: boolean;
    hasEcommerce: boolean;
    rawFeaturesJson: unknown;
  } | null,
): { noReservationSystem?: boolean; noOnlineOrdering?: boolean } {
  if (!audit || audit.reachable !== true) return {};
  const features = (audit.rawFeaturesJson ?? null) as {
    hasQrMenu?: boolean;
    hasOnlineReservation?: boolean;
    hasDeliveryIntegration?: boolean;
    menuUrl?: string | null;
  } | null;
  const hasDigitalMenu = !!(
    features?.hasQrMenu ||
    features?.hasDeliveryIntegration ||
    features?.menuUrl
  );
  return {
    noReservationSystem: !(features?.hasOnlineReservation || audit.hasBookingSystem),
    noOnlineOrdering: !(hasDigitalMenu || audit.hasEcommerce),
  };
}

export function hasSlowServiceSignal(weaknessKpis: unknown): boolean {
  if (!Array.isArray(weaknessKpis)) return false;
  return weaknessKpis.some((kpi) => {
    if (!kpi || typeof kpi !== "object") return false;
    const label = String((kpi as { label?: unknown }).label ?? "");
    const percent = Number((kpi as { percent?: unknown }).percent ?? 0);
    // A 5-review Places sample can hit 40% on one complaint. The review
    // panel already treats under 10 reviews as meaningless; the pitch
    // must use the same bar when the KPI carries a count.
    const countRaw = (kpi as { count?: unknown }).count;
    if (typeof countRaw === "number" && Number.isFinite(countRaw) && countRaw < 10) {
      return false;
    }
    return SLOW_SERVICE_LABEL.test(label) && percent >= 25;
  });
}

/**
 * Operational gaps (no booking, no digital ordering, slow service,
 * multi-site) should beat generic popularity. Otherwise every busy
 * 4.5-star London restaurant collapses to "CRM / Loyalty".
 */
const TRIGGER_WEIGHT: Record<string, number> = {
  no_reservation_system: 3,
  no_online_ordering: 3,
  no_website: 3,
  slow_service_reviews: 3,
  multi_location: 3,
  is_group_brand: 3,
};

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
  if (signals.slowServiceReviews) t.push("slow_service_reviews");
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
    const score = matched.reduce((sum, t) => sum + (TRIGGER_WEIGHT[t] ?? 1), 0);
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
