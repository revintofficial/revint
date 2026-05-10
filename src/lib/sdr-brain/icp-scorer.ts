/**
 * SDR Brain v2 — deterministic ICP fit scorer.
 *
 * Scores a lead against the workspace's IdealCustomerProfile row on a
 * 0..100 scale, returning a list of `IcpReason` rows so the UI can
 * show "Why fit: priceLevel match (+12), no booking system (+10), 142
 * reviews (+8)" without re-running the math.
 *
 * Pure function. The wrapping ICP_SCORER worker handles DB read/write;
 * this file is the pure logic so we can unit-test it without Prisma.
 *
 * Score components (each contributes 0..N points; total clamped 0..100):
 *   - Price level fit                : 0..18
 *   - Review count floor / ceiling    : 0..14
 *   - Rating floor                    : 0..10
 *   - Niche / sub-niche weight match  : 0..20
 *   - High-value signal hits          : 0..18 (3 each, max 6)
 *   - Negative signal hits            : 0..-20 (cap)
 *   - Digital maturity floor          : 0..12
 *   - Location fit                    : 0..8
 */

export interface IcpFitInput {
  /** Workspace ICP row (or null when the workspace has not configured one). */
  icp: {
    industryWeights: Record<string, number>;
    subNicheWeights: Record<string, number>;
    priceLevelMin: number | null;
    priceLevelMax: number | null;
    minReviewCount: number | null;
    minRating: number | null;
    digitalMaturityFloor: number | null;
    highValueSignals: string[];
    negativeSignals: string[];
    locationFit: Record<string, unknown>;
  } | null;
  lead: {
    nicheSlug: string | null;
    subNicheSlug: string | null;
    priceLevel: number | null;
    reviewCount: number | null;
    rating: number | null;
    borough: string | null;
    primaryType: string | null;
  };
  audit: {
    checklistScorePct: number | null;
    servicesDetected: string[];
    hasBookingSystem: boolean | null;
    hasEcommerce: boolean | null;
    hasContactForm: boolean | null;
    mobileFriendlyGuess: boolean | null;
  } | null;
}

export interface IcpReason {
  code: string;
  weight: number;
  note?: string;
}

export interface IcpFitResult {
  score: number;
  reasons: IcpReason[];
}

