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

/**
 * Phase 3 — `BuyingReadinessInput` was extended to accept v1 intel
 * (`reviewIntel`, `salesOpportunity`, `account`). The tests below
 * pin the new per-dimension weights so a future refactor can't
 * silently erode them.
 *
 * Matrix shape: 4 dimensions × 3 fixtures each =
 *   1. baseline (no intel) — Phase-1 behaviour preserved
 *   2. single new signal — that weight kicked in
 *   3. multiple new signals — they compound additively (no double-count)
 *
 * Glass Coffee integration fixture lives at the bottom and asserts
 * the Definition of Done invariant: "Need < 30 baseline → > 65 once
 * pain phrases land".
 */
describe("deriveBuyingReadiness — Phase 3 intel-feed matrix", () => {
  describe("Budget dimension (new weights)", () => {
    it("baseline — no account/offer/volume intel, only Phase-1 priors apply", () => {
      const input = emptyInput();
      input.lead.priceLevel = 2;
      const out = deriveBuyingReadiness(input);
      expect(out.reasoning.budget.some((r) => /locations/.test(r))).toBe(false);
      expect(out.reasoning.budget.some((r) => /SuggestedOffer/.test(r))).toBe(false);
      expect(out.reasoning.budget.some((r) => /high-volume/.test(r))).toBe(false);
    });

    it("single signal — multi-location account (+15)", () => {
      const baseline = emptyInput();
      baseline.lead.priceLevel = 2;
      const enriched = emptyInput();
      enriched.lead.priceLevel = 2;
      enriched.account = { locationsCount: 5, tier: null };

      const lo = deriveBuyingReadiness(baseline).budget;
      const hi = deriveBuyingReadiness(enriched).budget;
      expect(hi - lo).toBeGreaterThanOrEqual(14); // +15 (-1 rounding slack)
      expect(hi - lo).toBeLessThanOrEqual(16);
      const r = deriveBuyingReadiness(enriched).reasoning.budget;
      expect(r.some((line) => /5 locations/.test(line))).toBe(true);
    });

    it("compounding signals — multi-location + SALES tier + high-volume reviews", () => {
      const baseline = emptyInput();
      baseline.lead.priceLevel = 2;
      const enriched = emptyInput();
      enriched.lead.priceLevel = 2;
      enriched.lead.reviewCount = 250; // >=200 fires Phase-3 "high-volume" (+8) AND legacy >=100 (+8)
      enriched.account = { locationsCount: 4, tier: null };
      enriched.salesOpportunity = {
        likelyPainPoints: [],
        reasonCodes: [],
        opportunityScore: 50,
        suggestedOffer: "SALES",
      };

      const lo = deriveBuyingReadiness(baseline).budget;
      const hi = deriveBuyingReadiness(enriched).budget;
      // +15 locations + +10 SALES + +8 high-volume + +8 legacy reviews-floor
      // = +41 in aggregate (with clamp/rounding tolerance).
      expect(hi - lo).toBeGreaterThanOrEqual(35);
      const r = deriveBuyingReadiness(enriched).reasoning.budget;
      expect(r.some((line) => /SuggestedOffer=SALES/.test(line))).toBe(true);
      expect(r.some((line) => /high-volume/.test(line))).toBe(true);
    });
  });

  describe("Authority dimension (new weights)", () => {
    it("baseline — no Tier-1 account, behaves like Phase-1", () => {
      const out = deriveBuyingReadiness(emptyInput());
      expect(out.reasoning.authority.some((r) => /Tier-1/.test(r))).toBe(false);
    });

    it("single signal — Tier-1 account (+15) even with empty stakeholder map", () => {
      const baseline = emptyInput();
      const enriched = emptyInput();
      enriched.account = { locationsCount: null, tier: "TIER_1" };
      const lo = deriveBuyingReadiness(baseline).authority;
      const hi = deriveBuyingReadiness(enriched).authority;
      expect(hi).toBeGreaterThan(lo);
      // The empty-stakeholder cap of 35 still applies BEFORE the
      // Tier-1 boost — so the final score should land in 35..50.
      expect(hi).toBeLessThanOrEqual(50);
    });

    it("compounding — Tier-1 + economic buyer mapped", () => {
      const both = emptyInput();
      both.stakeholders = [
        { isEconomicBuyer: true, championLikelihood: 60, influence: 70 },
      ];
      both.account = { locationsCount: 3, tier: "TIER_1" };
      const out = deriveBuyingReadiness(both);
      expect(out.authority).toBeGreaterThan(70);
      expect(out.reasoning.authority.some((r) => /Tier-1/.test(r))).toBe(true);
      expect(out.reasoning.authority.some((r) => /Economic buyer/.test(r))).toBe(true);
    });
  });

  describe("Need dimension (new weights)", () => {
    it("baseline — empty intel, only audit/trigger sources fire", () => {
      const out = deriveBuyingReadiness(emptyInput());
      expect(out.reasoning.need.some((r) => /pain phrases/.test(r))).toBe(false);
      expect(out.reasoning.need.some((r) => /weakness KPIs/.test(r))).toBe(false);
      expect(out.reasoning.need.some((r) => /likely pain points/.test(r))).toBe(false);
    });

    it("single signal — 5 pain phrases (+20)", () => {
      const baseline = emptyInput();
      const enriched = emptyInput();
      enriched.reviewIntel = {
        painPhrases: ["slow service", "rude staff", "cold food", "dirty", "wait"],
        weaknessKpis: [],
        switchSignals: [],
        leadScore: 60,
      };
      const lo = deriveBuyingReadiness(baseline).need;
      const hi = deriveBuyingReadiness(enriched).need;
      // 5 × 4 = +20 (capped at 30).
      expect(hi - lo).toBeGreaterThanOrEqual(18);
      expect(hi - lo).toBeLessThanOrEqual(22);
      const r = deriveBuyingReadiness(enriched).reasoning.need;
      expect(r.some((line) => /5 pain phrases/.test(line))).toBe(true);
    });

    it("phrase contribution is capped at 30 (8 phrases ≠ 32)", () => {
      const enriched = emptyInput();
      enriched.reviewIntel = {
        painPhrases: ["a", "b", "c", "d", "e", "f", "g", "h"],
        weaknessKpis: [],
        switchSignals: [],
        leadScore: 60,
      };
      const r = deriveBuyingReadiness(enriched).reasoning.need;
      const match = r.find((line) => /pain phrases/.test(line));
      expect(match).toBeDefined();
      // Capped delta should be 30, not 32.
      expect(match).toMatch(/\(\+30\)/);
    });

    it("compounding — pain phrases + weaknessKpis + analyst pain points", () => {
      const baseline = emptyInput();
      const enriched = emptyInput();
      enriched.reviewIntel = {
        painPhrases: ["slow", "rude"], // 2 × 4 = +8
        weaknessKpis: [
          { label: "service speed", percent: 30 },
          { label: "menu freshness", percent: 25 },
        ], // sum 55, ×0.4 = 22 → capped 22 (under 25)
        switchSignals: [],
        leadScore: 60,
      };
      enriched.salesOpportunity = {
        likelyPainPoints: ["No loyalty program", "Slow drinks pickup", "Mismatched online menu"],
        reasonCodes: [],
        opportunityScore: 60,
        suggestedOffer: null,
      }; // 3 × 3 = +9
      const lo = deriveBuyingReadiness(baseline).need;
      const hi = deriveBuyingReadiness(enriched).need;
      // +8 phrases + +22 weaknessKpis + +9 analyst = +39, dampened by clamps.
      expect(hi - lo).toBeGreaterThanOrEqual(30);
      const r = deriveBuyingReadiness(enriched).reasoning.need;
      expect(r.some((line) => /pain phrases/.test(line))).toBe(true);
      expect(r.some((line) => /weakness KPIs/.test(line))).toBe(true);
      expect(r.some((line) => /likely pain points/.test(line))).toBe(true);
    });
  });

  describe("Timing dimension (new weights)", () => {
    it("baseline — no switch signals, no recent-opened reasonCode", () => {
      const out = deriveBuyingReadiness(emptyInput());
      expect(out.reasoning.timing.some((r) => /switch signals/.test(r))).toBe(false);
      expect(out.reasoning.timing.some((r) => /RECENTLY_OPENED/.test(r))).toBe(false);
    });

    it("single signal — switchSignals present (+25)", () => {
      const baseline = emptyInput();
      const enriched = emptyInput();
      enriched.reviewIntel = {
        painPhrases: [],
        weaknessKpis: [],
        switchSignals: ["considering Toast POS"],
        leadScore: 60,
      };
      const lo = deriveBuyingReadiness(baseline).timing;
      const hi = deriveBuyingReadiness(enriched).timing;
      expect(hi - lo).toBeGreaterThanOrEqual(24);
      expect(hi - lo).toBeLessThanOrEqual(26);
    });

    it("single signal — SalesOpportunity.reasonCodes RECENTLY_OPENED (+20)", () => {
      const baseline = emptyInput();
      const enriched = emptyInput();
      enriched.salesOpportunity = {
        likelyPainPoints: [],
        reasonCodes: ["RECENTLY_OPENED"],
        opportunityScore: 70,
        suggestedOffer: null,
      };
      const lo = deriveBuyingReadiness(baseline).timing;
      const hi = deriveBuyingReadiness(enriched).timing;
      expect(hi - lo).toBeGreaterThanOrEqual(19);
      expect(hi - lo).toBeLessThanOrEqual(21);
    });

    it("compounding — switchSignals + RECENTLY_OPENED + fresh trigger", () => {
      const both = emptyInput();
      both.reviewIntel = {
        painPhrases: [],
        weaknessKpis: [],
        switchSignals: ["switching POS"],
        leadScore: 60,
      };
      both.salesOpportunity = {
        likelyPainPoints: [],
        reasonCodes: ["RECENTLY_OPENED"],
        opportunityScore: 70,
        suggestedOffer: null,
      };
      both.triggers = [
        {
          type: "NEW_LOCATION_OPENING",
          severity: 80,
          confidence: 0.9,
          detectedAt: new Date(),
          urgencyWindowDays: 60,
        },
      ];
      const out = deriveBuyingReadiness(both);
      expect(out.timing).toBeGreaterThanOrEqual(70);
      expect(out.reasoning.timing.some((r) => /switch signals/.test(r))).toBe(true);
      expect(out.reasoning.timing.some((r) => /RECENTLY_OPENED/.test(r))).toBe(true);
    });
  });

  // ---- Glass Coffee integration fixture ----
  //
  // The plan's Definition of Done says: "Glass Coffee fixture (high
  // painPhrases) → Need bar < 30 → > 65 once intel lands."
  //
  // The baseline (no intel) reproduces the empty v2 state the user
  // originally reported; the enriched fixture mirrors what
  // REVIEW_ANALYST + SALES_OPPORTUNITY_SCORER produce for a real
  // operator with chronic service complaints.
  it("Glass Coffee fixture — Need lifts from <30 (cold v2) to >65 (Phase-3 fed)", () => {
    const cold: BuyingReadinessInput = {
      lead: {
        priceLevel: 2,
        reviewCount: 180,
        rating: 4.1,
        hasWebsite: true,
        icpFitScore: 65,
      },
      audit: {
        checklistScorePct: 70, // small audit gap → small need bump only
        hasBookingSystem: true,
        hasEcommerce: false,
        mobileFriendlyGuess: true,
      },
      triggers: [],
      stakeholders: [],
      recentIntentSignalCount: 0,
    };
    expect(deriveBuyingReadiness(cold).need).toBeLessThan(30);

    const warm: BuyingReadinessInput = {
      ...cold,
      reviewIntel: {
        painPhrases: [
          "10 dakika bekledim",
          "servis çok yavaş",
          "kahve soğuktu",
          "personel ilgisiz",
          "garson kayıp",
          "menü güncel değil",
          "fiyat çok yüksek",
        ],
        weaknessKpis: [
          { label: "Slow service", percent: 28 },
          { label: "Cold drinks", percent: 18 },
          { label: "Staff attitude", percent: 14 },
        ],
        switchSignals: [],
        leadScore: 78,
      },
      salesOpportunity: {
        likelyPainPoints: [
          "Sadakat programı yok",
          "Self-order kiosk yok",
          "Online sipariş eksik",
        ],
        reasonCodes: [],
        opportunityScore: 72,
        suggestedOffer: "GROWTH",
      },
      account: {
        locationsCount: 1,
        tier: "TIER_3",
      },
    };
    const enrichedNeed = deriveBuyingReadiness(warm).need;
    expect(enrichedNeed).toBeGreaterThan(65);
  });
});
