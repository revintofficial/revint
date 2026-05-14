/**
 * Truth Layer v1 — T-D Brief Truth-Grounding: RTL render coverage
 * for the new `hypotheses[]` rendering on `IntelligenceBriefCard`.
 *
 * Master plan §3 T-D bullet 2: inferred claims live in `hypotheses[]`
 * and the UI renders them with a "may be wrong" affordance, distinct
 * from grounded `painPoints[]`. The visual contract this test pins:
 *
 *   1. Hypotheses render in their own labelled section (the "Hypotheses"
 *      heading is present alongside the "may be wrong" section caption).
 *   2. Each visible hypothesis has a per-row "may be wrong" affordance
 *      (`data-testid="intelligence-brief-hypothesis-affordance"`).
 *   3. Hypotheses with `confidence < 0.4` are HIDDEN (matches the
 *      `Hypothesis` contract comment in `pain-point@v1`).
 *   4. Hypotheses are colour-distinguished from painPoints — the
 *      hypothesis row uses a dashed border (UI cue reps depend on so
 *      they don't pitch a hypothesis as a fact). We assert this
 *      structurally rather than by computed style (jsdom doesn't
 *      run computed CSS) by checking the inline border style.
 *   5. When `hypotheses[]` is empty / omitted the section renders
 *      NOTHING — the card keeps its existing footprint.
 *   6. The aria-label on each hypothesis row carries the affordance
 *      text so screen readers cannot miss the disclaimer.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

import {
  IntelligenceBriefCard,
  type IntelligenceBriefCardCopy,
  type IntelligenceBriefHypothesis,
} from "@/components/app/lead-detail-v2/IntelligenceBriefCard";
import type { IntelligenceBriefDto } from "@/lib/lead-detail/use-decision-surface";

const EVIDENCE_COPY = {
  sourceLabel: "Source",
  dismiss: "Dismiss",
  types: {
    linkedin: "LinkedIn",
    review: "Review",
    audit: "Audit",
    "voice-note": "Voice note",
    "prior-nba": "Prior plan",
    contradiction: "Contradiction",
  },
};

const COPY: IntelligenceBriefCardCopy = {
  title: "Intelligence brief",
  salesConfidenceLabel: "Sales confidence",
  painPointsLabel: "Pain points",
  openFullBrief: "Open full brief →",
  empty: "—",
  generatedAt: "Generated",
  hypothesesLabel: "Hypotheses",
  mayBeWrongLabel: "may be wrong",
  evidence: EVIDENCE_COPY,
};

const BRIEF: IntelligenceBriefDto = {
  runId: "run_brief_99",
  generatedAt: new Date("2026-05-12T10:00:00Z").toISOString(),
  salesConfidence: 64,
  headline: "Casa Polanco — owner reply gap is the wedge",
  painPoints: ["wait time at brunch", "owner does not reply to negs"],
  whyGoodTarget:
    "Reviews consistently flag wait times — opener should lead with a digital ordering pilot.",
};

const HYPOTHESES: IntelligenceBriefHypothesis[] = [
  {
    claim: "rating drop is owner-driven, not menu-driven",
    reasoning:
      "Recent rating drop tracks with negative replies — model inference from review pattern, not a quoted source.",
    confidence: 0.62,
  },
  {
    claim: "they may switch POS in Q3",
    reasoning: "Adjacent niches in the same neighborhood switched recently.",
    confidence: 0.41,
  },
];

describe("IntelligenceBriefCard — Truth Layer T-D hypotheses[] rendering", () => {
  it("renders the Hypotheses section with both a label and the 'may be wrong' caption", () => {
    render(
      <IntelligenceBriefCard
        brief={BRIEF}
        leadId="lead_99"
        copy={COPY}
        hypotheses={HYPOTHESES}
        reasoningRouteEnabled
      />,
    );
    const section = screen.getByTestId("intelligence-brief-hypotheses");
    expect(within(section).getByText("Hypotheses")).toBeInTheDocument();
    expect(within(section).getAllByText("may be wrong").length).toBeGreaterThanOrEqual(1);
  });

  it("renders each hypothesis claim with its own 'may be wrong' affordance", () => {
    render(
      <IntelligenceBriefCard
        brief={BRIEF}
        leadId="lead_99"
        copy={COPY}
        hypotheses={HYPOTHESES}
        reasoningRouteEnabled
      />,
    );
    const rows = screen.getAllByTestId("intelligence-brief-hypothesis");
    expect(rows).toHaveLength(2);

    const claimText = rows.map((r) => r.textContent ?? "");
    expect(claimText[0]).toContain("rating drop is owner-driven");
    expect(claimText[1]).toContain("switch POS in Q3");

    const affordances = screen.getAllByTestId(
      "intelligence-brief-hypothesis-affordance",
    );
    expect(affordances).toHaveLength(2);
    for (const a of affordances) {
      expect(a).toHaveTextContent(/may be wrong/i);
    }
  });

  it("HIDES hypotheses below the 0.4 confidence floor (contract — UI hides hypotheses below 0.4)", () => {
    render(
      <IntelligenceBriefCard
        brief={BRIEF}
        leadId="lead_99"
        copy={COPY}
        hypotheses={[
          { claim: "very low confidence guess", reasoning: "n/a", confidence: 0.21 },
          ...HYPOTHESES,
        ]}
        reasoningRouteEnabled
      />,
    );
    expect(screen.queryByText(/very low confidence guess/i)).toBeNull();
    expect(screen.getAllByTestId("intelligence-brief-hypothesis")).toHaveLength(2);
  });

  it("CAPS visible hypotheses at 3 so the card footprint stays bounded", () => {
    const fourHypotheses: IntelligenceBriefHypothesis[] = [
      { claim: "hyp alpha", reasoning: "r", confidence: 0.72 },
      { claim: "hyp beta", reasoning: "r", confidence: 0.66 },
      { claim: "hyp gamma", reasoning: "r", confidence: 0.55 },
      { claim: "hyp delta", reasoning: "r", confidence: 0.51 },
    ];
    render(
      <IntelligenceBriefCard
        brief={BRIEF}
        leadId="lead_99"
        copy={COPY}
        hypotheses={fourHypotheses}
        reasoningRouteEnabled
      />,
    );
    const rows = screen.getAllByTestId("intelligence-brief-hypothesis");
    expect(rows).toHaveLength(3);
    expect(screen.queryByText("hyp delta")).toBeNull();
  });

  it("colour-distinguishes hypotheses from painPoints (dashed border + warning-tone label)", () => {
    render(
      <IntelligenceBriefCard
        brief={BRIEF}
        leadId="lead_99"
        copy={COPY}
        hypotheses={HYPOTHESES}
        reasoningRouteEnabled
      />,
    );
    const rows = screen.getAllByTestId("intelligence-brief-hypothesis");
    for (const row of rows) {
      // Inline `style="border-style: dashed"` — set via Tailwind class
      // `border-dashed`, but jsdom doesn't run Tailwind. We assert it
      // structurally using the className substring instead.
      expect(row.className).toMatch(/border-dashed/);
    }
    // The section heading uses the warning tone (inline style on the
    // span). We assert via the rendered color style attribute.
    const section = screen.getByTestId("intelligence-brief-hypotheses");
    const labelSpan = within(section).getByText("Hypotheses");
    expect(labelSpan.getAttribute("style")).toContain("color");
    expect(labelSpan.getAttribute("style")).toMatch(/leadac-warning/);
  });

  it("sets an aria-label on each row that includes the 'may be wrong' disclaimer (a11y)", () => {
    render(
      <IntelligenceBriefCard
        brief={BRIEF}
        leadId="lead_99"
        copy={COPY}
        hypotheses={HYPOTHESES}
        reasoningRouteEnabled
      />,
    );
    const rows = screen.getAllByTestId("intelligence-brief-hypothesis");
    for (const r of rows) {
      const aria = r.getAttribute("aria-label") ?? "";
      expect(aria).toMatch(/may be wrong/i);
    }
  });

  it("renders NOTHING when hypotheses is empty / omitted (footprint stays the same as legacy)", () => {
    const { container, rerender } = render(
      <IntelligenceBriefCard
        brief={BRIEF}
        leadId="lead_99"
        copy={COPY}
        hypotheses={[]}
        reasoningRouteEnabled
      />,
    );
    expect(
      container.querySelector("[data-testid='intelligence-brief-hypotheses']"),
    ).toBeNull();

    rerender(
      <IntelligenceBriefCard
        brief={BRIEF}
        leadId="lead_99"
        copy={COPY}
        reasoningRouteEnabled
      />,
    );
    expect(
      container.querySelector("[data-testid='intelligence-brief-hypotheses']"),
    ).toBeNull();
  });

  it("does NOT mix hypotheses into the painPoints list (separate sections)", () => {
    render(
      <IntelligenceBriefCard
        brief={BRIEF}
        leadId="lead_99"
        copy={COPY}
        hypotheses={HYPOTHESES}
        reasoningRouteEnabled
      />,
    );
    const painList = screen.getByTestId("intelligence-brief-pain-list");
    expect(painList.textContent).toContain("wait time at brunch");
    // Hypothesis claims must NOT appear in the pain list.
    expect(painList.textContent).not.toContain("rating drop is owner-driven");
    expect(painList.textContent).not.toContain("switch POS in Q3");
  });
});
