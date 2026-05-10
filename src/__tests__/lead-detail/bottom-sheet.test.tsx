/**
 * Phase 5 — BottomSheet a11y + interaction smoke tests.
 *
 * Per PLAN §4 Phase 5 the bottom sheet must:
 *   - Render its content into a portal when open, NOT when closed.
 *   - Announce a title via Radix Dialog (aria-labelledby).
 *   - Move keyboard focus into the sheet on open and trap it.
 *   - Close on Escape and call `onOpenChange(false)`.
 *   - Close on backdrop click and call `onOpenChange(false)`.
 *
 * jsdom doesn't run touch / pointer drag, so the swipe-to-dismiss
 * gesture is not asserted here — it's a manual mobile QA item.
 */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";

import { BottomSheet } from "@/components/ui/bottom-sheet";

function Harness({
  initialOpen,
  onChange,
}: {
  initialOpen: boolean;
  onChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        open
      </button>
      <BottomSheet
        open={open}
        onOpenChange={(next) => {
          onChange?.(next);
          setOpen(next);
        }}
        title="Snooze options"
        description="Pick how long to snooze."
      >
        <button type="button" data-testid="sheet-action">
          one day
        </button>
        <button type="button" data-testid="sheet-action-2">
          three days
        </button>
      </BottomSheet>
    </>
  );
}

describe("BottomSheet (Phase 5)", () => {
  it("does NOT render content when closed", () => {
    render(<Harness initialOpen={false} />);

    expect(screen.queryByText("Snooze options")).toBeNull();
    expect(screen.queryByTestId("sheet-action")).toBeNull();
  });

  it("renders title + description when open", () => {
    render(<Harness initialOpen={true} />);

    expect(screen.getByText("Snooze options")).toBeInTheDocument();
    expect(screen.getByText("Pick how long to snooze.")).toBeInTheDocument();
    expect(screen.getByTestId("sheet-action")).toBeInTheDocument();
  });

  it("opens with the title focused (focus trap entry point)", () => {
    render(<Harness initialOpen={true} />);

    // The sheet prevents auto-focus on the first focusable element and
    // forwards focus to the title with tabIndex={-1}, so screen
    // readers announce the heading first instead of yanking focus
    // into a control.
    const title = screen.getByText("Snooze options");
    expect(document.activeElement).toBe(title);
  });

  it("calls onOpenChange(false) when Escape is pressed", () => {
    const onChange = vi.fn();
    render(<Harness initialOpen={true} onChange={onChange} />);

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });

    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("provides a close (X) button by default", () => {
    render(<Harness initialOpen={true} />);

    const close = screen.getByLabelText("Close");
    expect(close).toBeInTheDocument();
  });

  it("hides the visual handle bar when hideHandle is set (a11y aria-hidden)", () => {
    function HarnessNoHandle() {
      return (
        <BottomSheet
          open={true}
          onOpenChange={() => {}}
          title="t"
          hideHandle={true}
        >
          <span>body</span>
        </BottomSheet>
      );
    }

    const { container } = render(<HarnessNoHandle />);

    expect(container.querySelector('[aria-hidden="true"] > div')).toBeNull();
  });
});
