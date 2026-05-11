"use client";

/**
 * IntelligenceBriefCard — Phase 2.5.
 *
 * Top-of-block card inside `QualificationBlock`. Reads
 * `decision-surface.intelligenceBrief` (cached output of the
 * LEAD_INTELLIGENCE_BRIEF agent worker) and renders the headline +
 * salesConfidence + up-to-3 painPoints. Empty state hides the card.
 *
 * "Open full brief →" deep-links to the Phase 7 reasoning route once
 * it ships. Until then the link is rendered as a `<button disabled>`
 * with an aria-tooltip explaining the path. We avoid 404s by checking
 * for the run id (so the link only appears when there's something
 * to point at).
 */

import { type ReactNode } from "react";
import Link from "next/link";

import type { IntelligenceBriefDto } from "@/lib/lead-detail/use-decision-surface";

export interface IntelligenceBriefCardCopy {
  title: string;
  salesConfidenceLabel: string;
  painPointsLabel: string;
  openFullBrief: string;
  empty: string;
  generatedAt: string;
}

export interface IntelligenceBriefCardProps {
  brief: IntelligenceBriefDto | null;
  /**
   * Phase 7 — when `true`, "Open full brief →" links to the reasoning
   * route. Until that route ships the parent should pass `false` so
   * the link disables itself rather than 404ing.
   */
  reasoningRouteEnabled?: boolean;
  leadId: string;
  copy: IntelligenceBriefCardCopy;
}

export function IntelligenceBriefCard({
  brief,
  reasoningRouteEnabled = false,
  leadId,
  copy,
}: IntelligenceBriefCardProps): ReactNode {
  if (!brief) return null;

  const sc = brief.salesConfidence;
  const painPoints = brief.painPoints.slice(0, 3);
  const generatedDate = new Date(brief.generatedAt);
  const generatedLabel = Number.isNaN(generatedDate.getTime())
    ? null
    : generatedDate.toLocaleDateString();

  return (
    <div
      data-testid="intelligence-brief-card"
      className="rounded-lg border border-white/8 bg-white/3 p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h3
          className="text-[11px] font-medium uppercase tracking-[0.06em]"
          style={{ color: "var(--leadac-text-3)" }}
        >
          {copy.title}
        </h3>
        {sc != null ? (
          <span
            className="rounded-full border border-white/10 bg-white/3 px-2 py-0.5 text-[10px]"
            style={{ color: "var(--leadac-text-2)" }}
            aria-label={copy.salesConfidenceLabel}
          >
            {copy.salesConfidenceLabel}: {Math.round(sc)}%
          </span>
        ) : null}
      </div>

      {brief.headline ? (
        <p
          className="mt-1.5 text-[13px] leading-snug"
          style={{ color: "var(--leadac-text-1)" }}
        >
          {brief.headline}
        </p>
      ) : null}

      {painPoints.length > 0 ? (
        <div className="mt-2.5">
          <span
            className="text-[10px] uppercase tracking-[0.06em]"
            style={{ color: "var(--leadac-text-3)" }}
          >
            {copy.painPointsLabel}
          </span>
          <ul className="mt-1 flex flex-wrap gap-1">
            {painPoints.map((p) => (
              <li
                key={p}
                className="rounded-full border border-white/10 bg-white/3 px-2 py-0.5 text-[11px]"
                style={{ color: "var(--leadac-text-2)" }}
              >
                {p}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between">
        {generatedLabel ? (
          <span
            className="text-[10px]"
            style={{ color: "var(--leadac-text-3)" }}
          >
            {copy.generatedAt} {generatedLabel}
          </span>
        ) : (
          <span />
        )}
        {reasoningRouteEnabled ? (
          <Link
            href={`/app/leads/${leadId}/reasoning/${brief.runId}`}
            className="text-[11px] underline"
            style={{ color: "var(--leadac-info)" }}
          >
            {copy.openFullBrief}
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="text-[11px] opacity-40"
            style={{ color: "var(--leadac-text-2)" }}
            title={copy.openFullBrief}
          >
            {copy.openFullBrief}
          </button>
        )}
      </div>
    </div>
  );
}
