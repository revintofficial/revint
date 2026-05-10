"use client";

/**
 * DispositionStrip — Phase 3 4-chip post-call overlay.
 *
 * Appears via the `<RecentDialContext>` provider when
 * `now - lastDialAt < 5min`. Chips: Connected / Voicemail / No-answer
 * / Wrong-#. One tap persists via `/api/leads/[id]/dispositions` (the
 * lightweight Phase 3 sibling of `/log-call`; see that route's
 * header for the rationale).
 *
 * Stacking: lives ABOVE the queue strip in the StickyShell. The
 * queue strip's `overlayInset` prop reserves the extra 56px so we
 * never produce CLS (build plan §6 risk #2).
 *
 * Focus: traps focus on appearance via `<dialog>`-like behavior
 * (we use a Framer Motion overlay backed by a div with `role="region"`
 * and `aria-label`). On dismiss (one chip selected, tap outside, ESC,
 * or 30s auto-timeout), focus returns to the trigger element passed
 * via the `dialButtonRef` prop.
 *
 * Auto-dismiss: 30 seconds with no interaction.
 *
 * Phase 5: phone viewport renders the chips inside the global
 * `<BottomSheet>` primitive so iOS Safari's URL bar can collapse
 * without overlapping the dial CTA. Desktop keeps the inline
 * popover-style fixed-bottom bar so the rep can keep typing notes
 * without the chips taking over the viewport.
 */

import {
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import posthog from "posthog-js";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, PhoneOff, Voicemail, X } from "lucide-react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useIsPhone } from "@/lib/use-viewport";
import { useRecentDial } from "./RecentDialContext";

export type DispositionShortcut =
  | "connected"
  | "voicemail"
  | "no_answer"
  | "wrong_number";

export interface DispositionStripCopy {
  heading: string;
  connected: string;
  voicemail: string;
  noAnswer: string;
  wrongNumber: string;
  dismiss: string;
}

export interface DispositionStripProps {
  leadId: string;
  copy: DispositionStripCopy;
  /** Reference to the Dial button so we can return focus on dismiss. */
  dialButtonRef?: RefObject<HTMLElement | null>;
  /** Called after the API write completes successfully. */
  onLogged?: (disposition: DispositionShortcut) => void;
}

const AUTO_DISMISS_MS = 30_000;

function safeCapture(event: string, props: Record<string, unknown>): void {
  try {
    if (typeof window === "undefined") return;
    const ph = posthog as unknown as {
      __loaded?: boolean;
      capture?: (e: string, p: Record<string, unknown>) => void;
    };
    if (!ph.__loaded || typeof ph.capture !== "function") return;
    ph.capture(event, props);
  } catch {
    // Telemetry must never break the page.
  }
}

