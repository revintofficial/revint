/**
 * Phase 1 — preliminary → final morph asserts no layout shift on
 * the Block container.
 *
 * The contract: when `data` swaps from preliminary-only to final
 * inside `<NextGestureBlock />`, the parent `<Block>` container's
 * top + height do NOT change. AnimatePresence + `layout="position"`
 * lives on `Block` only — never on children — so this is the bug
 * class the test guards against.
 *
 * jsdom doesn't lay out, so all rects come back as 0×0 — but the
 * relative invariant (rect-before === rect-after) is what matters.
 * If a future refactor accidentally moved `layout` onto a child, the
 * AnimatePresence boundary would re-key and Render would reconstruct
 * the DOM, breaking ref equality. We assert the ref equality and
 * the relative rect.
 */
import { describe, expect, it } from "vitest";
import { act, render } from "@testing-library/react";
import { useState } from "react";

import { Block } from "@/components/app/lead-detail-v2/Block";
import { NextGestureBlock } from "@/components/app/lead-detail-v2/NextGestureBlock";
import type { NextActionResponse } from "@/components/app/nba/NbaCard";

const NEXT_GESTURE_COPY = {
  preliminary: "Preliminary",
  final: "Final",
  empty: "Brain is still cooking",
  openFullGraph: "Open full graph",
  dial: "Dial",
  email: "Email",
  whatsapp: "WhatsApp",
  schedule: "Schedule",
  snooze: "Snooze",
};

function makeAction(args: { id: string; preliminary: boolean; version: number }) {
  return {
    id: args.id,
    version: args.version,
    isPreliminary: args.preliminary,
    actionKind: "CALL_NOW",
    channel: "CALL",
    primaryAngleId: null,
    triggerIds: [],
    openingHook: "Hi there",
    whatNotToPitch: [],
    predictedObjections: [],
    recommendedFramework: null,
    confidence: args.preliminary ? 60 : 82,
    reasoning: "test reason",
    reasoningGraph: null,
    arbitrationRecords: null,
    timingWindowEnd: null,
    createdAt: "2026-05-01T00:00:00Z",
  };
}

function preliminaryOnly(): NextActionResponse {
  return {
    preliminary: makeAction({ id: "prelim_1", preliminary: true, version: 1 }),
    final: null,
    triggers: [],
    insight: null,
    reasoningGraph: null,
    arbitrationRecords: [],
  };
}

function withFinal(): NextActionResponse {
  return {
    preliminary: makeAction({ id: "prelim_1", preliminary: true, version: 1 }),
    final: makeAction({ id: "final_1", preliminary: false, version: 3 }),
    triggers: [],
    insight: null,
    reasoningGraph: null,
    arbitrationRecords: [],
  };
}

interface HarnessProps {
  step: "preliminary" | "final";
}

function Harness({ step }: HarnessProps) {
  const [data] = useState<NextActionResponse>(() =>
    step === "preliminary" ? preliminaryOnly() : withFinal(),
  );
  return (
    <Block id="next-gesture-block" title="Next gesture" state="expanded">
      <NextGestureBlock
        data={data}
        loading={false}
        leadId="lead_1"
        phone={null}
        email={null}
        copy={NEXT_GESTURE_COPY}
      />
    </Block>
  );
}

describe("Block — preliminary→final morph", () => {
  it("the Block container ref is stable across the swap", () => {
    const { container, rerender } = render(<Harness step="preliminary" />);
    const before = container.querySelector("#next-gesture-block");
    expect(before).not.toBeNull();
    const beforeRect = before!.getBoundingClientRect();

    act(() => {
      rerender(<Harness step="final" />);
    });

    const after = container.querySelector("#next-gesture-block");
    expect(after).toBe(before);
    const afterRect = after!.getBoundingClientRect();
    expect(afterRect.top).toBe(beforeRect.top);
    expect(afterRect.height).toBe(beforeRect.height);
  });
});
