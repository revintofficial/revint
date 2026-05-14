/**
 * Truth Layer v1 — T-A §3 "ICP-rozet single-source-of-truth" cap tests.
 *
 * The cap lives in `src/lib/agent-workers/icp-scorer.ts` (the Prisma
 * wrapper) — not in `src/lib/sdr-brain/icp-scorer.ts` (the pure deriver)
 * — because it adjusts the PERSISTED `Lead.icpFitScore` value. We test
 * the pure helpers (`evaluateOutsideIcp`, `applyOutsideIcpCap`) so the
 * test stays Prisma-free; the worker glue is exercised by the existing
 * `agent-workers/*` suites.
 */
import { describe, it, expect } from "vitest";

import {
  applyOutsideIcpCap,
  evaluateOutsideIcp,
  ICP_LOW_FIT_PROXY_THRESHOLD,
  ICP_ROZET_CAP,
} from "@/lib/agent-workers/icp-scorer";
import { scoreIcpFit, type IcpFitInput } from "@/lib/sdr-brain/icp-scorer";

function strongPositiveIcp(): IcpFitInput["icp"] {
  return {
    industryWeights: { fnb: 1, ecommerce: 0.8 },
    subNicheWeights: { "fnb-fine-dining": 1, "fnb-bar-club": 0.9 },
    priceLevelMin: 2,
    priceLevelMax: 4,
    minReviewCount: 50,
    minRating: 3.5,
    digitalMaturityFloor: 30,
    highValueSignals: ["booking", "reservations"],
    negativeSignals: [],
    locationFit: {},
  };
}

function strongPositiveAudit(): IcpFitInput["audit"] {
  return {
    checklistScorePct: 80,
    servicesDetected: ["booking system", "reservations"],
    hasBookingSystem: true,
    hasEcommerce: false,
    hasContactForm: true,
    mobileFriendlyGuess: true,
  };
}

describe("ICP rozet single-source-of-truth cap", () => {
  it("caps salesFitScore <= 49 when the lead's niche is outside the workspace target list", () => {
    // Workspace cares about FnB / ecommerce, but this lead is a
    // generic `auto` shop. Price match, services match, rating match
    // — every OTHER signal would push the score well above 49.
    const result = scoreIcpFit({
      icp: strongPositiveIcp(),
      lead: {
        nicheSlug: "auto",
        subNicheSlug: null,
        priceLevel: 3,
        reviewCount: 500,
        rating: 4.7,
        borough: null,
        primaryType: null,
      },
      audit: strongPositiveAudit(),
    });

    // Sanity: without the cap this would render as a strong fit.
    expect(result.score).toBeGreaterThan(ICP_ROZET_CAP);
    expect(result.reasons.some((r) => r.code === "niche_weight_match")).toBe(
      false,
    );

    const capped = applyOutsideIcpCap(result, strongPositiveIcp());
    expect(capped.check.outsideIcp).toBe(true);
    expect(capped.check.reason).toBe("no_niche_match");
    expect(capped.cappedScore).toBeLessThanOrEqual(ICP_ROZET_CAP);
    expect(capped.cappedScore).toBe(ICP_ROZET_CAP);
  });

  it("does NOT cap when the lead's niche matches the workspace target", () => {
    const result = scoreIcpFit({
      icp: strongPositiveIcp(),
      lead: {
        nicheSlug: "fnb",
        subNicheSlug: "fnb-fine-dining",
        priceLevel: 4,
        reviewCount: 200,
        rating: 4.6,
        borough: null,
        primaryType: null,
      },
      audit: strongPositiveAudit(),
    });
    expect(result.reasons.some((r) => r.code === "niche_weight_match")).toBe(
      true,
    );
    expect(result.score).toBeGreaterThan(ICP_ROZET_CAP);

    const capped = applyOutsideIcpCap(result, strongPositiveIcp());
    expect(capped.check.outsideIcp).toBe(false);
    expect(capped.check.reason).toBeNull();
    expect(capped.cappedScore).toBe(result.score);
  });

  it("workspace with no industry/sub-niche weights configured does NOT trigger the no_niche_match proxy", () => {
    // Workspace has set price + review floors but not yet built a
    // niche taxonomy. The cap must stay off so we don't suppress
    // every score by default.
    const icp: IcpFitInput["icp"] = {
      industryWeights: {},
      subNicheWeights: {},
      priceLevelMin: 1,
      priceLevelMax: 4,
      minReviewCount: 20,
      minRating: 3.0,
      digitalMaturityFloor: null,
      highValueSignals: [],
      negativeSignals: [],
      locationFit: {},
    };
    const result = scoreIcpFit({
      icp,
      lead: {
        nicheSlug: "fnb",
        subNicheSlug: null,
        priceLevel: 2,
        reviewCount: 120,
        rating: 4.3,
        borough: null,
        primaryType: null,
      },
      audit: null,
    });
    expect(result.score).toBeGreaterThan(ICP_LOW_FIT_PROXY_THRESHOLD);

    const capped = applyOutsideIcpCap(result, {
      industryWeights: {},
      subNicheWeights: {},
    });
    expect(capped.check.outsideIcp).toBe(false);
    expect(capped.cappedScore).toBe(result.score);
  });

  it("low-icp-fit-score proxy fires when score < 25 even without configured niche weights", () => {
    // Synthetic result: negative signals dragged the score below 25.
    const result = {
      score: 12,
      reasons: [
        { code: "negative_signals_hit", weight: -10 },
        { code: "rating_below_floor", weight: -6 },
      ],
    };
    const check = evaluateOutsideIcp(result, null);
    expect(check.outsideIcp).toBe(true);
    expect(check.reason).toBe("low_icp_fit_score");

    const capped = applyOutsideIcpCap(result, null);
    // 12 is already below the cap so the value doesn't change — the
    // outsideIcp flag is still set so callers can emit telemetry.
    expect(capped.cappedScore).toBe(12);
    expect(capped.check.outsideIcp).toBe(true);
  });

  it("no_niche_match wins over low_icp_fit_score when both apply (more specific reason)", () => {
    const result = {
      score: 18,
      reasons: [{ code: "rating_below_floor", weight: -6 }],
    };
    const check = evaluateOutsideIcp(result, {
      industryWeights: { fnb: 1 },
      subNicheWeights: {},
    });
    expect(check.outsideIcp).toBe(true);
    expect(check.reason).toBe("no_niche_match");
  });

  it("null ICP (workspace hasn't configured one) keeps the legacy neutral-50 behavior", () => {
    const result = scoreIcpFit({
      icp: null,
      lead: {
        nicheSlug: "fnb",
        subNicheSlug: null,
        priceLevel: 4,
        reviewCount: 500,
        rating: 4.9,
        borough: null,
        primaryType: null,
      },
      audit: null,
    });
    expect(result.score).toBe(50);
    const capped = applyOutsideIcpCap(result, null);
    expect(capped.check.outsideIcp).toBe(false);
    expect(capped.cappedScore).toBe(50);
  });
});
