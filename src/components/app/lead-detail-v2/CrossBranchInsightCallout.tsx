"use client";

/**
 * CrossBranchInsightCallout — the trophy callout under the
 * sister-leads table (Phase 4). Reads "Insight that won on
 * Coyoacán: '<quote>' — same trigger fires here" and offers a
 * one-click apply button.
 *
 * PLAN GATING (PLAN §5.3 line 512):
 *   - PRO_TEAM sees the callout but the apply button reads "Upgrade
 *     to AGENCY" and is disabled.
 *   - AGENCY-tier reps get a working apply that POSTs to the insight
 *     application endpoint.
 *
 * APPLY ENDPOINT — DEFERRED:
 *   The plan asks us to find an existing `POST /api/insights/[id]/apply`
 *   or equivalent. A grep across the repo shows no such route in
 *   `src/app/api/**`; `InsightApplication` rows are written today only
 *   by the `OUTCOME_ATTRIBUTOR` worker (post-call). We therefore wire
 *   the button to a defensive PostHog event
 *   (`lead_detail.cross_branch_insight.apply_attempted`) so we can
 *   measure rep intent and ship the endpoint in a follow-up. The
 *   click also calls `onApply` so a parent test can assert behaviour
 *   without depending on PostHog.
 */

import { useState } from "react";
import { Sparkles } from "lucide-react";

export interface CrossBranchInsightData {
  insightId: string;
  insightQuote: string;
  sisterLeadId: string;
  sisterLeadName: string;
  triggerType: string;
}

export interface CrossBranchInsightCalloutCopy {
  heading: string;
  /** Body template — `{sister}` and `{quote}` placeholders. */
  body: string;
  applyLabel: string;
  appliedLabel: string;
  upgradeLabel: string;
  upgradeTooltip: string;
}

export interface CrossBranchInsightCalloutProps {
  data: CrossBranchInsightData;
  /** Plan tier; "AGENCY" unlocks apply, "PRO_TEAM" sees upgrade. */
  plan: "FREE" | "PRO" | "PRO_TEAM" | "AGENCY";
  /** Optional override; defaults to the route described above. */
  upgradeHref?: string;
  /** Optional callback so tests + telemetry can observe apply. */
  onApply?: (data: CrossBranchInsightData) => void;
  copy: CrossBranchInsightCalloutCopy;
}

function safeCapture(event: string, props: Record<string, unknown>): void {
  try {
    if (typeof window === "undefined") return;
    const w = window as unknown as {
      posthog?: {
        __loaded?: boolean;
        capture?: (e: string, p: Record<string, unknown>) => void;
      };
    };
    const ph = w.posthog;
    if (!ph || !ph.__loaded || typeof ph.capture !== "function") return;
    ph.capture(event, props);
  } catch {
    // Telemetry must never break the page.
  }
}

export function CrossBranchInsightCallout({
  data,
  plan,
  upgradeHref = "/app/settings/billing",
  onApply,
  copy,
}: CrossBranchInsightCalloutProps) {
  const [applied, setApplied] = useState(false);
  const isUnlocked = plan === "AGENCY";

  const body = copy.body
    .replace("{sister}", data.sisterLeadName)
    .replace("{quote}", data.insightQuote);

  const handleApply = () => {
    if (!isUnlocked) return;
    if (applied) return;
    setApplied(true);
    safeCapture("lead_detail.cross_branch_insight.apply_attempted", {
      insightId: data.insightId,
      sisterLeadId: data.sisterLeadId,
      triggerType: data.triggerType,
    });
    safeCapture("lead_detail.cross_branch_insight.applied", {
      insightId: data.insightId,
      sisterLeadId: data.sisterLeadId,
    });
    onApply?.(data);
  };

  return (
    <div
      data-testid="cross-branch-insight-callout"
      className="flex flex-col gap-2 rounded-lg border px-3 py-3"
      style={{
        borderColor: "color-mix(in srgb, var(--leadac-500) 35%, transparent)",
        background: "color-mix(in srgb, var(--leadac-500) 6%, transparent)",
      }}
    >
      <div className="flex items-start gap-2">
        <span
          aria-hidden
          className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full"
          style={{
            background: "color-mix(in srgb, var(--leadac-500) 22%, transparent)",
            color: "var(--leadac-500)",
          }}
        >
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p
            className="text-[12px] font-medium uppercase tracking-[0.06em]"
            style={{ color: "var(--leadac-500)" }}
          >
            {copy.heading}
          </p>
          <p
            className="text-[13px] leading-snug"
            style={{ color: "var(--leadac-text-1)" }}
          >
            {body}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-end">
        {isUnlocked ? (
          <button
            type="button"
            onClick={handleApply}
            disabled={applied}
            data-testid="cross-branch-insight-apply"
            className="rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--leadac-500)/55 disabled:opacity-60"
            style={{
              background: "var(--leadac-500)",
              color: "var(--leadac-bg)",
            }}
          >
            {applied ? copy.appliedLabel : copy.applyLabel}
          </button>
        ) : (
          <a
            href={upgradeHref}
            data-testid="cross-branch-insight-upgrade"
            title={copy.upgradeTooltip}
            className="rounded-md border px-2.5 py-1 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--leadac-500)/55"
            style={{
              borderColor: "var(--leadac-border)",
              color: "var(--leadac-text-2)",
            }}
          >
            {copy.upgradeLabel}
          </a>
        )}
      </div>
    </div>
  );
}
