/**
 * SDR Brain v2 — preliminary NBA deriver.
 *
 * Phase 3 added `likelyPainPoints` → `predictedObjections`
 * propagation so the v2 lead-detail page's "anticipate these
 * objections" panel populates before the T3 brain run finishes.
 * The deriver is pure, so every test is a synthetic input with the
 * expected output assertions.
 */
import { describe, it, expect } from "vitest";

import {
  derivePreliminaryNba,
  type PreliminaryNbaInput,
} from "@/lib/sdr-brain/preliminary-nba";

function baseInput(overrides?: Partial<PreliminaryNbaInput>): PreliminaryNbaInput {
  return {
    bant: {
      budget: 30,
      authority: 25,
      need: 20,
      timing: 15,
      overall: 22,
      reasoning: { budget: [], authority: [], need: [], timing: [] },
    },
    lead: {
      icpFitScore: null,
      dnc: false,
      optedOutAt: null,
      timezone: null,
      hasWebsite: true,
      websiteUrl: "https://example.com",
    },
    triggerCount: 0,
    ...overrides,
  };
}

describe("derivePreliminaryNba — Phase 3 predictedObjections feed", () => {
  it("returns an empty `predictedObjections` array when no pain points are supplied", () => {
    const out = derivePreliminaryNba(baseInput());
    expect(out.predictedObjections).toEqual([]);
  });

  it("propagates the first 3 likely pain points verbatim", () => {
    const out = derivePreliminaryNba(
      baseInput({
        likelyPainPoints: [
          "No loyalty program",
          "Slow drink pickup",
          "Mismatched online menu",
        ],
      }),
    );
    expect(out.predictedObjections).toEqual([
      "No loyalty program",
      "Slow drink pickup",
      "Mismatched online menu",
    ]);
  });

  it("truncates to 3 even when the analyst returned more", () => {
    const out = derivePreliminaryNba(
      baseInput({
        likelyPainPoints: ["a", "b", "c", "d", "e"],
      }),
    );
    expect(out.predictedObjections).toHaveLength(3);
    expect(out.predictedObjections).toEqual(["a", "b", "c"]);
  });

  it("filters out empty / whitespace-only strings before truncating", () => {
    const out = derivePreliminaryNba(
      baseInput({
        likelyPainPoints: ["", "   ", "Real concern", "  ", "Second concern"],
      }),
    );
    expect(out.predictedObjections).toEqual(["Real concern", "Second concern"]);
  });

  it("DNC guard still preserves `predictedObjections` so the UI can pre-warm the objection panel even on dropped leads", () => {
    const out = derivePreliminaryNba(
      baseInput({
        lead: {
          icpFitScore: null,
          dnc: true,
          optedOutAt: null,
          timezone: null,
          hasWebsite: false,
          websiteUrl: null,
        },
        likelyPainPoints: ["Concern A", "Concern B"],
      }),
    );
    expect(out.actionKind).toBe("DROP_LEAD");
    expect(out.predictedObjections).toEqual(["Concern A", "Concern B"]);
  });

  it("retains `predictedObjections` across every decision branch (CALL_NOW)", () => {
    const out = derivePreliminaryNba(
      baseInput({
        bant: {
          budget: 80,
          authority: 80,
          need: 80,
          timing: 80,
          overall: 80,
          reasoning: { budget: [], authority: [], need: [], timing: [] },
        },
        triggerCount: 2,
        likelyPainPoints: ["No POS integration"],
      }),
    );
    expect(out.actionKind).toBe("CALL_NOW");
    expect(out.predictedObjections).toEqual(["No POS integration"]);
  });

  it("retains `predictedObjections` for low-overall WAIT_FOR_REPLY branch", () => {
    const out = derivePreliminaryNba(
      baseInput({
        bant: {
          budget: 10,
          authority: 10,
          need: 10,
          timing: 10,
          overall: 10,
          reasoning: { budget: [], authority: [], need: [], timing: [] },
        },
        likelyPainPoints: ["Tiny operator"],
      }),
    );
    expect(out.actionKind).toBe("WAIT_FOR_REPLY");
    expect(out.predictedObjections).toEqual(["Tiny operator"]);
  });
});
