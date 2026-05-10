"use client";

/**
 * ClosestWinCallout — Phase 3 pure UI fed by the aggregator's
 * `closestWin` field. Renders only when `closestWin != null`. Shows a
 * single line: "Closest win: <reframe / framework / trigger> — same
 * trigger fires here", with a one-tap `[apply]` button.
 *
 * The button posts to the existing insight-application endpoint when
 * one is available; for Phase 3 it falls back to a PostHog-only
 * surface (`lead_detail.closest_win.applied`) and a TODO comment.
 * Wiring to a real endpoint is a Phase 4 follow-on (Phase 4 owns the
 * cross-branch insight callout that shares this primitive).
 */

import { useCallback, useEffect, useRef } from "react";
import posthog from "posthog-js";
import { Trophy } from "lucide-react";

import type { ClosestWinDto } from "@/lib/lead-detail/use-decision-surface";

export interface ClosestWinCalloutCopy {
  prefix: string;
  triggerSuffix: string;
  apply: string;
  // Template with `{won}` and `{applied}` placeholders. We pass a plain
  // string (not a formatter fn) because this copy object is serialized
  // across the Server→Client component boundary in Next.js 16.
  detailsTemplate: string;
}

export interface ClosestWinCalloutProps {
  leadId: string;
  data: ClosestWinDto | null;
  copy: ClosestWinCalloutCopy;
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

export function ClosestWinCallout({
  leadId,
  data,
  copy,
}: ClosestWinCalloutProps) {
  const shownRef = useRef(false);

  useEffect(() => {
    if (!data) return;
    if (shownRef.current) return;
    shownRef.current = true;
    safeCapture("lead_detail.closest_win.shown", {
      leadId,
      sisterLeadId: data.sisterLeadId,
      insightId: data.insightId,
    });
  }, [data, leadId]);

  const onApply = useCallback(() => {
    if (!data) return;
    safeCapture("lead_detail.closest_win.applied", {
      leadId,
      insightId: data.insightId,
    });
    // TODO(phase 4): POST to the existing insight-application
    // endpoint when Phase 4 lands. For now we emit telemetry only —
    // the real write is a Phase 4 deliverable.
  }, [data, leadId]);

  if (!data) return null;

  const triggerLabel = data.triggerType
    ? data.triggerType.toLowerCase().replace(/_/g, " ")
    : null;

  return (
    <div
      data-testid="closest-win-callout"
      className="mb-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-[12px]"
      style={{
        background: "color-mix(in srgb, var(--leadac-500) 6%, transparent)",
        borderColor: "color-mix(in srgb, var(--leadac-500) 30%, transparent)",
        color: "var(--leadac-text-1)",
      }}
    >
      <Trophy className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <div className="flex flex-1 flex-col gap-1">
        <p className="text-[12px]">
          <span className="font-medium" style={{ color: "var(--leadac-text-1)" }}>
            {copy.prefix}
          </span>
          {triggerLabel ? (
            <>
              {" "}
              <span style={{ color: "var(--leadac-text-2)" }}>
                {triggerLabel}
              </span>{" "}
              <span style={{ color: "var(--leadac-text-3)" }}>
                — {copy.triggerSuffix}
              </span>
            </>
          ) : null}
        </p>
        <p className="text-[11px]" style={{ color: "var(--leadac-text-3)" }}>
          {copy.detailsTemplate
            .replace("{won}", String(data.won))
            .replace("{applied}", String(data.applied))}
        </p>
      </div>
      <button
        type="button"
        onClick={onApply}
        data-testid="closest-win-apply"
        className="ml-auto shrink-0 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--leadac-500)/55"
        style={{
          borderColor: "color-mix(in srgb, var(--leadac-500) 45%, transparent)",
          color: "var(--leadac-text-1)",
        }}
      >
        {copy.apply}
      </button>
    </div>
  );
}
