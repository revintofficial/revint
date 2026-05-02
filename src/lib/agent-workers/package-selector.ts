/**
 * Beta finding §4 — deterministic package selector.
 *
 * The previous flow asked Gemini to pick `recommended_package_id` from
 * a menu of the workspace's ServicePackage tiers. Two systemic failure
 * modes surfaced in beta:
 *
 *   1. Anchor bias from `isPopular`. When the menu was shipped to the
 *      model with "(most popular)" suffixes, ~60% of recommendations
 *      converged on whichever tier carried that flag — independent of
 *      lead size, pain point density, or hotel/multi-property signals
 *      that should have pushed toward the higher tier.
 *
 *   2. Tier inversion on small leads. A 30-review one-location café
 *      occasionally got pushed to the Premium tier because the model
 *      pattern-matched "looks like a real business" rather than
 *      computing whether the deal economics support it.
 *
 * The fix is to take the tier decision OUT of Gemini and put it into a
 * deterministic rule encoded here. Gemini still owns the *prose* (a
 * one-sentence reason that names the audit / review signal driving the
 * choice), but the id is no longer up to it.
 *
 * Tier mapping (sorted by sortOrder ASC):
 *   - sorted[0] = base
 *   - sorted[1] = premium    (falls back to base if missing)
 *   - sorted[2] = enterprise (falls back to premium / base)
 *
 * Decision tree (first match wins):
 *   1. isHotel || hasMultipleLocations  -> enterprise
 *      Reason: hotel kitchens and multi-property restaurants need
 *      central admin + per-property settings, which is the explicit
 *      enterprise feature set.
 *   2. painPointCount >= 2 || reviewCount > 300 -> premium
 *      Reason: a high-volume venue with multiple operational pains
 *      has the budget and the unit economics to justify premium.
 *   3. otherwise -> base
 *
 * The helper is pure, has no IO, and is unit-testable in isolation —
 * `package-selector.test.ts` covers six FineDine cafés to lock in
 * 4×Base / 2×Premium classification.
 */

export interface PackageSelectorPackage {
  id: string;
  name: string;
  sortOrder: number;
}

export interface PackageSelectorInput {
  /** Total Google Maps review count for the lead. */
  reviewCount: number;
  /** Google Maps rating (0-5). Currently informational; reserved for future weighting. */
  rating: number;
  /** Lead has been classified as operating multiple locations. */
  hasMultipleLocations: boolean;
  /** Lead has been classified as a hotel restaurant / hotel property. */
  isHotel: boolean;
  /** Workspace's ServicePackage tiers, in any order. */
  servicePackages: PackageSelectorPackage[];
  /**
   * Number of operational pain points surfaced by the review analyst
   * (after filtering to the count >= 2 + grounded-examples threshold).
   * Beta finding §4: this is the strongest signal for premium fit.
   */
  painPointCount: number;
}

export interface PackageSelectorResult {
  /** Selected ServicePackage id. Null when the workspace has no packages. */
  id: string | null;
  /** Tier slot the selection came from. */
  tier: "base" | "premium" | "enterprise";
  /**
   * Short machine-readable reason. Used for telemetry / E2E assertions.
   * Gemini's prose reason is generated separately in the worker.
   */
  reason: string;
}

export function selectPackage(input: PackageSelectorInput): PackageSelectorResult {
  if (input.servicePackages.length === 0) {
    return { id: null, tier: "base", reason: "no_packages_configured" };
  }

  const sorted = [...input.servicePackages].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const base = sorted[0];
  const premium = sorted[1] ?? base;
  const enterprise = sorted[2] ?? premium;

  if (input.isHotel || input.hasMultipleLocations) {
    return {
      id: enterprise.id,
      tier: "enterprise",
      reason: input.isHotel
        ? "hotel_property"
        : "multi_location",
    };
  }

  if (input.painPointCount >= 2 || input.reviewCount > 300) {
    const driver =
      input.painPointCount >= 2 && input.reviewCount > 300
        ? "high_volume_high_pain"
        : input.painPointCount >= 2
          ? "multiple_pain_points"
          : "high_review_volume";
    return { id: premium.id, tier: "premium", reason: driver };
  }

  return { id: base.id, tier: "base", reason: "small_scale_low_pain" };
}
