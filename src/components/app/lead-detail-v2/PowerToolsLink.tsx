"use client";

/**
 * PowerToolsLink — top-right anchor that takes the rep to the
 * full Workers panel.
 *
 * Phase 6: target is the dedicated `/app/leads/[id]/workers` route.
 * Click fires `lead_detail.power_tools.viewed` so the dashboard can
 * track adoption of the dedicated route vs the legacy
 * `?tab=workers&v=1` URL (which still works for one release).
 *
 * Mounts with id `power-tools-link` so the legacy-hash redirect for
 * pre-Phase-6 deep links has an anchor target on the v2 page until
 * the navigation pattern fully replaces hash anchors.
 */

import Link from "next/link";
import { Wrench } from "lucide-react";
import posthog from "posthog-js";

export interface PowerToolsLinkProps {
  leadId: string;
  label: string;
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

export function PowerToolsLink({ leadId, label }: PowerToolsLinkProps) {
  return (
    <Link
      id="power-tools-link"
      data-testid="power-tools-link"
      href={`/app/leads/${leadId}/workers`}
      onClick={() => safeCapture("lead_detail.power_tools.viewed", { leadId })}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/3 px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--leadac-500)/55"
      style={{ color: "var(--leadac-text-2)" }}
    >
      <Wrench className="h-3 w-3" aria-hidden />
      <span>{label}</span>
      <span aria-hidden>→</span>
    </Link>
  );
}
