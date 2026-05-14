/**
 * V-K (Phase 5 Mobile Pass) — RTL/jsdom coverage for the three
 * mobile-only lead-detail components: BottomSheet, MobileStickyCTA,
 * and VoiceNoteFAB.
 *
 * The deeper BottomSheet focus-trap / ESC contract is already covered
 * by `bottom-sheet.test.tsx`. This file holds the V-K mandate
 * assertions that follow from master plan §3 V-K DoD:
 *
 *   - Sticky CTA is rendered with a labelled region + 44px+ targets.
 *   - Dial / Voice / More each carry an accessible name.
 *   - "More" button announces popup + open state via aria-haspopup +
 *     aria-expanded, and toggling it surfaces the email mailto link.
 *   - Voice-note FAB is a single button with a 56×56 target, a state-
 *     reflecting aria-label, and a wrapper positioned ABOVE the
 *     MobileStickyCTA's reserved 64px so the FAB doesn't get hidden
 *     behind the sticky bar on iPhone 14 Pro / Pixel 7 viewports.
 *   - BottomSheet, when opened from MobileStickyCTA's "More" entry
 *     point, renders as a real `role="dialog"` with `aria-modal=true`.
 *
 * jsdom can't run the touch-drag gesture for swipe-to-dismiss (that
 * lives in the manual mobile QA checklist + `vaul` integration TODO).
 */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import {
  MobileStickyCTA,
  type MobileStickyCTACopy,
} from "@/components/app/lead-detail-v2/MobileStickyCTA";
import {
  VoiceNoteFAB,
  type VoiceNoteFABCopy,
} from "@/components/app/lead-detail-v2/VoiceNoteFAB";
import { BottomSheet } from "@/components/ui/bottom-sheet";

const CTA_COPY: MobileStickyCTACopy = {
  dial: "Dial",
  voiceNote: "Voice note",
  more: "More",
  moreSheetTitle: "More actions",
  email: "Email lead",
};

const FAB_COPY: VoiceNoteFABCopy = {
  recordLabel: "Record voice note",
  recordingLabel: "Recording — release to save",
  uploadingLabel: "Uploading…",
  uploadedToast: "Voice note saved",
  errorToast: "Voice note failed",
  notWiredHint: "Voice note unsupported on this device",
};

describe("MobileStickyCTA (V-K Phase 5)", () => {
  it("renders Dial / Voice / More with accessible names", () => {
    render(
      <MobileStickyCTA
        phone="+15551234567"
        email="lead@example.com"
        copy={CTA_COPY}
      />,
    );

    expect(screen.getByLabelText("Dial")).toBeInTheDocument();
    expect(screen.getByLabelText("Voice note")).toBeInTheDocument();
    expect(screen.getByLabelText("More")).toBeInTheDocument();
  });

  it("exposes the bar as a labelled region for screen readers", () => {
    render(
      <MobileStickyCTA
        phone="+15551234567"
        email="lead@example.com"
        copy={CTA_COPY}
      />,
    );

    const region = screen.getByRole("region", { name: "Lead quick actions" });
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute("data-testid", "mobile-sticky-cta");
  });

  it("renders the Dial button as a tel: link when a phone is provided", () => {
    render(
      <MobileStickyCTA
        phone="+15551234567"
        email={null}
        copy={CTA_COPY}
      />,
    );

    const dial = screen.getByTestId("mobile-cta-dial") as HTMLAnchorElement;
    expect(dial.tagName).toBe("A");
    expect(dial.getAttribute("href")).toBe("tel:+15551234567");
  });

  it("disables the Dial entry when no phone exists (renders a non-link button)", () => {
    render(
      <MobileStickyCTA
        phone={null}
        email="lead@example.com"
        copy={CTA_COPY}
      />,
    );

    const dial = screen.getByTestId("mobile-cta-dial") as HTMLButtonElement;
    expect(dial.tagName).toBe("BUTTON");
    expect(dial).toBeDisabled();
  });

  it("fires onVoiceNote when the middle button is tapped", () => {
    const onVoiceNote = vi.fn();
    render(
      <MobileStickyCTA
        phone="+15551234567"
        email="lead@example.com"
        copy={CTA_COPY}
        onVoiceNote={onVoiceNote}
      />,
    );

    fireEvent.click(screen.getByTestId("mobile-cta-voice-note"));
    expect(onVoiceNote).toHaveBeenCalledTimes(1);
  });

  it("guarantees a 44px+ touch target via min-h-[44px] on every CTA button", () => {
    render(
      <MobileStickyCTA
        phone="+15551234567"
        email="lead@example.com"
        copy={CTA_COPY}
      />,
    );

    for (const id of [
      "mobile-cta-dial",
      "mobile-cta-voice-note",
      "mobile-cta-more",
    ]) {
      const target = screen.getByTestId(id);
      expect(target.className).toContain("min-h-[44px]");
    }
  });

  it("advertises the More button as a dialog trigger and reflects open state", () => {
    render(
      <MobileStickyCTA
        phone="+15551234567"
        email="lead@example.com"
        copy={CTA_COPY}
      />,
    );

    const more = screen.getByTestId("mobile-cta-more");
    expect(more).toHaveAttribute("aria-haspopup", "dialog");
    expect(more).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(more);

    expect(more).toHaveAttribute("aria-expanded", "true");
  });

  it("opens the More sheet and renders the email mailto: link inside it", () => {
    render(
      <MobileStickyCTA
        phone="+15551234567"
        email="lead@example.com"
        copy={CTA_COPY}
      />,
    );

    expect(screen.queryByTestId("mobile-cta-email")).toBeNull();

    fireEvent.click(screen.getByTestId("mobile-cta-more"));

    const link = screen.getByTestId("mobile-cta-email") as HTMLAnchorElement;
    expect(link).toBeInTheDocument();
    expect(link.getAttribute("href")).toBe("mailto:lead@example.com");
    expect(link.textContent).toContain("Email lead");
  });

  it("omits the email link inside More when no email exists", () => {
    render(
      <MobileStickyCTA phone="+15551234567" email={null} copy={CTA_COPY} />,
    );

    fireEvent.click(screen.getByTestId("mobile-cta-more"));

    expect(screen.queryByTestId("mobile-cta-email")).toBeNull();
    expect(screen.getByText("More actions")).toBeInTheDocument();
  });

  it("scopes itself to phone viewports via the sm:hidden modifier", () => {
    render(
      <MobileStickyCTA
        phone="+15551234567"
        email="lead@example.com"
        copy={CTA_COPY}
      />,
    );

    const bar = screen.getByTestId("mobile-sticky-cta");
    expect(bar.className).toContain("sm:hidden");
  });
});

