/**
 * ICP fit dimension breakdown — pure read-time computation.
 *
 * Phase 2 of Lead Detail v2 replaces the legacy `IcpScoreRing` with a
 * 5-bar dimension breakdown (revenue, staff, stack, geo, vertical).
 * The schema does not store dimension breakdowns — only the rolled-up
 * `Lead.icpFitScore` plus the workspace-level `IdealCustomerProfile`
 * weights. This helper recomputes the breakdown on every read.
 *
 * Inputs are intentionally narrow: we never reach into Prisma here so
 * the same function is used by the aggregator route AND by component
 * tests (matrix of `IdealCustomerProfile` × `Lead` fixtures).
 *
 * Output dimensions are 0..100. A dimension whose input data isn't
 * available on the lead returns `null` and is excluded from the
 * weighted total. This matches RETHINK §5.1's "computed at read time
 * from `IdealCustomerProfile.weights × Lead features`" rule and
 * gracefully tolerates partial leads.
 *
 * Schema reality check (`prisma/schema.prisma`):
 *   - Lead has no `revenueBucket` or `staffCount` columns. We approximate
 *     "revenue" from `priceLevel` + `reviewCount` (Google Places signals
 *     are the closest proxy to deal-size on this product) and "staff"
 *     from `Account.locationsCount` when an account is attached.
 *   - "stack" is whether the lead's site is missing the kind of system
 *     the offer pitches (booking system, CMS, etc). Phase 2 only carries
 *     a coarse boolean derived from `WebsiteAudit.hasBookingSystem` etc.
 *     The aggregator passes the audit-summary via the input.
 *   - "geo" is `Lead.timezone`/`borough` matched against
 *     `IdealCustomerProfile.locationFit`.
 *   - "vertical" is `Lead.subNicheSlug` matched against
 *     `IdealCustomerProfile.subNicheWeights`.
 *
 * The total is a weighted blend over the dimensions that resolved to a
 * number (i.e. `null` dimensions are skipped and remaining weights are
 * renormalized so a workspace with just `revenue: 1.0` doesn't get a
 * zero total when staff data is missing).
 */

export type IcpDimensionKey =
  | "revenue"
  | "staff"
  | "stack"
  | "geo"
  | "vertical";

export interface IcpWeights {
  revenue?: number;
  staff?: number;
  stack?: number;
  geo?: number;
  vertical?: number;
}

export interface IcpLeadInput {
  priceLevel: number | null;
  reviewCount: number | null;
  rating: number | null;
  hasWebsite: boolean;
  subNicheSlug: string | null;
  borough: string | null;
  timezone: string | null;
  account: { locationsCount: number | null } | null;
  audit: {
    hasBookingSystem: boolean | null;
    hasEcommerce: boolean | null;
    mobileFriendlyGuess: boolean | null;
    checklistScorePct: number | null;
  } | null;
}

export interface IcpProfileInput {
  /** Json column on `IdealCustomerProfile`; we treat it as a Record. */
  subNicheWeights: Record<string, number> | null;
  priceLevelMin: number | null;
  priceLevelMax: number | null;
  minReviewCount: number | null;
  minRating: number | null;
  digitalMaturityFloor: number | null;
  highValueSignals: string[];
  /** Free-form Json — we only consume `{ regions?: string[], timezones?: string[] }`. */
  locationFit: Record<string, unknown> | null;
}

export interface IcpDimensionsResult {
  revenue: number | null;
  staff: number | null;
  stack: number | null;
  geo: number | null;
  vertical: number | null;
  total: number;
}

const DEFAULT_WEIGHTS: Required<IcpWeights> = {
  revenue: 0.3,
  staff: 0.2,
  stack: 0.2,
  geo: 0.15,
  vertical: 0.15,
};

