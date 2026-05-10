"use client";

/**
 * QueueStrip — Phase 3 bottom-sticky 56px strip.
 *
 * Layout:
 *   `Today X/Y  ‹ prev   ⏻ snooze   ✓ done   next ›`
 *   `NEXT: <name> ★ <tier> · WHY NOW: <whyNow trim 80> · ETA <eta>`
 *
 * Behavior:
 *   - `next` calls `router.prefetch('/app/leads/<nextId>?v=2')` then
 *     `router.push(...)` so the next lead is warm by the time the rep
 *     lands. Same for `prev`.
 *   - `done` triggers PostHog `lead_detail.queue.advance` and routes
 *     to the next lead. DB persistence (mark-complete) is deferred
 *     to a future iteration — see TODO below; this PR keeps `done`
 *     as a UI primitive, not a write.
 *   - Locked state (FREE plan) renders the static "Done — start your
 *     day" string instead of the strip controls.
 *   - Auto-hides on mobile (≤640px) when any text input, textarea, or
 *     contenteditable element on the page has focus. Implemented
 *     CSS-only in globals.css via `:has()` on `[data-lead-detail-shell]`
 *     toggling `display: none` on `[data-queue-strip-wrapper]`. Button
 *     focus does NOT trigger the rule because we exclude button-like
 *     input types.
 *
 * Keyboard nav: prev / snooze / done / next are all real `<button>`s
 * so Tab + Enter / Space work natively.
 */

import { useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ZapOff,
} from "lucide-react";

import type { QueueItem } from "@/lib/lead-detail/use-lead-queue";

export interface QueueStripCopy {
  todayPrefix: string;
  prev: string;
  snooze: string;
  done: string;
  next: string;
  emptyDoneStartYourDay: string;
  nextLeadPrefix: string;
  whyNowPrefix: string;
  etaPrefix: string;
  etaNow: string;
  etaSecondsSuffix: string;
  etaMinutesSuffix: string;
  etaHoursSuffix: string;
  etaDaysSuffix: string;
}

export interface QueueStripProps {
  items: QueueItem[];
  totalToday: number;
  doneToday: number;
  locked: boolean;
  currentLeadId: string;
  copy: QueueStripCopy;
  /** Prompts the parent SnoozeMenu trigger to open. Optional. */
  onSnooze?: () => void;
  /** Optional handler — renders a Done button when supplied. */
  onDone?: () => void;
}

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

function formatEta(seconds: number | null, copy: QueueStripCopy): string {
  if (seconds == null) return "";
  if (seconds <= 0) return copy.etaNow;
  if (seconds < 60) return `${seconds}${copy.etaSecondsSuffix}`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}${copy.etaMinutesSuffix}`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}${copy.etaHoursSuffix}`;
  const days = Math.round(hours / 24);
  return `${days}${copy.etaDaysSuffix}`;
}

function trimWhyNow(value: string | null, max = 60): string {
  if (!value) return "";
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

export function QueueStrip({
  items,
  totalToday,
  doneToday,
  locked,
  currentLeadId,
  copy,
  onSnooze,
  onDone,
}: QueueStripProps): ReactNode {
  const router = useRouter();

  const queue = items.filter((i) => i.id !== currentLeadId);
  const next = queue[0] ?? null;
  const prev = items.find((i) => i.id !== currentLeadId) ?? null;
  const positionDisplay = `${doneToday}/${totalToday}`;

  const advance = useCallback(
    (target: QueueItem | null, direction: "next" | "prev") => {
      if (!target) return;
      const href = `/app/leads/${target.id}?v=2`;
      try {
        router.prefetch(href);
      } catch {
        // prefetch is a hint; safe to ignore failures.
      }
      safeCapture("lead_detail.queue.advance", {
        leadId: target.id,
        position: doneToday + 1,
        totalToday,
        direction,
      });
      router.push(href);
    },
    [router, doneToday, totalToday],
  );

  if (locked) {
    return (
      <div
        className="flex h-full items-center justify-center px-4 text-[12px]"
        style={{ color: "var(--leadac-text-3)" }}
        data-testid="queue-strip-locked"
      >
        {copy.emptyDoneStartYourDay}
      </div>
    );
  }

  return (
    <div
      className="flex h-full items-center gap-3 px-3 sm:px-6"
      data-testid="queue-strip"
      role="navigation"
      aria-label="Lead queue"
    >
      <span
        className="shrink-0 text-[12px] font-medium tabular-nums"
        style={{ color: "var(--leadac-text-2)" }}
      >
        {copy.todayPrefix} {positionDisplay}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        <ControlButton
          aria-label={copy.prev}
          disabled={!prev}
          onClick={() => advance(prev, "prev")}
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        </ControlButton>
        <ControlButton
          aria-label={copy.snooze}
          disabled={onSnooze == null}
          onClick={onSnooze}
        >
          <ZapOff className="h-3.5 w-3.5" aria-hidden />
        </ControlButton>
        <ControlButton
          aria-label={copy.done}
          disabled={onDone == null && next == null}
          onClick={() => {
            // TODO(phase 3.1): persist done as a write (mark-outcome
            // endpoint or a `STAGE_CHANGED` activity row). Until
            // then we only emit telemetry and advance the queue.
            onDone?.();
            advance(next, "next");
          }}
        >
          <Check className="h-3.5 w-3.5" aria-hidden />
        </ControlButton>
        <ControlButton
          aria-label={copy.next}
          disabled={!next}
          onClick={() => advance(next, "next")}
        >
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </ControlButton>
      </div>
      {next ? (
        <span
          className="ml-auto truncate text-[11px]"
          style={{ color: "var(--leadac-text-3)" }}
          title={next.name}
        >
          <span style={{ color: "var(--leadac-text-2)" }}>
            {copy.nextLeadPrefix}
          </span>{" "}
          <span style={{ color: "var(--leadac-text-1)" }}>{next.name}</span>
          {next.accountTier ? (
            <span
              className="ml-1.5 rounded-full px-1.5 text-[10px]"
              style={{
                background: "color-mix(in srgb, var(--leadac-500) 15%, transparent)",
                color: "var(--leadac-text-2)",
              }}
            >
              ★ {next.accountTier.replace("TIER_", "T")}
            </span>
          ) : null}
          {next.whyNow ? (
            <>
              {" · "}
              <span style={{ color: "var(--leadac-text-2)" }}>
                {copy.whyNowPrefix}
              </span>{" "}
              {trimWhyNow(next.whyNow, 48)}
            </>
          ) : null}
          {next.nextActionEtaSeconds != null ? (
            <>
              {" · "}
              <span style={{ color: "var(--leadac-text-2)" }}>
                {copy.etaPrefix}
              </span>{" "}
              {formatEta(next.nextActionEtaSeconds, copy)}
            </>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

interface ControlButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  "aria-label": string;
}

function ControlButton(props: ControlButtonProps) {
  const { children, onClick, disabled, "aria-label": label } = props;
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--leadac-500)/55 disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        color: "var(--leadac-text-1)",
        background: disabled
          ? "transparent"
          : "color-mix(in srgb, var(--leadac-500) 6%, transparent)",
      }}
    >
      {children}
    </button>
  );
}