function clamp(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function scoreIcpFit(input: IcpFitInput): IcpFitResult {
  const { icp, lead, audit } = input;
  const reasons: IcpReason[] = [];

  // Workspace has not configured an ICP — fall back to a neutral
  // 50 with a single explanatory reason. The Settings → ICP page
  // surfaces this as a "configure your ICP for better scores" CTA.
  if (!icp) {
    return {
      score: 50,
      reasons: [{ code: "no_icp_configured", weight: 0, note: "Workspace ICP not set" }],
    };
  }

  let score = 30; // baseline so an unknown lead doesn't end up at 0

  // ---- Price level fit ----
  if (lead.priceLevel != null && (icp.priceLevelMin != null || icp.priceLevelMax != null)) {
    const min = icp.priceLevelMin ?? 0;
    const max = icp.priceLevelMax ?? 4;
    if (lead.priceLevel >= min && lead.priceLevel <= max) {
      score += 18;
      reasons.push({
        code: "price_level_match",
        weight: 18,
        note: `priceLevel ${lead.priceLevel} ∈ [${min},${max}]`,
      });
    } else {
      score -= 8;
      reasons.push({
        code: "price_level_miss",
        weight: -8,
        note: `priceLevel ${lead.priceLevel} outside [${min},${max}]`,
      });
    }
  }

  // ---- Review count floor ----
  if (icp.minReviewCount != null) {
    if ((lead.reviewCount ?? 0) >= icp.minReviewCount) {
      score += 10;
      reasons.push({
        code: "review_count_meets_floor",
        weight: 10,
        note: `${lead.reviewCount ?? 0} ≥ ${icp.minReviewCount}`,
      });
    } else {
      score -= 4;
      reasons.push({
        code: "review_count_below_floor",
        weight: -4,
        note: `${lead.reviewCount ?? 0} < ${icp.minReviewCount}`,
      });
    }
  }

  // ---- Rating floor ----
  if (icp.minRating != null && lead.rating != null) {
    if (lead.rating >= icp.minRating) {
      score += 6;
      reasons.push({
        code: "rating_meets_floor",
        weight: 6,
        note: `${lead.rating} ≥ ${icp.minRating}`,
      });
    } else {
      score -= 6;
      reasons.push({
        code: "rating_below_floor",
        weight: -6,
        note: `${lead.rating} < ${icp.minRating}`,
      });
    }
  }

  // ---- Niche / sub-niche weight match ----
  // Sub-niche weight has priority; falls back to parent industry
  // weight if the lead is unclassified at the child level.
  let nicheWeight = 0;
  if (lead.subNicheSlug && icp.subNicheWeights[lead.subNicheSlug] != null) {
    nicheWeight = icp.subNicheWeights[lead.subNicheSlug];
  } else if (lead.nicheSlug && icp.industryWeights[lead.nicheSlug] != null) {
    nicheWeight = icp.industryWeights[lead.nicheSlug];
  }
  if (nicheWeight > 0) {
    const delta = Math.min(20, Math.round(nicheWeight * 12));
    score += delta;
    reasons.push({
      code: "niche_weight_match",
      weight: delta,
      note: `weight=${nicheWeight} for ${lead.subNicheSlug ?? lead.nicheSlug}`,
    });
  }

  // ---- High-value signal hits ----
  // Each match adds 3, capped at 18 (6 hits).
  const services = audit?.servicesDetected ?? [];
  const lcServices = services.map((s) => s.toLowerCase());
  let hvHits = 0;
  for (const sig of icp.highValueSignals) {
    if (lcServices.some((s) => s.includes(sig.toLowerCase()))) hvHits += 1;
  }
  if (hvHits > 0) {
    const delta = Math.min(18, hvHits * 3);
    score += delta;
    reasons.push({
      code: "high_value_signals_hit",
      weight: delta,
      note: `${hvHits} high-value signals`,
    });
  }

  // ---- Negative signal hits ----
  let negHits = 0;
  for (const sig of icp.negativeSignals) {
    if (lcServices.some((s) => s.includes(sig.toLowerCase()))) negHits += 1;
  }
  if (negHits > 0) {
    const delta = Math.max(-20, -negHits * 5);
    score += delta;
    reasons.push({
      code: "negative_signals_hit",
      weight: delta,
      note: `${negHits} negative signals`,
    });
  }

  // ---- Digital maturity floor ----
  if (icp.digitalMaturityFloor != null && audit?.checklistScorePct != null) {
    if (audit.checklistScorePct >= icp.digitalMaturityFloor) {
      score += 8;
      reasons.push({
        code: "digital_maturity_meets_floor",
        weight: 8,
        note: `audit ${audit.checklistScorePct}% ≥ ${icp.digitalMaturityFloor}%`,
      });
    }
  }

  // ---- Location fit ----
  // locationFit Json shape: { boroughs?: string[], primaryTypes?: string[] }
  const locFit = icp.locationFit as {
    boroughs?: string[];
    primaryTypes?: string[];
  };
  if (locFit.boroughs?.length && lead.borough) {
    if (locFit.boroughs.map((b) => b.toLowerCase()).includes(lead.borough.toLowerCase())) {
      score += 5;
      reasons.push({ code: "borough_match", weight: 5, note: lead.borough });
    }
  }
  if (locFit.primaryTypes?.length && lead.primaryType) {
    if (locFit.primaryTypes.includes(lead.primaryType)) {
      score += 3;
      reasons.push({ code: "primary_type_match", weight: 3, note: lead.primaryType });
    }
  }

  return { score: clamp(score), reasons };
}
