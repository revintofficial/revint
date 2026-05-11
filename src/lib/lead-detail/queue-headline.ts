/**
 * Queue headline — pure helper that maps a `LeadTrigger` (or null) into
 * the queue-strip `WHY NOW: …` string.
 *
 * Used by:
 *   - `/api/leads/queue` route — builds the `whyNow` field in the
 *     response payload (so the strip never has to re-derive).
 *   - `QueueStrip.tsx` — fallback when the API didn't supply a string
 *     (defensive only; the route always populates it now).
 *   - `queue-headline.test.ts` — table-driven test covering every
 *     `LeadTriggerType` enum value plus the `null`/no-trigger case.
 *
 * The helper is intentionally enum-aware: each `LeadTriggerType` has
 * its own short, sentence-case headline. When evidence carries
 * structured numerics (rating-drop windowed math, review-volume
 * delta), the headline interpolates them so the rep sees real numbers
 * rather than a generic phrase.
 *
 * Phase 8 adds `REVIEW_VOLUME_SURGE` / `REVIEW_VOLUME_DIP` rows; both
 * map cleanly here. Until that phase lands the helper still resolves —
 * the new enum values are simply unreachable from production data.
 *
 * No DB I/O, no network. Pure string composition.
 */

import type { LeadTriggerType } from "@/generated/prisma/client";

/**
 * Minimal subset of `LeadTrigger` the helper needs. The full row carries
 * more fields (severity, confidence, urgencyWindowDays, etc.) but only
 * `type` + `impactPrediction` + `evidence` participate in headline
 * composition. Keeping the shape small lets callers pass either a real
 * Prisma row or a synthesised fixture.
 */
export interface QueueHeadlineTrigger {
  type: LeadTriggerType;
  impactPrediction: string | null;
  /**
   * Schema-less JSON the trigger detector writes per-rule. Common keys
   * the helper looks for:
   *   - RATING_DROP / BAD_SERVICE_REVIEWS: `windowDropStars`,
   *     `recentCount`, `priorCount`, `kpis[].label/count`
   *   - REVIEW_VOLUME_SURGE / _DIP: `deltaPct`, `recentCount`,
   *     `priorCount`
   *   - NEW_LOCATION_OPENING (account-derived): `ageDays`,
   *     `locationsCount`
   *   - CHAIN_EXPANSION: `locationsCount`
   *   - REBRANDING: `similarity`
   */
  evidence: unknown;
}

/**
 * Fallback headline used when no `LeadTrigger` row has been written yet.
 * The queue strip prefers a real signal; this string is the explicit
 * "we have nothing to highlight" state so the row still renders cleanly.
 */
export const QUEUE_HEADLINE_QUEUED = "queued";

interface EvidenceShape {
  windowDropStars?: number;
  recentCount?: number;
  priorCount?: number;
  deltaPct?: number;
  ageDays?: number;
  locationsCount?: number;
  similarity?: number;
  kpis?: Array<{ label?: string; count?: number }>;
  matchedCodes?: string[];
}

function readEvidence(value: unknown): EvidenceShape {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as EvidenceShape;
}

/**
 * Map a `LeadTriggerType` to a short imperative headline. Phase 8's new
 * enum values are NOT in this map — they're handled by the
 * `composeFromEvidence` branch below because their value is the delta
 * percentage, not the trigger family name.
 */
const TYPE_TO_DEFAULT_HEADLINE: Partial<Record<LeadTriggerType, string>> = {
  NEW_LOCATION_OPENING: "new location opening",
  CHAIN_EXPANSION: "chain expansion",
  HIRING_MARKETING: "hiring marketing",
  HIRING_OPS: "hiring ops",
  HIRING_TECH: "hiring tech",
  BAD_SERVICE_REVIEWS: "service complaints",
  RATING_DROP: "rating drop",
  MENU_REDESIGN_SIGNAL: "menu redesign signal",
  BOOKING_PROVIDER_CHANGE: "booking provider change",
  DELIVERY_EXPANSION: "delivery expansion gap",
  INTERNATIONAL_AUDIENCE_GROWTH: "international growth",
  SEASONAL_TOURISM: "seasonal tourism window",
  COMPETITOR_PRESSURE: "competitor pressure",
  REBRANDING: "rebranding in flight",
  FUNDING_RAISED: "funding raised",
  EXEC_CHANGE: "executive change",
};

