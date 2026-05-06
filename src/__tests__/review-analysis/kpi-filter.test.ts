/**
 * Round 2 §3.10 / §3.11 — kpi-filter regression coverage.
 *
 * Pins down the seven gates `filterReviewKpis` now applies:
 *
 *   §3.10 pool floor — weakness ≥3, strength ≥5; below → []
 *   §3.10 label fusion — "X & Y" / "X and Y" / "X / Y" / "X + Y" → drop
 *   §3.11 count integrity — count > poolCount → drop (no clamp)
 *   §3.10 label echo — example is a near-restatement of the label → drop
 *   §3.10 tiny example — example < 4 tokens → drop
 *   §3.10 grounding — every example must contain a 3-word window from
 *                     the source review corpus
 *   examples ≥ 2 — KPI needs ≥2 surviving examples after the gates
 */
import { describe, expect, it } from "vitest";
import {
  filterReviewKpis,
  isExampleTooShort,
  isGroundedInCorpus,
  isLabelEchoExample,
  isLabelFusion,
  normalizeForGrounding,
} from "@/lib/review-analysis/kpi-filter";
import type { ReviewKpi } from "@/lib/prompts/review-analysis-prompt";

const CORPUS = [
  "the staff were rude and dismissive when we asked about the menu options",
  "we waited over forty minutes for our coffee on a tuesday morning",
  "the prices are very expensive for what is essentially a small flat white",
  "the toilets were locked and we were told they were for paying customers only",
  "the queue was extremely long and moved very slowly during lunch hour",
].map(normalizeForGrounding);

function kpi(partial: Partial<ReviewKpi>): ReviewKpi {
  return {
    label: "Default Label",
    count: 2,
    percent: 0,
    examples: [],
    ...partial,
  };
}

describe("isLabelFusion", () => {
  it("detects '&' / 'and' / '/' / '+' as fusion connectors", () => {
    expect(isLabelFusion("Rude Staff & Toilet Access")).toBe(true);
    expect(isLabelFusion("Slow Service and Long Wait")).toBe(true);
    expect(isLabelFusion("Pricing / Value")).toBe(true);
    expect(isLabelFusion("Hot + Cold Drinks")).toBe(true);
  });

  it("does NOT match single-concept labels that contain those characters in-word", () => {
    expect(isLabelFusion("Sandwich")).toBe(false);
    expect(isLabelFusion("The Brand")).toBe(false);
    expect(isLabelFusion("Wifi")).toBe(false);
    // 'Andrew' is a name, not a connector
    expect(isLabelFusion("Andrew")).toBe(false);
  });
});

describe("isLabelEchoExample", () => {
  it("detects examples that just restate the label with a connector", () => {
    // 0-token remainder
    expect(isLabelEchoExample("Rude Staff", "rude staff.")).toBe(true);
    // 1-token remainder ("very") → still echo
    expect(isLabelEchoExample("Slow Coffee Service", "really slow coffee service")).toBe(true);
  });

  it("does NOT match longer real quotes that include the label with ≥2 context tokens", () => {
    // "had slow response times" — 2 token remainder ("had", "times")
    expect(
      isLabelEchoExample("slow_response", "had slow response times"),
    ).toBe(false);
    // Real review quote
    expect(
      isLabelEchoExample(
        "Rude Staff",
        "the staff were rude and dismissive when we asked about the menu options",
      ),
    ).toBe(false);
  });
});

describe("isExampleTooShort", () => {
  it("drops examples shorter than 4 tokens", () => {
    expect(isExampleTooShort("£7.10")).toBe(true);
    expect(isExampleTooShort("very expensive")).toBe(true);
    expect(isExampleTooShort("the queue was long")).toBe(false);
  });
});

describe("isGroundedInCorpus", () => {
  it("requires a real 3-word window from the corpus", () => {
    expect(isGroundedInCorpus("waited over forty minutes", CORPUS)).toBe(true);
    expect(isGroundedInCorpus("the staff were rude", CORPUS)).toBe(true);
  });

  it("rejects short phrases (Round 2 tightening)", () => {
    expect(isGroundedInCorpus("expensive", CORPUS)).toBe(false);
    expect(isGroundedInCorpus("very expensive", CORPUS)).toBe(false);
  });

  it("rejects phrases that don't appear in the corpus", () => {
    expect(isGroundedInCorpus("delivery driver was late", CORPUS)).toBe(false);
  });
});

