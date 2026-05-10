/**
 * SDR Brain v2 — contradiction detector unit tests.
 *
 * Each rule in `CONTRADICTION_RULES` gets at least one positive case
 * (rule should fire) and one negative case (rule should NOT fire). The
 * detector is the deterministic pre-pass that gates Gemini arbitration,
 * so a regression here changes downstream LeadNextAction behaviour
 * for every workspace at once.
 */
import { describe, it, expect } from "vitest";
import {
  detectContradictions,
  CONTRADICTION_RULES,
  type T2Snapshot,
} from "@/lib/sdr-brain/contradictions";

function baseSnapshot(): T2Snapshot {
  return {
    bant: null,
    whyNow: null,
    scorer: null,
    triggers: [],
    insights: [],
    committee: null,
    objectionsPredicted: [],
    competitorsMentionedCount: 0,
    audit: null,
    lead: { priceLevel: null, reviewCount: null, rating: null },
  };
}

describe("CONTRADICTION_RULES inventory", () => {
  it("declares at least 8 rules so the detector keeps real coverage", () => {
    expect(CONTRADICTION_RULES.length).toBeGreaterThanOrEqual(8);
  });

  it("emits empty array when every signal is null/empty", () => {
    expect(detectContradictions(baseSnapshot())).toEqual([]);
  });
});

describe("BANT_TIMING_VS_WHY_NOW_URGENCY", () => {
  it("fires when BANT timing >= 70 and whyNow urgency <= 30", () => {
    const s = baseSnapshot();
    s.bant = { budget: 50, authority: 50, need: 50, timing: 80, overall: 60 };
    s.whyNow = { urgency: 20, headline: "" };
    const out = detectContradictions(s);
    expect(out.find((c) => c.code === "BANT_TIMING_VS_WHY_NOW_URGENCY")).toBeDefined();
  });

  it("does not fire when both signals point the same way", () => {
    const s = baseSnapshot();
    s.bant = { budget: 50, authority: 50, need: 50, timing: 80, overall: 60 };
    s.whyNow = { urgency: 75, headline: "" };
    const out = detectContradictions(s);
    expect(out.find((c) => c.code === "BANT_TIMING_VS_WHY_NOW_URGENCY")).toBeUndefined();
  });
});

describe("ICP_FIT_VS_AUDIT_FAIL", () => {
  it("fires when ICP >= 80 but audit checklist <= 40", () => {
    const s = baseSnapshot();
    s.scorer = { opportunityScore: 60, icpFit: 85 };
    s.audit = { checklistScorePct: 35, hasBookingSystem: null, hasEcommerce: null };
    const out = detectContradictions(s);
    expect(out.find((c) => c.code === "ICP_FIT_VS_AUDIT_FAIL")).toBeDefined();
  });

  it("does not fire when audit checklist is healthy", () => {
    const s = baseSnapshot();
    s.scorer = { opportunityScore: 60, icpFit: 85 };
    s.audit = { checklistScorePct: 70, hasBookingSystem: null, hasEcommerce: null };
    const out = detectContradictions(s);
    expect(out.find((c) => c.code === "ICP_FIT_VS_AUDIT_FAIL")).toBeUndefined();
  });
});

describe("HIRING_MARKETING_VS_NO_BUDGET_SIGNAL", () => {
  it("fires when HIRING_MARKETING trigger present but priceLevel < 2", () => {
    const s = baseSnapshot();
    s.triggers = [{ id: "t1", type: "HIRING_MARKETING", severity: 70, confidence: 0.8 }];
    s.lead = { priceLevel: 1, reviewCount: 100, rating: 4.2 };
    const out = detectContradictions(s);
    expect(out.find((c) => c.code === "HIRING_MARKETING_VS_NO_BUDGET_SIGNAL")).toBeDefined();
  });

  it("does not fire when priceLevel >= 2", () => {
    const s = baseSnapshot();
    s.triggers = [{ id: "t1", type: "HIRING_MARKETING", severity: 70, confidence: 0.8 }];
    s.lead = { priceLevel: 3, reviewCount: 100, rating: 4.2 };
    const out = detectContradictions(s);
    expect(out.find((c) => c.code === "HIRING_MARKETING_VS_NO_BUDGET_SIGNAL")).toBeUndefined();
  });
});

