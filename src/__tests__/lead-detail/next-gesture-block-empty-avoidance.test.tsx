/**
 * Truth Layer T-F (Wave 2) — `NextGestureBlock` empty-avoidance test.
 *
 * Pins the §3 (T-F) UI test surface:
 *   1. When `recommendedPackage.features` overlaps every entry in
 *      `data.final.whatNotToPitch`, the validator drops them all and
 *      the avoidance section is NOT rendered (no empty card per
 *      master plan §3 / T-F).
 *   2. When at least one avoidance topic survives the validator, the
 *      v2 section IS rendered with a `data-testid` marker we can
 *      query.
 *   3. `truth.nba.avoidance_overlap_dropped` telemetry fires with the
 *      dropped topic list when the validator removes anything.
 *   4. Predicted objections render through `<ClaimWithEvidence>` so
 *      the V-L Phase 7 audit pin is satisfied.
 *
 * The flag `TRUTH_LAYER_AVOIDANCE_VALIDATOR` is forced ON via env so
 * the validator path runs deterministically — the dev default is also
 * ON but pinning it here keeps the test stable in CI prod-style runs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
  } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { trackMock } = vi.hoisted(() => ({ trackMock: vi.fn() }));
vi.mock("@/lib/lead-detail/telemetry", async () => {
  const actual = await vi.importActual<typeof import("@/lib/lead-detail/telemetry")>(
    "@/lib/lead-detail/telemetry",
  );
  return {
    ...actual,
    track: trackMock,
  };
});

import { NextGestureBlock } from "@/components/app/lead-detail-v2/NextGestureBlock";
import { CLAIM_WITH_EVIDENCE_DATA_ATTR } from "@/components/app/lead-detail-v2/ClaimWithEvidence";
import type {
  LeadNextActionDto,
  NextActionResponse,
} from "@/components/app/nba/NbaCard";
import type { RecommendedPackageDto } from "@/lib/lead-detail/use-decision-surface";

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

const COPY = {
  preliminary: "Preliminary",
  final: "Final",
  empty: "No NBA.",
  openFullGraph: "Open graph",
  dial: "Dial",
  email: "Email",
  whatsapp: "WhatsApp",
  schedule: "Schedule",
  snooze: "Snooze",
  predictedObjectionsLabel: "Predicted objections",
  avoidanceLabel: "What NOT to pitch",
  evidence: EVIDENCE_COPY,
  snoozeMenu: {
    trigger: "Snooze",
    heading: "Snooze",
    oneDay: "1 day",
    threeDays: "3 days",
    oneWeek: "1 week",
    custom: "Custom",
    customDialogTitle: "Custom snooze",
    customDialogDescription: "Pick a date.",
    customPickerLabel: "Date",
    customSubmit: "Snooze",
    customCancel: "Cancel",
    untilTrigger: "Until trigger",
    untilTriggerDialogTitle: "Snooze until trigger",
    untilTriggerDialogDescription: "Pick a trigger.",
    cancel: "Cancel",
    triggerLabels: {},
  } as never,
};

function makeNba(overrides: Partial<LeadNextActionDto> = {}): LeadNextActionDto {
  return {
    id: "nba_42",
    version: 3,
    isPreliminary: false,
    actionKind: "EMAIL_FIRST",
    channel: null,
    primaryAngleId: null,
    triggerIds: [],
    openingHook: "Hi.",
    whatNotToPitch: [],
    predictedObjections: [],
    recommendedFramework: null,
    confidence: 80,
    reasoning: "Test reasoning.",
    reasoningGraph: null,
    arbitrationRecords: null,
    timingWindowEnd: null,
    createdAt: "2026-05-14T00:00:00.000Z",
    ...overrides,
  };
}

function makeData(
  overrides: Partial<LeadNextActionDto> = {},
): NextActionResponse {
  return {
    preliminary: null,
    final: makeNba(overrides),
    triggers: [],
    insight: null,
    reasoningGraph: null,
    arbitrationRecords: [],
  };
}

const RESERVATIONS_PACKAGE: RecommendedPackageDto = {
  id: "pkg_reservations",
  name: "Reservations Pack",
  priceLabel: "$X/mo",
  features: ["online_reservations", "loyalty_program"],
  reason: null,
};

beforeEach(() => {
  process.env.TRUTH_LAYER_AVOIDANCE_VALIDATOR = "on";
  delete process.env.TRUTH_LAYER_AVOIDANCE_VALIDATOR_WORKSPACES;
  trackMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("NextGestureBlock — Truth Layer T-F empty-avoidance hiding", () => {
  it("hides the avoidance section when validator drops every topic (Casa Polanco regression)", () => {
    const data = makeData({
      whatNotToPitch: ["online reservations missing"],
      predictedObjections: ["I'm not sure we have budget for this."],
    });

    const { container } = render(
      <NextGestureBlock
        data={data}
        loading={false}
        leadId="lead_casa"
        workspaceId="ws_casa"
        phone="+52 55 1234 5678"
        email={null}
        recommendedPackage={RESERVATIONS_PACKAGE}
        personalizedFirstMessage={null}
        triggers={[]}
        callQuestions={[]}
        salesTalkingPointsMarkdown={null}
        copy={COPY}
      />,
    );

    expect(
      container.querySelector(
        "[data-testid='next-gesture-avoidance-section']",
      ),
    ).toBeNull();
    // Belt + braces: the dropped string itself must not appear anywhere.
    expect(screen.queryByText("online reservations missing")).toBeNull();
    // Section heading must not render.
    expect(screen.queryByText(COPY.avoidanceLabel)).toBeNull();
  });

  it("emits truth.nba.avoidance_overlap_dropped with the dropped topic list", () => {
    const data = makeData({
      whatNotToPitch: ["online reservations missing", "loud music vibes"],
    });

    render(
      <NextGestureBlock
        data={data}
        loading={false}
        leadId="lead_casa"
        workspaceId="ws_casa"
        phone="+52 55 1234 5678"
        email={null}
        recommendedPackage={RESERVATIONS_PACKAGE}
        personalizedFirstMessage={null}
        triggers={[]}
        callQuestions={[]}
        salesTalkingPointsMarkdown={null}
        copy={COPY}
      />,
    );

    expect(trackMock).toHaveBeenCalledWith(
      "truth.nba.avoidance_overlap_dropped",
      expect.objectContaining({
        leadId: "lead_casa",
        workspaceId: "ws_casa",
        droppedTopics: ["online reservations missing"],
      }),
    );
  });

  it("renders the avoidance section when at least one topic survives the validator", () => {
    const data = makeData({
      whatNotToPitch: ["loud music vibes"],
    });

    const { container } = render(
      <NextGestureBlock
        data={data}
        loading={false}
        leadId="lead_keep"
        workspaceId="ws_keep"
        phone={null}
        email={null}
        recommendedPackage={RESERVATIONS_PACKAGE}
        personalizedFirstMessage={null}
        triggers={[]}
        callQuestions={[]}
        salesTalkingPointsMarkdown={null}
        copy={COPY}
      />,
    );

    const section = container.querySelector(
      "[data-testid='next-gesture-avoidance-section']",
    );
    expect(section).not.toBeNull();
    expect(screen.getByText("loud music vibes")).toBeInTheDocument();
    // No drop fired → telemetry stays silent.
    expect(trackMock).not.toHaveBeenCalledWith(
      "truth.nba.avoidance_overlap_dropped",
      expect.anything(),
    );
  });

  it("wraps each predictedObjection in a ClaimWithEvidence wrapper (V-L audit pin)", () => {
    const data = makeData({
      predictedObjections: [
        "We are already working on this internally.",
        "I'd need to check with my partner first.",
      ],
    });

    const { container } = render(
      <NextGestureBlock
        data={data}
        loading={false}
        leadId="lead_obj"
        workspaceId="ws_obj"
        phone="+1 555 000 0000"
        email={null}
        recommendedPackage={null}
        personalizedFirstMessage={null}
        triggers={[]}
        callQuestions={[]}
        salesTalkingPointsMarkdown={null}
        copy={COPY}
      />,
    );

    const objSection = container.querySelector(
      "[data-testid='next-gesture-objections-section']",
    );
    expect(objSection).not.toBeNull();
    const objClaims = container.querySelectorAll(
      "[data-testid='next-gesture-objection-claim']",
    );
    expect(objClaims.length).toBe(2);
    for (const node of Array.from(objClaims)) {
      expect(node.hasAttribute(CLAIM_WITH_EVIDENCE_DATA_ATTR)).toBe(true);
    }
  });

  it("falls back to pass-through when TRUTH_LAYER_AVOIDANCE_VALIDATOR is off (kill switch)", () => {
    process.env.TRUTH_LAYER_AVOIDANCE_VALIDATOR = "off";

    const data = makeData({
      whatNotToPitch: ["online reservations missing"],
    });

    const { container } = render(
      <NextGestureBlock
        data={data}
        loading={false}
        leadId="lead_off"
        workspaceId="ws_off"
        phone={null}
        email={null}
        recommendedPackage={RESERVATIONS_PACKAGE}
        personalizedFirstMessage={null}
        triggers={[]}
        callQuestions={[]}
        salesTalkingPointsMarkdown={null}
        copy={COPY}
      />,
    );

    // Flag off → topic NOT dropped → avoidance section renders.
    const section = container.querySelector(
      "[data-testid='next-gesture-avoidance-section']",
    );
    expect(section).not.toBeNull();
    expect(screen.getByText("online reservations missing")).toBeInTheDocument();
    // And no overlap-dropped telemetry should have fired.
    expect(trackMock).not.toHaveBeenCalledWith(
      "truth.nba.avoidance_overlap_dropped",
      expect.anything(),
    );
  });
});
