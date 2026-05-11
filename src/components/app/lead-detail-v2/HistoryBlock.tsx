"use client";

/**
 * HistoryBlock — activity timeline + predicted-vs-real objection diff
 * for the v2 HISTORY block. Mounts with id `history-block`.
 *
 * Activity rows are read from `LeadActivity[]` carried by the
 * aggregator response. The predicted-vs-real diff comes from
 * `derive-objection-diff` (which the aggregator runs server-side).
 */

import { useState, type ReactNode } from "react";

import {
  ClosestWinCallout,
  type ClosestWinCalloutCopy,
} from "./ClosestWinCallout";
import {
  PredictedVsRealObjections,
  type PredictedVsRealObjectionsCopy,
} from "./PredictedVsRealObjections";
import {
  ReviewIntelligenceSummary,
  type ReviewIntelligenceSummaryCopy,
} from "./ReviewIntelligenceSummary";
import {
  ReviewTimelineMini,
  type ReviewTimelineMiniCopy,
} from "./ReviewTimelineMini";
import type { ObjectionDiff } from "@/lib/lead-detail/derive-objection-diff";
import type {
  ClosestWinDto,
  ReviewIntelSummaryDto,
} from "@/lib/lead-detail/use-decision-surface";

export interface HistoryActivityRow {
  id: string;
  kind: string;
  payload: unknown;
  createdAt: string;
}

export interface HistoryBlockCopy {
  loading: string;
  empty: string;
  timelineHeading: string;
  objectionsHeading: string;
  activityKindLabels: Record<string, string>;
  objections: PredictedVsRealObjectionsCopy;
  closestWin: ClosestWinCalloutCopy;
  // Phase 2.5 — additive copy for the absorbed V1 review panels.
  // (AccountMapMini lives in AccountBlock per PLAN §5.9 row 5.)
  reviewIntel?: ReviewIntelligenceSummaryCopy;
  reviewTimeline?: ReviewTimelineMiniCopy;
}

export interface HistoryBlockProps {
  loading: boolean;
  leadId: string;
  activities: HistoryActivityRow[];
  objections: ObjectionDiff;
  closestWin: ClosestWinDto | null;
  // Phase 2.5 — review-intel summary from `decision-surface`. Passing
  // `undefined` keeps the legacy panel hidden; passing an explicit
  // `null` renders the "no review intel yet" placeholder.
  reviewIntelSummary?: ReviewIntelSummaryDto | null;
  copy: HistoryBlockCopy;
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return iso;
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function HistoryBlock({
  loading,
  leadId,
  activities,
  objections,
  closestWin,
  reviewIntelSummary,
  copy,
}: HistoryBlockProps): ReactNode {
  // Lazy-mount toggle for the review timeline mini chart. The fetch
  // is gated on this flag so the companion endpoint only fires when
  // the rep actually clicks "view timeline".
  const [timelineExpanded, setTimelineExpanded] = useState(false);

  if (loading) {
    return (
      <p
        className="text-[13px]"
        style={{ color: "var(--leadac-text-3)", minHeight: 56 }}
        data-testid="history-loading"
      >
        {copy.loading}
      </p>
    );
  }

  const empty =
    activities.length === 0 &&
    objections.predictedAndReal.length === 0 &&
    objections.predictedNotReal.length === 0 &&
    objections.realOnly.length === 0 &&
    !reviewIntelSummary;

  if (empty && !closestWin) {
    return (
      <p
        className="text-[13px]"
        style={{ color: "var(--leadac-text-3)", minHeight: 56 }}
        data-testid="history-empty"
      >
        {copy.empty}
      </p>
    );
  }

  return (
    <div className="space-y-4" data-testid="history-block-body">
      {closestWin ? (
        <ClosestWinCallout
          leadId={leadId}
          data={closestWin}
          copy={copy.closestWin}
        />
      ) : null}
      {activities.length > 0 ? (
        <section className="space-y-1.5">
          <h3
            className="text-[11px] font-medium uppercase tracking-[0.08em]"
            style={{ color: "var(--leadac-text-3)" }}
          >
            {copy.timelineHeading}
          </h3>
          <ul className="space-y-1">
            {activities.slice(0, 8).map((a) => (
              <li
                key={a.id}
                className="flex items-baseline gap-2 text-[12px]"
              >
                <span
                  className="text-[10px] uppercase tracking-[0.06em]"
                  style={{ color: "var(--leadac-text-3)" }}
                >
                  {relativeTime(a.createdAt)}
                </span>
                <span style={{ color: "var(--leadac-text-1)" }}>
                  {copy.activityKindLabels[a.kind] ?? a.kind}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="space-y-1.5">
        <h3
          className="text-[11px] font-medium uppercase tracking-[0.08em]"
          style={{ color: "var(--leadac-text-3)" }}
        >
          {copy.objectionsHeading}
        </h3>
        <PredictedVsRealObjections data={objections} copy={copy.objections} />
      </section>

      {/*
       * Phase 2.5 — review intelligence summary + lazy timeline.
       * Hidden when the parent omits both `reviewIntelSummary` and
       * `copy.reviewIntel` (the cinematic legacy block doesn't need
       * the absorbed V1 panel).
       */}
      {copy.reviewIntel && reviewIntelSummary !== undefined ? (
        <section
          className="space-y-2 rounded-lg border px-3 py-2.5"
          style={{
            borderColor: "var(--leadac-border)",
            background: "var(--leadac-card)",
          }}
        >
          <ReviewIntelligenceSummary
            summary={reviewIntelSummary}
            onExpandTimeline={
              copy.reviewTimeline
                ? () => setTimelineExpanded((v) => !v)
                : undefined
            }
            copy={copy.reviewIntel}
          />
          {copy.reviewTimeline ? (
            <ReviewTimelineMini
              leadId={leadId}
              mounted={timelineExpanded}
              copy={copy.reviewTimeline}
            />
          ) : null}
        </section>
      ) : null}

    </div>
  );
}