/**
 * For trigger families with structured numeric evidence, build a
 * headline that reads the numbers ("rating drop -0.6★ / 30d",
 * "review surge +120%"). Falls back to the type's default headline
 * when evidence is missing.
 *
 * `type` is widened to `string` inside the switch so the Phase 8
 * `REVIEW_VOLUME_*` arms type-check against the current generated
 * client (which doesn't carry those enum values yet). Once Phase 8's
 * schema land lands and `npm run db:generate` runs, the cast becomes
 * a no-op.
 */
function composeFromEvidence(
  type: LeadTriggerType,
  ev: EvidenceShape,
): string | null {
  switch (type as string) {
    case "RATING_DROP":
      if (typeof ev.windowDropStars === "number" && ev.windowDropStars > 0) {
        return `rating drop -${ev.windowDropStars.toFixed(1)}★ / 30d`;
      }
      return null;
    case "BAD_SERVICE_REVIEWS":
      if (Array.isArray(ev.kpis) && ev.kpis.length > 0) {
        const top = ev.kpis[0];
        if (top.label && typeof top.count === "number") {
          return `service complaints (${top.count}× "${top.label}")`;
        }
      }
      return null;
    case "MENU_REDESIGN_SIGNAL":
      if (Array.isArray(ev.kpis) && ev.kpis.length > 0) {
        const top = ev.kpis[0];
        if (top.label && typeof top.count === "number") {
          return `menu signal (${top.count}× "${top.label}")`;
        }
      }
      return null;
    case "NEW_LOCATION_OPENING":
      if (
        typeof ev.ageDays === "number" &&
        typeof ev.locationsCount === "number"
      ) {
        return `new branch opened ${ev.ageDays}d ago (${ev.locationsCount} sites)`;
      }
      return null;
    case "CHAIN_EXPANSION":
      if (typeof ev.locationsCount === "number") {
        return `chain operator (${ev.locationsCount} sites)`;
      }
      return null;
    case "REBRANDING":
      if (typeof ev.similarity === "number") {
        return `rebranding (site title ${(ev.similarity * 100).toFixed(0)}% match)`;
      }
      return null;
    case "COMPETITOR_PRESSURE":
      if (Array.isArray(ev.matchedCodes) && ev.matchedCodes.length > 0) {
        return `competitor pressure (${ev.matchedCodes[0]})`;
      }
      return null;
    // Phase 8 new types — not in the default map; they're built
    // entirely from evidence numbers because the value IS the
    // headline.
    case "REVIEW_VOLUME_SURGE":
      if (typeof ev.deltaPct === "number" && ev.deltaPct > 0) {
        return `review surge +${Math.round(ev.deltaPct)}%`;
      }
      return "review surge";
    case "REVIEW_VOLUME_DIP":
      if (typeof ev.deltaPct === "number" && ev.deltaPct < 0) {
        return `review dip ${Math.round(ev.deltaPct)}%`;
      }
      return "review dip";
    default:
      return null;
  }
}

/**
 * Resolve the headline string used for the queue strip's `WHY NOW: …`
 * line.
 *
 * Resolution order (each step falls through if it produces null/empty):
 *   1. Evidence-aware composition (e.g. "rating drop -0.6★ / 30d").
 *   2. Trigger's `impactPrediction` (the writer's prose), trimmed to
 *      72 chars.
 *   3. The default headline for the type.
 *   4. The lowercased enum value with underscores → spaces (defensive
 *      catch-all so an unknown type never returns empty).
 *   5. `QUEUE_HEADLINE_QUEUED` when no trigger has fired.
 */
export function buildQueueHeadline(
  trigger: QueueHeadlineTrigger | null,
): string {
  if (!trigger) return QUEUE_HEADLINE_QUEUED;
  const evidence = readEvidence(trigger.evidence);
  const fromEvidence = composeFromEvidence(trigger.type, evidence);
  if (fromEvidence) return fromEvidence;
  if (trigger.impactPrediction && trigger.impactPrediction.trim().length > 0) {
    const trimmed = trigger.impactPrediction.trim();
    return trimmed.length > 72 ? `${trimmed.slice(0, 71)}…` : trimmed;
  }
  const fallback = TYPE_TO_DEFAULT_HEADLINE[trigger.type];
  if (fallback) return fallback;
  // Defensive — even if a new enum value is added without updating
  // this map, we never return empty.
  return trigger.type.toLowerCase().replace(/_/g, " ");
}
