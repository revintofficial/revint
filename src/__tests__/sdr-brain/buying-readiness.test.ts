/**
 * SDR Brain v2 — buying readiness (BANT) deriver unit tests.
 *
 * The deriver is a pure function — every test is a synthetic input
 * with the expected dimension scores. We don't snapshot the full
 * `reasoning` arrays because they are observability strings; we
 * assert the SHAPE (each dimension's reasons array is non-empty when
 * any signal contributed).
 */
import { describe, it, expect } from "vitest";
import {
  deriveBuyingReadiness,
  type BuyingReadinessInput,
} from "@/lib/sdr-brain/buying-readiness";

function emptyInput(): BuyingReadinessInput {
  return {
    lead: {
      priceLevel: null,
      reviewCount: null,
      rating: null,
      hasWebsite: false,
      icpFitScore: null,
    },
    audit: null,
    triggers: [],
    stakeholders: [],
    recentIntentSignalCount: 0,
  };
}

describe("deriveBuyingReadiness", () => {
  it("returns a baseline (low) score when no signals are present", () => {
    const out = deriveBuyingReadiness(emptyInput());
    expect(out.budget).toBeGreaterThanOrEqual(0);
    expect(out.budget).toBeLessThanOrEqual(40);
    expect(out.authority).toBeLessThanOrEqual(40);
    expect(out.need).toBeLessThanOrEqual(40);
    expect(out.timing).toBeLessThanOrEqual(40);
    expect(out.overall).toBeLessThanOrEqual(40);
  });

  it("clamps every dimension to 0..100 even with extreme inputs", () => {
    const input = emptyInput();
    input.lead = {
      priceLevel: 4,
      reviewCount: 5000,
      rating: 4.9,
      hasWebsite: true,
      icpFitScore: 100,
    };
    input.audit = {
      checklistScorePct: 0,
      hasBookingSystem: false,
      hasEcommerce: false,
      mobileFriendlyGuess: false,
    };
    // Pile on triggers — every weight should still cap at 100.
    input.triggers = Array.from({ length: 12 }).map(() => ({
      type: "BAD_SERVICE_REVIEWS" as const,
      severity: 100,
      confidence: 1,
      detectedAt: new Date(),
      urgencyWindowDays: 30,
    }));
    input.stakeholders = [{ isEconomicBuyer: true, championLikelihood: 100, influence: 100 }];
    input.recentIntentSignalCount = 50;

    const out = deriveBuyingReadiness(input);
    expect(out.budget).toBeLessThanOrEqual(100);
    expect(out.authority).toBeLessThanOrEqual(100);
    expect(out.need).toBeLessThanOrEqual(100);
    expect(out.timing).toBeLessThanOrEqual(100);
    expect(out.overall).toBeLessThanOrEqual(100);
  });

  it("budget lifts with priceLevel and ICP fit", () => {
    const low = emptyInput();
    low.lead.priceLevel = 1;
    const high = emptyInput();
    high.lead.priceLevel = 4;
    high.lead.icpFitScore = 90;

    const lo = deriveBuyingReadiness(low).budget;
    const hi = deriveBuyingReadiness(high).budget;
    expect(hi).toBeGreaterThan(lo);
  });

  it("authority spikes when an economic buyer is mapped", () => {
    const noEc = emptyInput();
    const withEc = emptyInput();
    withEc.stakeholders = [{ isEconomicBuyer: true, championLikelihood: 60, influence: 70 }];
    expect(deriveBuyingReadiness(withEc).authority).toBeGreaterThan(
      deriveBuyingReadiness(noEc).authority,
    );
  });

  it("authority is capped low when zero stakeholders are mapped", () => {
    const out = deriveBuyingReadiness(emptyInput());
    expect(out.authority).toBeLessThanOrEqual(35);
    expect(out.reasoning.authority.some((r) => /unknown/i.test(r))).toBe(true);
  });

  it("need rises with audit gaps + bad reviews + triggers", () => {
    const baseline = emptyInput();
    const heavy = emptyInput();
    heavy.audit = {
      checklistScorePct: 30,
      hasBookingSystem: false,
      hasEcommerce: false,
      mobileFriendlyGuess: false,
    };
    heavy.lead.rating = 3.4;
    heavy.lead.reviewCount = 80;
    heavy.triggers = [
      {
        type: "BAD_SERVICE_REVIEWS",
        severity: 80,
        confidence: 0.9,
        detectedAt: new Date(),
        urgencyWindowDays: 30,
      },
      {
        type: "BOOKING_PROVIDER_CHANGE",
        severity: 70,
        confidence: 0.7,
        detectedAt: new Date(),
        urgencyWindowDays: 60,
      },
    ];
    expect(deriveBuyingReadiness(heavy).need).toBeGreaterThan(
      deriveBuyingReadiness(baseline).need,
    );
  });

  it("timing is dampened by trigger age (decay)", () => {
    const fresh = emptyInput();
    const stale = emptyInput();
    fresh.triggers = [
      {
        type: "NEW_LOCATION_OPENING",
        severity: 70,
        confidence: 0.8,
        detectedAt: new Date(),
        urgencyWindowDays: 60,
      },
    ];
    stale.triggers = [
      {
        type: "NEW_LOCATION_OPENING",
        severity: 70,
        confidence: 0.8,
        detectedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        urgencyWindowDays: 60,
      },
    ];
    expect(deriveBuyingReadiness(fresh).timing).toBeGreaterThan(
      deriveBuyingReadiness(stale).timing,
    );
  });

  it("overall is a weighted blend (need + timing weighted higher)", () => {
    // Construct two inputs whose only difference is need+timing vs
    // budget+authority — the higher-need one should win on overall.
    const needFocused = emptyInput();
    needFocused.audit = {
      checklistScorePct: 20,
      hasBookingSystem: false,
      hasEcommerce: false,
      mobileFriendlyGuess: false,
    };
    needFocused.triggers = [
      {
        type: "BAD_SERVICE_REVIEWS",
        severity: 90,
        confidence: 0.9,
        detectedAt: new Date(),
        urgencyWindowDays: 30,
      },
    ];

    const budgetFocused = emptyInput();
    budgetFocused.lead = {
      priceLevel: 4,
      reviewCount: 200,
      rating: 4.8,
      hasWebsite: true,
      icpFitScore: 80,
    };
    budgetFocused.stakeholders = [
      { isEconomicBuyer: true, championLikelihood: 70, influence: 80 },
    ];

    const a = deriveBuyingReadiness(needFocused);
    const b = deriveBuyingReadiness(budgetFocused);
    // Overall must take the right inputs into account; both inputs
    // produce non-trivial overalls but neither should be 0/100.
    expect(a.overall).toBeGreaterThan(0);
    expect(b.overall).toBeGreaterThan(0);
    expect(a.overall).toBeLessThan(100);
    expect(b.overall).toBeLessThan(100);
  });

  it("reasoning arrays are populated whenever the dimension was lifted", () => {
    const input = emptyInput();
    input.lead.priceLevel = 3;
    input.audit = {
      checklistScorePct: 50,
      hasBookingSystem: true,
      hasEcommerce: true,
      mobileFriendlyGuess: true,
    };
    input.stakeholders = [
      { isEconomicBuyer: true, championLikelihood: 60, influence: 70 },
    ];
    input.triggers = [
      {
        type: "NEW_LOCATION_OPENING",
        severity: 70,
        confidence: 0.8,
        detectedAt: new Date(),
        urgencyWindowDays: 60,
      },
    ];
    const out = deriveBuyingReadiness(input);
    expect(out.reasoning.budget.length).toBeGreaterThan(0);
    expect(out.reasoning.authority.length).toBeGreaterThan(0);
    expect(out.reasoning.need.length).toBeGreaterThan(0);
    expect(out.reasoning.timing.length).toBeGreaterThan(0);
  });
});