export function DispositionStrip({
  leadId,
  copy,
  dialButtonRef,
  onLogged,
}: DispositionStripProps): ReactNode {
  const isPhone = useIsPhone();
  const { recentDialFor, clearRecent } = useRecentDial();
  const state = recentDialFor(leadId);
  const visible = state.isRecent;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const submittingRef = useRef(false);
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const dismiss = useCallback(() => {
    clearRecent(leadId);
    const target = dialButtonRef?.current;
    if (target && typeof target.focus === "function") {
      try {
        target.focus();
      } catch {
        // Focus management best-effort.
      }
    }
  }, [clearRecent, leadId, dialButtonRef]);

  const submit = useCallback(
    async (shortcut: DispositionShortcut) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      try {
        const res = await fetch(`/api/leads/${leadId}/dispositions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            disposition: shortcut,
            calledAt:
              state.lastDialAt?.toISOString() ?? new Date().toISOString(),
          }),
        });
        if (!res.ok) return;
        safeCapture("lead_detail.disposition", {
          leadId,
          disposition: shortcut,
        });
        onLogged?.(shortcut);
      } catch {
        // Surface failures via toast in a future iteration.
      } finally {
        submittingRef.current = false;
        dismiss();
      }
    },
    [leadId, dismiss, onLogged, state.lastDialAt],
  );

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [visible, dismiss]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, dismiss]);

  useEffect(() => {
    if (!visible || isPhone) return;
    const node = containerRef.current;
    if (!node) return;
    const focusable = node.querySelector<HTMLButtonElement>("button");
    focusable?.focus();
  }, [visible, isPhone]);

  if (isPhone) {
    return (
      <BottomSheet
        open={visible}
        onOpenChange={(o) => {
          if (!o) dismiss();
        }}
        title={copy.heading}
        snap="auto"
      >
        <div
          data-testid="disposition-strip"
          className="grid grid-cols-2 gap-2 pb-2"
        >
          <Chip
            label={copy.connected}
            testid="disposition-connected"
            icon={<CheckCircle2 className="h-3 w-3" aria-hidden />}
            onClick={() => void submit("connected")}
            block
          />
          <Chip
            label={copy.voicemail}
            testid="disposition-voicemail"
            icon={<Voicemail className="h-3 w-3" aria-hidden />}
            onClick={() => void submit("voicemail")}
            block
          />
          <Chip
            label={copy.noAnswer}
            testid="disposition-no-answer"
            icon={<PhoneOff className="h-3 w-3" aria-hidden />}
            onClick={() => void submit("no_answer")}
            block
          />
          <Chip
            label={copy.wrongNumber}
            testid="disposition-wrong-number"
            icon={<X className="h-3 w-3" aria-hidden />}
            onClick={() => void submit("wrong_number")}
            block
          />
        </div>
      </BottomSheet>
    );
  }

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          ref={containerRef}
          role="region"
          aria-label={copy.heading}
          data-testid="disposition-strip"
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: reducedMotion ? 0.12 : 0.18 }}
          className="fixed inset-x-0 bottom-14 z-40 mx-auto flex max-w-3xl items-center gap-2 border-t border-white/8 px-3 py-2 sm:px-6"
          style={{
            background: "hsl(var(--leadac-h) var(--leadac-ns) 10% / 0.95)",
            backdropFilter: "saturate(160%) blur(20px)",
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)",
          }}
        >
          <span
            className="shrink-0 text-[11px] uppercase tracking-[0.08em]"
            style={{ color: "var(--leadac-text-3)" }}
          >
            {copy.heading}
          </span>
          <div className="flex flex-1 flex-wrap items-center gap-1.5">
            <Chip
              label={copy.connected}
              testid="disposition-connected"
              icon={<CheckCircle2 className="h-3 w-3" aria-hidden />}
              onClick={() => void submit("connected")}
            />
            <Chip
              label={copy.voicemail}
              testid="disposition-voicemail"
              icon={<Voicemail className="h-3 w-3" aria-hidden />}
              onClick={() => void submit("voicemail")}
            />
            <Chip
              label={copy.noAnswer}
              testid="disposition-no-answer"
              icon={<PhoneOff className="h-3 w-3" aria-hidden />}
              onClick={() => void submit("no_answer")}
            />
            <Chip
              label={copy.wrongNumber}
              testid="disposition-wrong-number"
              icon={<X className="h-3 w-3" aria-hidden />}
              onClick={() => void submit("wrong_number")}
            />
          </div>
          <button
            type="button"
            aria-label={copy.dismiss}
            onClick={dismiss}
            data-testid="disposition-dismiss"
            className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--leadac-500)/55"
            style={{ color: "var(--leadac-text-3)" }}
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

interface ChipProps {
  label: string;
  testid: string;
  icon: ReactNode;
  onClick: () => void;
  /** Phone bottom-sheet uses a full-width grid cell. */
  block?: boolean;
}

function Chip({ label, testid, icon, onClick, block }: ChipProps) {
  return (
    <button
      type="button"
      data-testid={testid}
      onClick={onClick}
      className={
        block
          ? "inline-flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-3 text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--leadac-500)/55"
          : "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--leadac-500)/55"
      }
      style={{
        borderColor: "color-mix(in srgb, var(--leadac-500) 45%, transparent)",
        color: "var(--leadac-text-1)",
        background: "color-mix(in srgb, var(--leadac-500) 8%, transparent)",
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