describe("filterReviewKpis — pool floor", () => {
  it("drops every weakness KPI when negative pool < 3", () => {
    const result = filterReviewKpis(
      [
        kpi({
          label: "Expensive",
          count: 1,
          examples: ["the prices are very expensive for what is essentially"],
        }),
      ],
      1,
      CORPUS,
      { kind: "weakness" },
    );
    expect(result.kpis).toEqual([]);
    expect(result.stats.droppedForPoolFloor).toBe(1);
  });

  it("drops every strength KPI when positive pool < 5", () => {
    const result = filterReviewKpis(
      [kpi({ label: "Friendly Staff", count: 3 })],
      4,
      CORPUS,
      { kind: "strength" },
    );
    expect(result.kpis).toEqual([]);
    expect(result.stats.droppedForPoolFloor).toBe(1);
  });

  it("admits weakness KPIs when negative pool ≥ 3 (and other gates pass)", () => {
    const result = filterReviewKpis(
      [
        kpi({
          label: "Wait Times",
          count: 2,
          examples: [
            "we waited over forty minutes for our coffee",
            "the queue was extremely long and moved very slowly",
          ],
        }),
      ],
      3,
      CORPUS,
      { kind: "weakness" },
    );
    expect(result.kpis).toHaveLength(1);
    expect(result.kpis[0].percent).toBe(67); // 2 / 3 * 100 rounded
  });
});

describe("filterReviewKpis — label fusion", () => {
  it("drops fused labels even when count + examples are valid", () => {
    const result = filterReviewKpis(
      [
        kpi({
          label: "Rude Staff & Toilet Access",
          count: 3,
          examples: [
            "the staff were rude and dismissive when we asked",
            "the toilets were locked and we were told they were for",
          ],
        }),
      ],
      5,
      CORPUS,
      { kind: "weakness" },
    );
    expect(result.kpis).toEqual([]);
    expect(result.stats.droppedForLabelFusion).toBe(1);
  });
});

describe("filterReviewKpis — count integrity", () => {
  it("drops a KPI whose count exceeds the pool size", () => {
    const result = filterReviewKpis(
      [
        kpi({
          label: "Expensive",
          count: 4,
          examples: [
            "the prices are very expensive for what is essentially",
            "we waited over forty minutes for our coffee",
          ],
        }),
      ],
      3,
      CORPUS,
      { kind: "weakness" },
    );
    expect(result.kpis).toEqual([]);
    expect(result.stats.droppedForCountInflation).toBe(1);
  });
});

describe("filterReviewKpis — example gates", () => {
  it("drops a KPI whose only examples are label echoes", () => {
    const result = filterReviewKpis(
      [
        kpi({
          label: "Expensive",
          count: 2,
          examples: ["This was expensive.", "Very expensive."],
        }),
      ],
      5,
      CORPUS,
      { kind: "weakness" },
    );
    expect(result.kpis).toEqual([]);
    expect(result.stats.droppedForUngroundedExamples).toBe(1);
  });

  it("drops a KPI whose examples are 1-3 token fragments", () => {
    const result = filterReviewKpis(
      [
        kpi({
          label: "Pricing",
          count: 2,
          examples: ["£7.10", "very expensive"],
        }),
      ],
      5,
      CORPUS,
      { kind: "weakness" },
    );
    expect(result.kpis).toEqual([]);
  });

  it("drops a KPI whose examples are not grounded in the corpus", () => {
    const result = filterReviewKpis(
      [
        kpi({
          label: "Slow Delivery",
          count: 2,
          examples: [
            "the delivery driver showed up an hour late tonight",
            "our courier never arrived with the food we ordered",
          ],
        }),
      ],
      5,
      CORPUS,
      { kind: "weakness" },
    );
    expect(result.kpis).toEqual([]);
  });
});

describe("filterReviewKpis — happy path with re-derived percent", () => {
  it("admits a clean weakness KPI and clamps percent to the true pool", () => {
    const result = filterReviewKpis(
      [
        kpi({
          label: "Wait Times",
          count: 2,
          percent: 50, // model-suggested, will be re-derived
          examples: [
            "we waited over forty minutes for our coffee",
            "the queue was extremely long and moved very slowly",
            "this was very expensive", // ungrounded → dropped
          ],
        }),
      ],
      8,
      CORPUS,
      { kind: "weakness" },
    );
    expect(result.kpis).toHaveLength(1);
    expect(result.kpis[0].percent).toBe(25); // 2 / 8 = 25
    expect(result.kpis[0].examples).toHaveLength(2);
  });
});