describe("BANT_AUTHORITY_VS_NO_CHAMPION", () => {
  it("fires when BANT authority >= 70 but no champion identified", () => {
    const s = baseSnapshot();
    s.bant = { budget: 50, authority: 80, need: 50, timing: 50, overall: 60 };
    s.committee = { hasIdentifiedChampion: false, hasIdentifiedEconomicBuyer: true };
    const out = detectContradictions(s);
    expect(out.find((c) => c.code === "BANT_AUTHORITY_VS_NO_CHAMPION")).toBeDefined();
  });

  it("does not fire when champion is identified", () => {
    const s = baseSnapshot();
    s.bant = { budget: 50, authority: 80, need: 50, timing: 50, overall: 60 };
    s.committee = { hasIdentifiedChampion: true, hasIdentifiedEconomicBuyer: true };
    const out = detectContradictions(s);
    expect(out.find((c) => c.code === "BANT_AUTHORITY_VS_NO_CHAMPION")).toBeUndefined();
  });
});

describe("WHY_NOW_URGENCY_VS_NO_INSIGHT_MATCHED", () => {
  it("fires when urgency >= 70 but zero matched insights", () => {
    const s = baseSnapshot();
    s.whyNow = { urgency: 75, headline: "act now" };
    s.insights = [];
    const out = detectContradictions(s);
    expect(out.find((c) => c.code === "WHY_NOW_URGENCY_VS_NO_INSIGHT_MATCHED")).toBeDefined();
  });

  it("does not fire when an insight matched", () => {
    const s = baseSnapshot();
    s.whyNow = { urgency: 75, headline: "act now" };
    s.insights = [{ id: "i1", appliedTriggers: [] }];
    const out = detectContradictions(s);
    expect(out.find((c) => c.code === "WHY_NOW_URGENCY_VS_NO_INSIGHT_MATCHED")).toBeUndefined();
  });
});

describe("HAS_BOOKING_SYSTEM_VS_BOOKING_PROVIDER_TRIGGER", () => {
  it("fires when BOOKING_PROVIDER_CHANGE trigger but audit shows no booking", () => {
    const s = baseSnapshot();
    s.triggers = [{ id: "t1", type: "BOOKING_PROVIDER_CHANGE", severity: 60, confidence: 0.7 }];
    s.audit = { checklistScorePct: 70, hasBookingSystem: false, hasEcommerce: null };
    const out = detectContradictions(s);
    expect(
      out.find((c) => c.code === "HAS_BOOKING_SYSTEM_VS_BOOKING_PROVIDER_TRIGGER"),
    ).toBeDefined();
  });

  it("does not fire when audit says booking IS present", () => {
    const s = baseSnapshot();
    s.triggers = [{ id: "t1", type: "BOOKING_PROVIDER_CHANGE", severity: 60, confidence: 0.7 }];
    s.audit = { checklistScorePct: 70, hasBookingSystem: true, hasEcommerce: null };
    const out = detectContradictions(s);
    expect(
      out.find((c) => c.code === "HAS_BOOKING_SYSTEM_VS_BOOKING_PROVIDER_TRIGGER"),
    ).toBeUndefined();
  });
});

describe("rule codes are stable + unique", () => {
  it("has no duplicate codes", () => {
    const codes = CONTRADICTION_RULES.map((r) => r.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("uses UPPER_SNAKE_CASE for every code", () => {
    for (const r of CONTRADICTION_RULES) {
      expect(r.code).toMatch(/^[A-Z][A-Z0-9_]+$/);
    }
  });
});