function clampScore(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function deriveRevenue(
  lead: IcpLeadInput,
  profile: IcpProfileInput,
): number | null {
  if (
    lead.priceLevel == null &&
    lead.reviewCount == null &&
    profile.priceLevelMin == null &&
    profile.priceLevelMax == null
  ) {
    return null;
  }
  let score = 50;
  if (lead.priceLevel != null) {
    const min = profile.priceLevelMin ?? 0;
    const max = profile.priceLevelMax ?? 4;
    if (lead.priceLevel >= min && lead.priceLevel <= max) score += 30;
    else score -= 25;
  }
  if (lead.reviewCount != null && profile.minReviewCount != null) {
    if (lead.reviewCount >= profile.minReviewCount) score += 15;
    else score -= 10;
  } else if (lead.reviewCount != null && lead.reviewCount >= 100) {
    score += 8;
  }
  return clampScore(score);
}

function deriveStaff(lead: IcpLeadInput): number | null {
  const locations = lead.account?.locationsCount;
  if (locations == null) return null;
  if (locations >= 5) return 90;
  if (locations >= 3) return 75;
  if (locations >= 2) return 60;
  return 40;
}

function deriveStack(
  lead: IcpLeadInput,
  profile: IcpProfileInput,
): number | null {
  if (!lead.audit && !lead.hasWebsite) return null;
  if (!lead.audit) {
    return lead.hasWebsite ? 50 : 30;
  }
  let score = 50;
  if (lead.audit.checklistScorePct != null) {
    const gap = 100 - lead.audit.checklistScorePct;
    score += Math.round(gap * 0.4);
  }
  if (lead.audit.hasBookingSystem === false) score += 10;
  if (lead.audit.mobileFriendlyGuess === false) score += 8;
  if (
    profile.digitalMaturityFloor != null &&
    lead.audit.checklistScorePct != null &&
    lead.audit.checklistScorePct < profile.digitalMaturityFloor
  ) {
    score += 12;
  }
  return clampScore(score);
}

function normalizeRegion(value: string | null): string | null {
  if (!value) return null;
  return value.trim().toLowerCase();
}

function deriveGeo(
  lead: IcpLeadInput,
  profile: IcpProfileInput,
): number | null {
  const fit = profile.locationFit ?? {};
  const regions = Array.isArray((fit as { regions?: unknown }).regions)
    ? ((fit as { regions: unknown[] }).regions.filter(
        (r): r is string => typeof r === "string",
      ) as string[])
    : [];
  const timezones = Array.isArray((fit as { timezones?: unknown }).timezones)
    ? ((fit as { timezones: unknown[] }).timezones.filter(
        (r): r is string => typeof r === "string",
      ) as string[])
    : [];

  if (
    regions.length === 0 &&
    timezones.length === 0 &&
    !lead.borough &&
    !lead.timezone
  ) {
    return null;
  }

  const borough = normalizeRegion(lead.borough);
  const timezone = lead.timezone?.trim() ?? null;
  if (borough && regions.some((r) => normalizeRegion(r) === borough)) return 100;
  if (timezone && timezones.includes(timezone)) return 80;
  if (regions.length === 0 && timezones.length === 0) return 50;
  return 30;
}

function deriveVertical(
  lead: IcpLeadInput,
  profile: IcpProfileInput,
): number | null {
  if (lead.subNicheSlug == null) return null;
  const weights = profile.subNicheWeights ?? {};
  const exact = weights[lead.subNicheSlug];
  if (typeof exact === "number") {
    return clampScore(exact * 100);
  }
  const parent = lead.subNicheSlug.split("-")[0];
  const parentWeight = weights[parent];
  if (typeof parentWeight === "number") {
    return clampScore(parentWeight * 70);
  }
  return Object.keys(weights).length === 0 ? 50 : 20;
}

function normalizeWeights(input: IcpWeights | null | undefined): Required<IcpWeights> {
  if (!input) return { ...DEFAULT_WEIGHTS };
  const merged = { ...DEFAULT_WEIGHTS, ...input };
  const sum =
    merged.revenue + merged.staff + merged.stack + merged.geo + merged.vertical;
  if (sum <= 0) return { ...DEFAULT_WEIGHTS };
  if (Math.abs(sum - 1) < 0.01) return merged;
  return {
    revenue: merged.revenue / sum,
    staff: merged.staff / sum,
    stack: merged.stack / sum,
    geo: merged.geo / sum,
    vertical: merged.vertical / sum,
  };
}

export function computeIcpDimensions(
  lead: IcpLeadInput,
  profile: IcpProfileInput | null,
  weightsInput?: IcpWeights | null,
): IcpDimensionsResult {
  const profileSafe: IcpProfileInput = profile ?? {
    subNicheWeights: null,
    priceLevelMin: null,
    priceLevelMax: null,
    minReviewCount: null,
    minRating: null,
    digitalMaturityFloor: null,
    highValueSignals: [],
    locationFit: null,
  };

  const dimensions: Record<IcpDimensionKey, number | null> = {
    revenue: deriveRevenue(lead, profileSafe),
    staff: deriveStaff(lead),
    stack: deriveStack(lead, profileSafe),
    geo: deriveGeo(lead, profileSafe),
    vertical: deriveVertical(lead, profileSafe),
  };

  const weights = normalizeWeights(weightsInput);
  let weightedSum = 0;
  let usedWeight = 0;
  for (const key of Object.keys(dimensions) as IcpDimensionKey[]) {
    const value = dimensions[key];
    if (value == null) continue;
    weightedSum += value * weights[key];
    usedWeight += weights[key];
  }
  const total = usedWeight > 0 ? clampScore(weightedSum / usedWeight) : 0;

  return { ...dimensions, total };
}