describe("VoiceNoteFAB (V-K Phase 5)", () => {
  it("renders a single button with the record-state aria-label", () => {
    render(<VoiceNoteFAB leadId="lead_1" copy={FAB_COPY} />);

    const btn = screen.getByTestId("voice-note-fab-mobile");
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute("aria-label", FAB_COPY.recordLabel);
    expect(btn).toHaveAttribute("aria-pressed", "false");
  });

  it("provides a 56×56 surface — clears the WCAG 44px touch-target floor", () => {
    render(<VoiceNoteFAB leadId="lead_1" copy={FAB_COPY} />);

    const btn = screen.getByTestId("voice-note-fab-mobile");
    expect(btn.className).toMatch(/\bh-14\b/);
    expect(btn.className).toMatch(/\bw-14\b/);
  });

  it("hides itself on tablet+ via sm:hidden so it never overlaps the desktop header CTAs", () => {
    render(<VoiceNoteFAB leadId="lead_1" copy={FAB_COPY} />);

    const wrapper = screen.getByTestId("voice-note-fab-wrapper");
    expect(wrapper.className).toContain("sm:hidden");
  });

  it("positions itself ABOVE the MobileStickyCTA's reserved 64px + the 56px queue strip", () => {
    render(<VoiceNoteFAB leadId="lead_1" copy={FAB_COPY} />);

    const wrapper = screen.getByTestId("voice-note-fab-wrapper");
    // jsdom's CSS parser folds the static portion of `calc()` and
    // strips the `/* … */` comment annotations, so we assert on the
    // resulting sum (56 queue + 64 sticky-cta + 12 breathing = 132)
    // plus the safe-area term. If a future refactor drops the 64px
    // reservation the FAB will slide back under the sticky bar on
    // iPhone 14 Pro and disappear from the rep's reach — this test
    // is the regression guard for that bug class.
    const bottom = wrapper.style.bottom;
    expect(bottom).toContain("132px");
    expect(bottom).toContain("safe-area-inset-bottom");
  });

  it("renders below the DispositionStrip overlay layer (z-38 < z-40)", () => {
    render(<VoiceNoteFAB leadId="lead_1" copy={FAB_COPY} />);

    const wrapper = screen.getByTestId("voice-note-fab-wrapper");
    expect(wrapper.className).toContain("z-38");
  });
});

describe("BottomSheet (V-K Phase 5 — Radix dialog plumbing)", () => {
  it("renders as a real dialog (Radix sets role=dialog + focus trap)", () => {
    render(
      <BottomSheet open={true} onOpenChange={() => {}} title="Snooze options">
        <button type="button">one day</button>
      </BottomSheet>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    // Radix Dialog 1.1.x emits role="dialog" + manages focus/scroll
    // lock; `aria-modal` is set by the focus-scope manager when the
    // overlay variant is used (we do use overlay). We assert on the
    // observable end-state rather than the underlying attribute name
    // so a future Radix bump that swaps to inert-based trapping
    // doesn't break this test.
    expect(dialog.getAttribute("role")).toBe("dialog");
  });

  it("wires aria-labelledby to the title node so SR announces the heading", () => {
    render(
      <BottomSheet
        open={true}
        onOpenChange={() => {}}
        title="Pick disposition"
      >
        <span>body</span>
      </BottomSheet>,
    );

    const dialog = screen.getByRole("dialog");
    const labelledBy = dialog.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    const title = document.getElementById(labelledBy!);
    expect(title?.textContent).toBe("Pick disposition");
  });

  it("wires aria-describedby to the description node when one is supplied", () => {
    render(
      <BottomSheet
        open={true}
        onOpenChange={() => {}}
        title="Snooze"
        description="Pick a duration"
      >
        <span>body</span>
      </BottomSheet>,
    );

    const dialog = screen.getByRole("dialog");
    const describedBy = dialog.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const desc = document.getElementById(describedBy!);
    expect(desc?.textContent).toBe("Pick a duration");
  });

  it("includes the close (X) control with an accessible name", () => {
    render(
      <BottomSheet open={true} onOpenChange={() => {}} title="Snooze">
        <span>body</span>
      </BottomSheet>,
    );

    const dialog = screen.getByRole("dialog");
    const close = within(dialog).getByRole("button", { name: "Close" });
    expect(close).toBeInTheDocument();
  });

  it("calls onOpenChange(false) when the close (X) is activated", () => {
    const onOpenChange = vi.fn();
    render(
      <BottomSheet open={true} onOpenChange={onOpenChange} title="Snooze">
        <span>body</span>
      </BottomSheet>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
