/**
 * Truth Layer v1 — T-G "Surface Fidelity" component test.
 *
 * Pins the rendered KPI label so the cinematic operator-confusion
 * bug from PLAN §3 T-G can never regress:
 *
 *   - "9 mentions / 11 negatives = %82" was misread as "82% of all
 *     reviews mention this issue" (operator had 397 reviews, 11
 *     negatives — 82% bare percent looked apocalyptic).
 *   - The fix names the denominator base in the visible label and
 *     in the `aria-label` so screen readers never have to infer it.
 *
 * Coverage matrix:
 *   1. Greenwich Morning fixture (`{ count: 9, percent: 82 }`) →
 *      DOM contains "9 mentions" AND "82% of negative reviews",
 *      AND no bare "%82".
 *   2. Default (no `percentBase` field) preserves the existing
 *      denominator semantics ("negative reviews"). T-C hasn't
 *      shipped its schema bump yet — see component header.
 *   3. `percentBase === "total_reviews"` flips the noun to "all
 *      reviews".
 *   4. Each KPI row carries an unambiguous `aria-label` that
 *      includes the implied denominator (`9 mentions out of 11
 *      negative reviews — 82%`).
 *   5. `truth.surface.review_kpi_rendered` fires once per KPI on
 *      mount with the typed payload from `LeadDetailEventCatalog`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const captureSpy = vi.fn();

vi.mock("posthog-js", () => ({
  default: {
    __loaded: true,
    capture: (...args: unknown[]) => captureSpy(...args),
  },
}));

import {
  ReviewIntelligenceSummary,
  type ReviewIntelligenceSummaryCopy,
} from "@/components/app/lead-detail-v2/ReviewIntelligenceSummary";
import type { ReviewIntelSummaryDto } from "@/lib/lead-detail/use-decision-surface";
import { loadLeadFixture } from "../../../tests/fixtures/load-lead-fixture";

const COPY: ReviewIntelligenceSummaryCopy = {
  title: "Review intelligence",
  leadScoreLabel: "Lead score",
  sentimentLabel: "Sentiment",
  weaknessLabel: "Weak KPIs",
  switchSignalsLabel: "Switch signals",
  reviewsAnalyzed: "Reviews analysed",
  empty: "No review intel.",
  positive: "+",
  neutral: "·",
  negative: "−",
  expandTimelineCta: "View timeline →",
};

interface KpiInput {
  label: string;
  count: number | null;
  percent: number | null;
  /** T-C's future field — read defensively until that schema lands. */
  percentBase?: "negative_reviews" | "total_reviews";
}

function buildSummary(
  weaknessKpisTop3: KpiInput[],
): ReviewIntelSummaryDto {
  return {
    leadScore: 38,
    summary: null,
    sentimentBreakdown: { positive: 0.72, neutral: 0.16, negative: 0.12 },
    // The dto type doesn't expose `percentBase` yet (T-C's schema bump
    // hasn't shipped). Cast through `unknown` so the runtime payload
    // can carry the future field while the static type stays pinned
    // to what the API currently returns.
    weaknessKpisTop3: weaknessKpisTop3 as unknown as ReviewIntelSummaryDto["weaknessKpisTop3"],
    strengthKpisTop3: [],
    switchSignalsTop3: [],
    reviewsAnalyzedCount: 50,
    lastAnalyzedAt: new Date().toISOString(),
  };
}

beforeEach(() => {
  captureSpy.mockReset();
});

afterEach(() => {
  captureSpy.mockReset();
});

