"use client";

/**
 * MobileStickyCTA — Phase 5 phone-only sticky action bar.
 *
 * Renders ONLY on viewports < 640px (sm breakpoint). On desktop the
 * lead-detail header already provides the Dial / Email / Voice-note
 * quick actions. This bar reserves 64px at the bottom so neither the
 * QueueStrip nor any content reflows when it appears (CLS = 0 rule,
 * PLAN §6 risk #1).
 *
 * Layout (left → right):
 *   [ Dial  |  Voice note  |  ⋯ More ]
 *
 * - Dial: tel: link — opens the native dialer immediately.
 * - Voice note: scrolls to / opens the DiscoveryBlock voice-note FAB.
 * - ⋯ More: opens a BottomSheet with Email + other secondary actions.
 *
 * The bar auto-hides when a text input inside [data-lead-detail-shell]
 * has focus (via the CSS :has() rule in globals.css that was added in
 * Phase 3 to hide the queue strip). It lives ABOVE the queue strip
 * (z-index 39) so the 56px queue strip is always visible below it.
 *
 * A11y: each button has a visible label and aria-label. The "More"
 * sheet traps focus (via BottomSheet → Radix Dialog).
 */

import { useState, type ReactNode } from "react";
import { Phone, Mic, MoreHorizontal, Mail } from "lucide-react";

import { BottomSheet } from "@/components/ui/bottom-sheet";

export interface MobileStickyCTACopy {
  dial: string;
  voiceNote: string;
  more: string;
  moreSheetTitle: string;
  email: string;
}

export interface MobileStickyCTAProps {
  phone: string | null;
  email: string | null;
  copy: MobileStickyCTACopy;
  /** Called when the voice-note button is tapped. */
  onVoiceNote?: () => void;
}

interface CTAButtonProps {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  primary?: boolean;
}

function CTAButton({
  icon,
  label,
  onClick,
  href,
  disabled,
  primary,
}: CTAButtonProps): ReactNode {
  const sharedClass =
    "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium uppercase tracking-[0.06em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--leadac-500)/55 disabled:opacity-40";

  if (href) {
    return (
      <a
        href={href}
        className={sharedClass}
        aria-label={label}
        style={{ color: primary ? "var(--leadac-500)" : "var(--leadac-text-2)" }}
      >
        {icon}
        <span>{label}</span>
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={sharedClass}
      style={{ color: primary ? "var(--leadac-500)" : "var(--leadac-text-2)" }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function MobileStickyCTA({
  phone,
  email,
  copy,
  onVoiceNote,
}: MobileStickyCTAProps): ReactNode {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      {/* Spacer so content behind the bar is never obscured (CLS = 0). */}
      <div
        aria-hidden
        className="sm:hidden"
        style={{ height: 64 }}
      />

      <div
        data-testid="mobile-sticky-cta"
        className="fixed inset-x-0 bottom-14 z-39 flex sm:hidden"
        style={{
          borderTop: "0.5px solid hsl(0 0% 100% / 0.08)",
          background: "hsl(var(--leadac-h) var(--leadac-ns) 10% / 0.96)",
          backdropFilter: "saturate(160%) blur(20px)",
          WebkitBackdropFilter: "saturate(160%) blur(20px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <CTAButton
          icon={<Phone className="h-5 w-5" strokeWidth={2} />}
          label={copy.dial}
          href={phone ? `tel:${phone}` : undefined}
          disabled={!phone}
          primary
        />

        <div
          aria-hidden
          style={{
            width: "0.5px",
            alignSelf: "stretch",
            background: "hsl(0 0% 100% / 0.06)",
            margin: "8px 0",
          }}
        />

        <CTAButton
          icon={<Mic className="h-5 w-5" strokeWidth={2} />}
          label={copy.voiceNote}
          onClick={onVoiceNote}
        />

        <div
          aria-hidden
          style={{
            width: "0.5px",
            alignSelf: "stretch",
            background: "hsl(0 0% 100% / 0.06)",
            margin: "8px 0",
          }}
        />

        <CTAButton
          icon={<MoreHorizontal className="h-5 w-5" strokeWidth={2} />}
          label={copy.more}
          onClick={() => setMoreOpen(true)}
        />
      </div>

      <BottomSheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        title={copy.moreSheetTitle}
        snap="auto"
      >
        <div className="flex flex-col gap-1 pb-2">
          {email ? (
            <a
              href={`mailto:${email}`}
              data-testid="mobile-cta-email"
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-[15px] transition-colors active:bg-white/5"
              style={{ color: "var(--leadac-text-1)" }}
            >
              <Mail
                className="h-5 w-5 shrink-0"
                style={{ color: "var(--leadac-500)" }}
                aria-hidden
              />
              {copy.email}
            </a>
          ) : null}
        </div>
      </BottomSheet>
    </>
  );
}
