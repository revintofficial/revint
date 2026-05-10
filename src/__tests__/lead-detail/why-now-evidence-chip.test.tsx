/**
 * Phase 1 — render check that LeadTrigger[] produces the right
 * inline-evidence-chip count and types.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { WhyNowBlock } from "@/components/app/lead-detail-v2/WhyNowBlock";
import type {
  LeadTriggerDto,
  LeadNextActionDto,
} from "@/lib/lead-detail/use-decision-surface";

const COPY = {
  empty: "No active trigger.",
  windowDays: "Act within {days}d",
  windowToday: "Act today",
  evidence: {
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
  },
};

function makeTrigger(overrides: Partial<LeadTriggerDto>): LeadTriggerDto {
  return {
    id: overrides.id ?? `t_${Math.random()}`,
    type: overrides.type ?? "HIRING_MARKETING",
    severity: overrides.severity ?? 70,
    confidence: overrides.confidence ?? 0.8,
    detectedAt: overrides.detectedAt ?? "2026-05-01T00:00:00Z",
    urgencyWindowDays: overrides.urgencyWindowDays ?? 7,
    evidence: overrides.evidence ?? { quote: "owner hired CMO last week" },
    impactPrediction: overrides.impactPrediction ?? null,
  };
}

function makeNba(): LeadNextActionDto {
  return {
    id: "nba_1",
    version: 1,
    isPreliminary: false,
    actionKind: "CALL_NOW",
    channel: null,
    primaryAngleId: null,
    triggerIds: [],
    openingHook: null,
    whatNotToPitch: [],
    predictedObjections: [],
    recommendedFramework: null,
    confidence: 80,
    reasoning: "fallback reason",
    reasoningGraph: null,
    arbitrationRecords: null,
    timingWindowEnd: null,
    createdAt: "2026-05-01T00:00:00Z",
  };
}

describe("WhyNowBlock — evidence chips", () => {
  it("renders one chip per trigger with the right type label", () => {
    const triggers = [
      makeTrigger({
        id: "t1",
        type: "HIRING_MARKETING",
        impactPrediction: "Hired CMO",
      }),
      makeTrigger({ id: "t2", type: "RATING_DROP" }),
      makeTrigger({ id: "t3", type: "DELIVERY_EXPANSION" }),
    ];
    render(
      <WhyNowBlock
        triggers={triggers}
        preliminary={null}
        final={null}
        copy={COPY}
      />,
    );
    const evidence = screen.getByTestId("why-now-evidence");
    const buttons = evidence.querySelectorAll("button");
    expect(buttons).toHaveLength(3);
    expect(buttons[0].getAttribute("aria-label")).toContain("LinkedIn");
    expect(buttons[1].getAttribute("aria-label")).toContain("Review");
    expect(buttons[2].getAttribute("aria-label")).toContain("Audit");
  });

  it("renders the empty copy when there are no triggers and no NBA reason", () => {
    render(
      <WhyNowBlock
        triggers={[]}
        preliminary={null}
        final={null}
        copy={COPY}
      />,
    );
    expect(screen.getByText("No active trigger.")).toBeInTheDocument();
  });

  it("falls back to the NBA reasoning when triggers are empty", () => {
    const nba = makeNba();
    render(
      <WhyNowBlock
        triggers={[]}
        preliminary={null}
        final={nba}
        copy={COPY}
      />,
    );
    expect(screen.getByText("fallback reason")).toBeInTheDocument();
  });

  it("renders the urgency window when at least one trigger has urgencyWindowDays", () => {
    const triggers = [
      makeTrigger({ id: "t1", type: "RATING_DROP", urgencyWindowDays: 3 }),
      makeTrigger({ id: "t2", type: "HIRING_MARKETING", urgencyWindowDays: null }),
    ];
    render(
      <WhyNowBlock
        triggers={triggers}
        preliminary={null}
        final={null}
        copy={COPY}
      />,
    );
    expect(screen.getByText("Act within 3d")).toBeInTheDocument();
  });
});
