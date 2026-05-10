/**
 * Phase 1 — PreliminaryBanner visibility timing.
 *
 * The banner appears only when:
 *   1. preliminary has arrived
 *   2. final has NOT arrived yet
 *   3. > 25s have elapsed since mount
 *
 * It auto-hides as soon as final lands. We assert the contract by
 * driving `useDecisionSurface` indirectly via a thin harness that
 * mounts `PreliminaryBanner` with a parent that flips `visible`
 * based on Vitest fake timers — the same way `LeadDetailV2Client`
 * wires it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { useEffect, useState } from "react";

import { PreliminaryBanner } from "@/components/app/lead-detail-v2/PreliminaryBanner";

const MESSAGE = "Preliminary plan is dial-able — final reasoning still loading.";

const SHIPPABLE_THRESHOLD_MS = 25_000;

interface HarnessProps {
  hasPreliminary: boolean;
  hasFinal: boolean;
}

function Harness({ hasPreliminary, hasFinal }: HarnessProps) {
  const [shippable, setShippable] = useState(false);
  useEffect(() => {
    if (!hasPreliminary || hasFinal) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShippable(false);
      return;
    }
    const id = setTimeout(() => setShippable(true), SHIPPABLE_THRESHOLD_MS);
    return () => clearTimeout(id);
  }, [hasPreliminary, hasFinal]);

  return (
    <PreliminaryBanner
      visible={shippable && hasPreliminary && !hasFinal}
      message={MESSAGE}
    />
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PreliminaryBanner — visibility window", () => {
  it("does not render before 25s have elapsed", () => {
    render(<Harness hasPreliminary hasFinal={false} />);
    expect(screen.queryByTestId("preliminary-banner")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(SHIPPABLE_THRESHOLD_MS - 100);
    });
    expect(screen.queryByTestId("preliminary-banner")).toBeNull();
  });

  it("renders once 25s have elapsed AND preliminary is set AND final is null", () => {
    render(<Harness hasPreliminary hasFinal={false} />);
    act(() => {
      vi.advanceTimersByTime(SHIPPABLE_THRESHOLD_MS + 50);
    });
    expect(screen.getByTestId("preliminary-banner")).toBeInTheDocument();
    expect(screen.getByText(MESSAGE)).toBeInTheDocument();
  });

  it("auto-hides as soon as final arrives", () => {
    const { rerender } = render(<Harness hasPreliminary hasFinal={false} />);
    act(() => {
      vi.advanceTimersByTime(SHIPPABLE_THRESHOLD_MS + 50);
    });
    expect(screen.getByTestId("preliminary-banner")).toBeInTheDocument();

    rerender(<Harness hasPreliminary hasFinal />);
    expect(screen.queryByTestId("preliminary-banner")).toBeNull();
  });

  it("never renders when there is no preliminary at all", () => {
    render(<Harness hasPreliminary={false} hasFinal={false} />);
    act(() => {
      vi.advanceTimersByTime(SHIPPABLE_THRESHOLD_MS + 1_000);
    });
    expect(screen.queryByTestId("preliminary-banner")).toBeNull();
  });

  it("uses role=status so screen readers announce it once", () => {
    render(<Harness hasPreliminary hasFinal={false} />);
    act(() => {
      vi.advanceTimersByTime(SHIPPABLE_THRESHOLD_MS + 50);
    });
    const banner = screen.getByTestId("preliminary-banner");
    expect(banner.getAttribute("role")).toBe("status");
    expect(banner.getAttribute("aria-live")).toBe("polite");
  });
});
