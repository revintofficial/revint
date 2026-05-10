/**
 * Phase 2 — `computeIcpDimensions` matrix.
 *
 * Covers the per-dimension fallbacks (null when the lead lacks the
 * input column) and the renormalized weighted total. The contract
 * matches the aggregator's expectations exactly.
 */
import { describe, expect, it } from "vitest";

import {
  computeIcpDimensions,
  type IcpLeadInput,
  type IcpProfileInput,
} from "@/lib/icp-fit/dimensions";

const BASE_PROFILE: IcpProfileInput = {
  subNicheWeights: { restaurants: 0.9 },
  priceLevelMin: 2,
  priceLevelMax: 4,
  minReviewCount: 50,
  minRating: 4.0,
  digitalMaturityFloor: 60,
  highValueSignals: [],
  locationFit: { regions: ["Brooklyn"], timezones: ["America/New_York"] },
};

function lead(overrides: Partial<IcpLeadInput> = {}): IcpLeadInput {
  return {
    priceLevel: 3,
    reviewCount: 200,
    rating: 4.5,
    hasWebsite: true,
    subNicheSlug: "restaurants",
    borough: "Brooklyn",
    timezone: "America/New_York",
    account: { locationsCount: 3 },
    audit: {
      hasBookingSystem: false,
      hasEcommerce: false,
      mobileFriendlyGuess: true,
      checklistScorePct: 40,
    },
    ...overrides,
  };
}

describe("computeIcpDimensions — populated lead", () => {
  it("returns numeric scores for every dimension", () => {
    const result = computeIcpDimensions(lead(), BASE_PROFILE);
    expect(result.revenue).not.toBeNull();
    expect(result.staff).not.toBeNull();
    expect(result.stack).not.toBeNull();
    expect(result.geo).not.toBeNull();
    expect(result.vertical).not.toBeNull();
    expect(result.total).toBeGreaterThan(0);
    expect(result.total).toBeLessThanOrEqual(100);
  });

  it("scores Brooklyn (regions match) at 100 geo", () => {
    const result = computeIcpDimensions(lead(), BASE_PROFILE);
    expect(result.geo).toBe(100);
  });

  it("vertical hits the exact subNicheSlug weight", () => {
    const result = computeIcpDimensions(lead(), BASE_PROFILE);
    expect(result.vertical).toBeGreaterThan(80);
  });
});

describe("computeIcpDimensions — partial fallbacks", () => {
  it("staff is null when no account is attached", () => {
    const result = computeIcpDimensions(
      lead({ account: null }),
      BASE_PROFILE,
    );
    expect(result.staff).toBeNull();
  });

  it("vertical is null when subNicheSlug is missing", () => {
    const result = computeIcpDimensions(
      lead({ subNicheSlug: null }),
      BASE_PROFILE,
    );
    expect(result.vertical).toBeNull();
  });

  it("geo is null when neither lead nor profile carries any geo data", () => {
    const result = computeIcpDimensions(
      lead({ borough: null, timezone: null }),
      { ...BASE_PROFILE, locationFit: null },
    );
    expect(result.geo).toBeNull();
  });

  it("revenue is null when both lead and profile lack price/review signals", () => {
    const result = computeIcpDimensions(
      lead({ priceLevel: null, reviewCount: null }),
      { ...BASE_PROFILE, priceLevelMin: null, priceLevelMax: null, minReviewCount: null },
    );
    expect(result.revenue).toBeNull();
  });

  it("stack is null when neither audit nor hasWebsite is set", () => {
    const result = computeIcpDimensions(
      lead({ audit: null, hasWebsite: false }),
      BASE_PROFILE,
    );
    expect(result.stack).toBeNull();
  });
});

describe("computeIcpDimensions — total renormalization", () => {
  it("does not collapse to 0 when only one dimension resolves", () => {
    const sparseProfile: IcpProfileInput = {
      ...BASE_PROFILE,
      locationFit: null,
      subNicheWeights: null,
    };
    const result = computeIcpDimensions(
      lead({
        account: null,
        audit: null,
        hasWebsite: false,
        subNicheSlug: null,
        borough: null,
        timezone: null,
      }),
      sparseProfile,
    );
    expect(result.staff).toBeNull();
    expect(result.stack).toBeNull();
    expect(result.geo).toBeNull();
    expect(result.vertical).toBeNull();
    expect(result.total).toBeGreaterThan(0);
  });

  it("returns a 0 total when no dimension resolves", () => {
    const result = computeIcpDimensions(
      {
        priceLevel: null,
        reviewCount: null,
        rating: null,
        hasWebsite: false,
        subNicheSlug: null,
        borough: null,
        timezone: null,
        account: null,
        audit: null,
      },
      null,
    );
    expect(result.total).toBe(0);
  });

  it("respects custom weights when supplied", () => {
    const result = computeIcpDimensions(
      lead(),
      BASE_PROFILE,
      { revenue: 1.0, staff: 0, stack: 0, geo: 0, vertical: 0 },
    );
    expect(result.total).toBe(result.revenue);
  });
});
