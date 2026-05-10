"use client";

/**
 * LegacyWorkersBeacon — Phase 6 deprecation telemetry.
 *
 * The legacy 5-tab page (and a handful of v2 emails / Slack signatures
 * sent during Phase 1–5) deep-link to the lead detail with
 * `?tab=workers`. Phase 6 introduces the dedicated
 * `/app/leads/[id]/workers` route as the new canonical target. The
 * legacy `?tab=workers` keeps rendering for one full release so we
 * don't break out-of-band links — but every visit fires this beacon
 * so the dashboard can measure deprecation traffic before we delete
 * the alias.
 *
 * The beacon mounts once per render and fires `posthog.capture` once
 * per (leadId, hash, mount) tuple. It NEVER throws: telemetry must
 * not break the page.
 */

import { useEffect, useRef } from "react";
import posthog from "posthog-js";

interface LegacyWorkersBeaconProps {
  leadId: string;
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

export function LegacyWorkersBeacon({ leadId }: LegacyWorkersBeaconProps) {
  const firedRef = useRef(false);
  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    safeCapture("lead_detail.legacy_workers_link_followed", { leadId });
  }, [leadId]);
  return null;
}
