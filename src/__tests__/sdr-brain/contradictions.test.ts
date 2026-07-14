/**
 * SDR Brain — contradiction detector unit tests.
 *
 * Each surviving rule in `CONTRADICTION_RULES` gets a positive case
 * (rule should fire) and a negative case (rule should NOT fire). The
 * detector is the deterministic pre-pass that the brief feeds into
 * the reasoning graph, so a regression here changes downstream
 * LeadNextAction.arbitrationRecords behaviour for every workspace.
 *
 * V2-cleanup — the BANT/insight-match/buying-committee/objection-
 * predictor rules were removed along with the workers that fed them.
 * The remaining five rules cover the contradictions that matter for
 * SMB restaurant-tech sales (ICP-vs-audit, opportunity-vs-reviews,
 * and trigger-overlap inconsistencies).
 */
import { describe, it, expect } from "vitest";
import {
  detectContradictions,
  CONTRADICTION_RULES,
  type T2Snapshot,
} from "@/lib/sdr-brain/contradictions";

function baseSnapshot(): T2Snapshot {
  return {
    whyNow: null,
    scorer: null,
    triggers: [],
    audit: null,
    lead: { priceLevel: null, reviewCount: null, rating: null },
  };
}

describe("CONTRADICTION_RULES inventory", () => {
  it("declares at least the surviving rule set so the detector keeps real coverage", () => {
    expect(CONTRADICTION_RULES.length).toBeGreaterThanOrEqual(5);
  });

  it("emits empty array when every signal is null/empty", () => {
    expect(detectContradictions(baseSnapshot())).toEqual([]);
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

describe("OPPORTUNITY_SCORE_VS_LOW_REVIEWS", () => {
  it("fires when opportunity score >= 80 but reviewCount <= 5", () => {
    const s = baseSnapshot();
    s.scorer = { opportunityScore: 85, icpFit: null };
    s.lead = { priceLevel: null, reviewCount: 4, rating: 4.5 };
    const out = detectContradictions(s);
    expect(out.find((c) => c.code === "OPPORTUNITY_SCORE_VS_LOW_REVIEWS")).toBeDefined();
  });

  it("does not fire when review density is healthy", () => {
    const s = baseSnapshot();
    s.scorer = { opportunityScore: 85, icpFit: null };
    s.lead = { priceLevel: null, reviewCount: 120, rating: 4.5 };
    const out = detectContradictions(s);
    expect(out.find((c) => c.code === "OPPORTUNITY_SCORE_VS_LOW_REVIEWS")).toBeUndefined();
  });
});

describe("RATING_DROP_VS_BAD_SERVICE_REVIEWS_OVERLAP", () => {
  it("fires when paired triggers disagree on severity by >= 40", () => {
    const s = baseSnapshot();
    s.triggers = [
      { id: "t1", type: "RATING_DROP", severity: 80, confidence: 0.8 },
      { id: "t2", type: "BAD_SERVICE_REVIEWS", severity: 30, confidence: 0.7 },
    ];
    const out = detectContradictions(s);
    expect(out.find((c) => c.code === "RATING_DROP_VS_BAD_SERVICE_REVIEWS_OVERLAP")).toBeDefined();
  });

  it("does not fire when paired triggers agree on severity", () => {
    const s = baseSnapshot();
    s.triggers = [
      { id: "t1", type: "RATING_DROP", severity: 70, confidence: 0.8 },
      { id: "t2", type: "BAD_SERVICE_REVIEWS", severity: 65, confidence: 0.7 },
    ];
    const out = detectContradictions(s);
    expect(out.find((c) => c.code === "RATING_DROP_VS_BAD_SERVICE_REVIEWS_OVERLAP")).toBeUndefined();
  });
});

describe("NEW_LOCATION_OPENING_VS_NO_HIRING", () => {
  it("fires when opening detected but no hiring signal", () => {
    const s = baseSnapshot();
    s.triggers = [{ id: "t1", type: "NEW_LOCATION_OPENING", severity: 80, confidence: 0.9 }];
    const out = detectContradictions(s);
    expect(out.find((c) => c.code === "NEW_LOCATION_OPENING_VS_NO_HIRING")).toBeDefined();
  });

  it("does not fire when hiring signal is also present", () => {
    const s = baseSnapshot();
    s.triggers = [
      { id: "t1", type: "NEW_LOCATION_OPENING", severity: 80, confidence: 0.9 },
      { id: "t2", type: "HIRING_OPS", severity: 60, confidence: 0.7 },
    ];
    const out = detectContradictions(s);
    expect(out.find((c) => c.code === "NEW_LOCATION_OPENING_VS_NO_HIRING")).toBeUndefined();
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
