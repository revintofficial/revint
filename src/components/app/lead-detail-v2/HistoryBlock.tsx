"use client";

/**
 * HistoryBlock — activity timeline + predicted-vs-real objection diff
 * for the v2 HISTORY block. Mounts with id `history-block`.
 *
 * Activity rows are read from `LeadActivity[]` carried by the
 * aggregator response. The predicted-vs-real diff comes from
 * `derive-objection-diff` (which the aggregator runs server-side).
 */

import type { ReactNode } from "react";

import {
  PredictedVsRealObjections,
  type PredictedVsRealObjectionsCopy,
} from "./PredictedVsRealObjections";
import type { ObjectionDiff } from "@/lib/lead-detail/derive-objection-diff";

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
}

export interface HistoryBlockProps {
  loading: boolean;
  activities: HistoryActivityRow[];
  objections: ObjectionDiff;
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
  activities,
  objections,
  copy,
}: HistoryBlockProps): ReactNode {
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
    objections.realOnly.length === 0;

  if (empty) {
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
    </div>
  );
}
