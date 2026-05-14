/**
 * Phase 1.7 unit — `deriveCallQuestions` priority cascade.
 *
 * Covers the four-source priority order documented in the helper:
 *   1. SPIN PROBLEM rows (always wins)
 *   2. Brief confirmed pain points (audit/review-verified)
 *   3. Broader brief pain points
 *   4. Niche-aware generic fallback
 *
 * Plus the cap (3 items), dedupe (lowercased prefix), and the
 * "always 3 items" guarantee that the FourThingsCard depends on.
 */
import { describe, expect, it } from "vitest";

import { deriveCallQuestions } from "@/lib/lead-detail/derive-call-questions";

describe("deriveCallQuestions", () => {
  it("always returns exactly 3 questions when fully empty", () => {
    const out = deriveCallQuestions({
      spinProblems: [],
      confirmedPainPoints: [],
      painPoints: [],
      niche: null,
      subNicheLabel: null,
    });
    expect(out).toHaveLength(3);
    for (const q of out) {
      expect(q.length).toBeGreaterThan(0);
      expect(q.length).toBeLessThanOrEqual(140);
    }
  });

  it("uses SPIN PROBLEM rows verbatim when present", () => {
    const out = deriveCallQuestions({
      spinProblems: [
        { text: "Are reservations dropping mid-week" },
        { text: "How do you measure no-shows" },
        { text: "Is staff turnover hurting consistency" },
      ],
      confirmedPainPoints: ["bad reviews"],
      painPoints: ["whatever"],
      niche: "RESTAURANT_TECH",
      subNicheLabel: null,
    });
    expect(out).toHaveLength(3);
    expect(out[0]).toBe("Are reservations dropping mid-week?");
    expect(out[1]).toBe("How do you measure no-shows?");
    expect(out[2]).toBe("Is staff turnover hurting consistency?");
  });

  it("falls back to confirmed pain points when SPIN is empty", () => {
    const out = deriveCallQuestions({
      spinProblems: [],
      confirmedPainPoints: ["slow service", "outdated menu"],
      painPoints: ["other"],
      niche: "RESTAURANT_TECH",
      subNicheLabel: null,
    });
    expect(out[0]).toContain("slow service");
    expect(out[0]).toMatch(/\?$/);
    expect(out[1]).toContain("outdated menu");
    // Remaining slot filled by either the broader painPoints or a
    // niche generic — either is acceptable, just not empty.
    expect(out).toHaveLength(3);
    expect(out[2].length).toBeGreaterThan(0);
  });

  it("falls back to broader painPoints after confirmed pain points run out", () => {
    const out = deriveCallQuestions({
      spinProblems: [],
      confirmedPainPoints: ["slow service"],
      painPoints: ["weak website", "no booking system"],
      niche: "RESTAURANT_TECH",
      subNicheLabel: null,
    });
    expect(out[0]).toContain("slow service");
    expect(out[1]).toContain("weak website");
    expect(out[2]).toContain("no booking system");
  });

  it("emits niche-aware fallback questions when every source is empty", () => {
    const out = deriveCallQuestions({
      spinProblems: [],
      confirmedPainPoints: [],
      painPoints: [],
      niche: "RESTAURANT_TECH",
      subNicheLabel: null,
    });
    expect(out).toHaveLength(3);
    // Restaurant fallback should reference "restaurant", not "business".
    expect(out.some((q) => q.toLowerCase().includes("restaurant"))).toBe(true);
  });

  it("uses the sub-niche label in the fallback audience word", () => {
    const out = deriveCallQuestions({
      spinProblems: [],
      confirmedPainPoints: [],
      painPoints: [],
      niche: null,
      subNicheLabel: "italian_restaurant",
    });
    expect(out[0].toLowerCase()).toContain("italian restaurant");
  });

  it("dedupes near-identical entries by lowercased prefix", () => {
    const out = deriveCallQuestions({
      spinProblems: [],
      confirmedPainPoints: ["slow service times", "Slow Service Times"],
      painPoints: ["totally different concern"],
      niche: null,
      subNicheLabel: null,
    });
    expect(out).toHaveLength(3);
    // Only one "slow service" line.
    const slowCount = out.filter((q) => q.toLowerCase().includes("slow service")).length;
    expect(slowCount).toBe(1);
  });

  it("caps long pain phrases at 140 characters", () => {
    const long = "this is a very long pain phrase ".repeat(20);
    const out = deriveCallQuestions({
      spinProblems: [],
      confirmedPainPoints: [long],
      painPoints: [],
      niche: null,
      subNicheLabel: null,
    });
    expect(out[0].length).toBeLessThanOrEqual(140);
  });

  it("preserves an already-question string from confirmed pain", () => {
    const out = deriveCallQuestions({
      spinProblems: [],
      confirmedPainPoints: ["Are you happy with current booking flow?"],
      painPoints: [],
      niche: null,
      subNicheLabel: null,
    });
    // Should NOT wrap in "How are you handling ...?"
    expect(out[0]).toBe("Are you happy with current booking flow?");
  });

  it("never returns more than 3 items even with abundant input", () => {
    const out = deriveCallQuestions({
      spinProblems: [
        { text: "Q1" },
        { text: "Q2" },
        { text: "Q3" },
        { text: "Q4" },
        { text: "Q5" },
      ],
      confirmedPainPoints: ["a", "b", "c"],
      painPoints: ["d", "e"],
      niche: "WEB_AGENCY",
      subNicheLabel: null,
    });
    expect(out).toHaveLength(3);
  });
});