describe("ReviewIntelligenceSummary — T-G surface fidelity (Greenwich Morning)", () => {
  it("renders the unambiguous label for the 9/82% wait time KPI", () => {
    // Pull the canonical 9/82 KPI directly from the Wave 0 fixture so
    // any drift in the fixture (numbers being adjusted by another
    // track) is caught here too.
    const fx = loadLeadFixture("greenwich-morning");
    const kpi = fx.reviewAnalysis.weaknessKpis[0];
    expect(kpi).toMatchObject({ label: "wait time", count: 9, percent: 82 });

    render(
      <ReviewIntelligenceSummary
        summary={buildSummary([
          {
            label: kpi.label,
            count: kpi.count ?? null,
            percent: kpi.percent ?? null,
          },
        ])}
        leadId={fx.lead.id}
        copy={COPY}
      />,
    );

    const row = screen.getByTestId("review-intel-weakness-kpi");
    // Visible label — both halves of the unambiguous string must
    // appear; the bare "%82" or "82%" alone (without the qualifying
    // "of negative reviews" clause) is the bug we're shutting.
    expect(row.textContent).toContain("9 mentions");
    expect(row.textContent).toContain("82% of negative reviews");
    expect(row.textContent).not.toMatch(/^\s*wait time\s*·\s*%82\s*$/);
    expect(row.textContent).not.toMatch(/^\s*wait time\s*·\s*82%\s*$/);
  });

  it("derives the implied denominator and exposes it via aria-label", () => {
    const fx = loadLeadFixture("greenwich-morning");
    render(
      <ReviewIntelligenceSummary
        summary={buildSummary([
          { label: "wait time", count: 9, percent: 82 },
        ])}
        leadId={fx.lead.id}
        copy={COPY}
      />,
    );
    const row = screen.getByTestId("review-intel-weakness-kpi");
    // 9 / 0.82 rounds to 11 — matches the fixture's _negCount=11.
    expect(row.getAttribute("aria-label")).toBe(
      "9 mentions out of 11 negative reviews — 82%",
    );
    // `title` mirrors aria-label so hovering also reveals the base.
    expect(row.getAttribute("title")).toBe(
      "9 mentions out of 11 negative reviews — 82%",
    );
    expect(row.dataset.percentBase).toBe("negative_reviews");
  });

  it("flips the denominator noun when percentBase === 'total_reviews'", () => {
    render(
      <ReviewIntelligenceSummary
        summary={buildSummary([
          {
            label: "wait time",
            count: 9,
            percent: 2,
            percentBase: "total_reviews",
          },
        ])}
        leadId="lead_total"
        copy={COPY}
      />,
    );
    const row = screen.getByTestId("review-intel-weakness-kpi");
    expect(row.textContent).toContain("9 mentions");
    expect(row.textContent).toContain("2% of all reviews");
    expect(row.dataset.percentBase).toBe("total_reviews");
    // 9 / 0.02 = 450 reviews implied.
    expect(row.getAttribute("aria-label")).toBe(
      "9 mentions out of 450 reviews — 2%",
    );
  });

  it("emits truth.surface.review_kpi_rendered once per KPI on mount", () => {
    render(
      <ReviewIntelligenceSummary
        summary={buildSummary([
          { label: "wait time", count: 9, percent: 82 },
          {
            label: "noise",
            count: 4,
            percent: 36,
            percentBase: "total_reviews",
          },
        ])}
        leadId="lead_telemetry"
        copy={COPY}
      />,
    );

    expect(captureSpy).toHaveBeenCalledTimes(2);
    expect(captureSpy).toHaveBeenNthCalledWith(
      1,
      "truth.surface.review_kpi_rendered",
      expect.objectContaining({
        leadId: "lead_telemetry",
        percentBase: "negative_reviews",
        count: 9,
      }),
    );
    expect(captureSpy).toHaveBeenNthCalledWith(
      2,
      "truth.surface.review_kpi_rendered",
      expect.objectContaining({
        leadId: "lead_telemetry",
        percentBase: "total_reviews",
        count: 4,
      }),
    );
  });

  it("skips telemetry when leadId is absent (parent hasn't wired it)", () => {
    render(
      <ReviewIntelligenceSummary
        summary={buildSummary([
          { label: "wait time", count: 9, percent: 82 },
        ])}
        copy={COPY}
      />,
    );
    expect(captureSpy).not.toHaveBeenCalled();
    // Component still renders correctly — telemetry must never block
    // the UI (PLAN §6 risk #3).
    expect(screen.getByTestId("review-intel-weakness-kpi")).toBeInTheDocument();
  });

  it("renders the empty placeholder when summary is null", () => {
    render(
      <ReviewIntelligenceSummary
        summary={null}
        leadId="lead_empty"
        copy={COPY}
      />,
    );
    expect(screen.getByTestId("review-intel-empty")).toBeInTheDocument();
    expect(captureSpy).not.toHaveBeenCalled();
  });
});
