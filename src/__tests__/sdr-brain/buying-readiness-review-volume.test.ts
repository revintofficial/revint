/**
 * Phase 8 — `deriveBuyingReadiness` weight regression for the new
 * `REVIEW_VOLUME_SURGE` and `REVIEW_VOLUME_DIP` trigger types.
 *
 * The plan (PLAN §4 Phase 8 test surface) says: BANT weight regression
 * on a lead pre-/post-`REVIEW_VOLUME_DIP` write — `timing` score
 * increases by ≥ 0.20. We assert both surge and dip move both `need`
 * and `timing` upward, with dip producing the larger lift on both
 * dimensions because operations-gap signals are the stronger
 * SDR opening (see PLAN §4 Phase 8 "Files to modify" notes).
 */
import { describe, it, expect } from "vitest";

import {
  deriveBuyingReadiness,
  type BuyingReadinessInput,
} from "@/lib/sdr-brain/buying-readiness";
import type { LeadTriggerType } from "@/generated/prisma/client";

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

describe("deriveBuyingReadiness — Phase 8 review-volume triggers", () => {
  it("REVIEW_VOLUME_SURGE lifts both need and timing scores", () => {
    const baseline = deriveBuyingReadiness(emptyInput());
    const withSurge = emptyInput();
    withSurge.triggers = [
      {
        type: "REVIEW_VOLUME_SURGE" as LeadTriggerType,
        severity: 60,
        confidence: 0.7,
        detectedAt: new Date(),
        urgencyWindowDays: 30,
      },
    ];
    const out = deriveBuyingReadiness(withSurge);
    expect(out.need).toBeGreaterThan(baseline.need);
    expect(out.timing).toBeGreaterThan(baseline.timing);
  });

  it("REVIEW_VOLUME_DIP lifts timing by at least 0.20 (PLAN §4 Phase 8 acceptance)", () => {
    const baseline = deriveBuyingReadiness(emptyInput());
    const withDip = emptyInput();
    withDip.triggers = [
      {
        type: "REVIEW_VOLUME_DIP" as LeadTriggerType,
        severity: 80,
        confidence: 0.85,
        detectedAt: new Date(),
        urgencyWindowDays: 30,
      },
    ];
    const out = deriveBuyingReadiness(withDip);

    // PLAN: "timing score increases by ≥ 0.20" — the deriver's
    // dimension scale is 0..100, so the equivalent is a delta of
    // at least 20 raw points. With dip weight 25 * confidence 0.85
    // * decay 1.0 = 21.25, rounded to 21.
    expect(out.timing - baseline.timing).toBeGreaterThanOrEqual(20);
    expect(out.need - baseline.need).toBeGreaterThan(0);
  });

  it("DIP outranks SURGE on both need AND timing (operations-gap > momentum signal)", () => {
    const surge = emptyInput();
    surge.triggers = [
      {
        type: "REVIEW_VOLUME_SURGE" as LeadTriggerType,
        severity: 100,
        confidence: 1,
        detectedAt: new Date(),
        urgencyWindowDays: 30,
      },
    ];
    const dip = emptyInput();
    dip.triggers = [
      {
        type: "REVIEW_VOLUME_DIP" as LeadTriggerType,
        severity: 100,
        confidence: 1,
        detectedAt: new Date(),
        urgencyWindowDays: 30,
      },
    ];
    const surgeOut = deriveBuyingReadiness(surge);
    const dipOut = deriveBuyingReadiness(dip);
    expect(dipOut.need).toBeGreaterThan(surgeOut.need);
    expect(dipOut.timing).toBeGreaterThan(surgeOut.timing);
  });

  it("decays the timing contribution with age (Phase 3 decay path still applies)", () => {
    const fresh = emptyInput();
    fresh.triggers = [
      {
        type: "REVIEW_VOLUME_DIP" as LeadTriggerType,
        severity: 80,
        confidence: 0.85,
        detectedAt: new Date(),
        urgencyWindowDays: 30,
      },
    ];
    const stale = emptyInput();
    stale.triggers = [
      {
        type: "REVIEW_VOLUME_DIP" as LeadTriggerType,
        severity: 80,
        confidence: 0.85,
        // 25 days old vs a 30-day urgency window → decay ≈ 0.17.
        detectedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
        urgencyWindowDays: 30,
      },
    ];
    const freshOut = deriveBuyingReadiness(fresh);
    const staleOut = deriveBuyingReadiness(stale);
    expect(freshOut.timing).toBeGreaterThan(staleOut.timing);
  });
});
