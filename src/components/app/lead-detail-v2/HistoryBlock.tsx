"use client";

/**
 * HistoryBlock — activity timeline + predicted-vs-real objection diff
 * for the v2 HISTORY block. Mounts with id `history-block`.
 *
 * Activity rows are read from `LeadActivity[]` carried by the
 * aggregator response. The predicted-vs-real diff comes from
 * `derive-objection-diff` (which the aggregator runs server-side).
 *
 * Phase 1.2 (V2 Richness Absorption) — the absorbed V1 review
 * surfaces (`ReviewIntelligencePanel`, `ReviewTimelineChart`,
 * `GoogleReviewsAccordion`) now sit under a stage-aware `<details>`
 * disclosure. Each one is self-contained (own fetch, own state) so
 * they only spin up once the disclosure opens.
 */

import { lazy, Suspense, useState, type ReactNode } from "react";

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
import type { LeadDetailV2Stage } from "@/lib/lead-detail/use-pipeline-stage";

// Phase 1.2 — heavy V1 panels behind dynamic imports so they
// don't ship in the V2 initial bundle. Each panel weighs 10-30kB
// (Recharts is the biggest contributor); a COLD-only session
// never pays the cost.
const ReviewIntelligencePanel = lazy(() =>
  import("@/components/app/review-intelligence-panel").then((m) => ({
    default: m.ReviewIntelligencePanel,
  })),
);
const ReviewTimelineChart = lazy(() =>
  import("@/components/app/review-timeline-chart").then((m) => ({
    default: m.ReviewTimelineChart,
  })),
);
const GoogleReviewsAccordion = lazy(() =>
  import("@/components/app/google-reviews-accordion").then((m) => ({
    default: m.GoogleReviewsAccordion,
  })),
);
// Phase 1.5 (V2 Richness Absorption) — full voice-notes list. Lives
// under `HistoryBlock` because voice notes are activity history;
// the recording FAB sits separately on the page. Lazy so reps who
// never expand the disclosure don't pay for the MediaRecorder
// helper code at all.
const VoiceNotesPanel = lazy(() =>
  import("@/components/app/voice-notes-panel").then((m) => ({
    default: m.VoiceNotesPanel,
  })),
);

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
  // Phase 1.2 — disclosure labels for the lazy V1 panels.
  fullReviewIntelLabel?: string;
  fullReviewTimelineLabel?: string;
  rawReviewsLabel?: string;
  // Phase 1.5 — disclosure label for the voice-notes list.
  voiceNotesLabel?: string;
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
  // Phase 1.2 — pipeline stage drives whether the full V1 panels
  // start expanded (REPLIED+) or collapsed (COLD/CONTACTED).
  stage?: LeadDetailV2Stage | null;
  /** Total reviews on Google Maps (for the "fetch more" CTA). */
  totalReviewCount?: number;
  /** Stored review rows for this lead in our DB. */
  storedReviewCount?: number;
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
  stage,
  totalReviewCount,
  storedReviewCount,
  copy,
}: HistoryBlockProps): ReactNode {
  // Lazy-mount toggle for the review timeline mini chart. The fetch
  // is gated on this flag so the companion endpoint only fires when
  // the rep actually clicks "view timeline".
  const [timelineExpanded, setTimelineExpanded] = useState(false);

  // Phase 1.2 — full V1 panels default open on REPLIED+ stages so
  // the rep has the deep audit data ready when the conversation
  // is live. Cold sessions stay collapsed to keep the 3-min scan
  // surface clean.
  const fullPanelsDefaultOpen =
    stage === "REPLIED" ||
    stage === "MEETING_BOOKED" ||
    stage === "PROPOSAL" ||
    stage === "NEGOTIATING" ||
    stage === "WON" ||
    stage === "LOST";
  const [fullPanelsOpen, setFullPanelsOpen] = useState(fullPanelsDefaultOpen);
  const hasReviews = (storedReviewCount ?? 0) > 0 || (totalReviewCount ?? 0) > 0;

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

      {/*
       * Phase 1.2 (V2 Richness Absorption) — full V1 review panels
       * absorbed under a single stage-aware disclosure. Each child
       * is dynamic-imported so the V2 bundle stays slim; the panel
       * code only downloads when the rep opens the disclosure.
       */}
      {hasReviews ? (
        <section
          className="space-y-3"
          data-testid="history-full-review-panels"
        >
          <details
            className="rounded-lg border border-white/8 bg-white/3"
            open={fullPanelsOpen}
            onToggle={(e) => setFullPanelsOpen(e.currentTarget.open)}
          >
            <summary
              className="cursor-pointer select-none px-3 py-2 text-[12px] font-medium uppercase tracking-[0.06em]"
              style={{ color: "var(--leadac-text-3)" }}
            >
              {copy.fullReviewIntelLabel ?? "Full review intelligence"}
            </summary>
            <div className="space-y-3 px-3 pb-3 pt-1">
              {fullPanelsOpen ? (
                <Suspense fallback={<PanelSkeleton />}>
                  <ReviewIntelligencePanel
                    leadId={leadId}
                    hasReviews={hasReviews}
                    storedReviewCount={storedReviewCount}
                    totalReviewCount={totalReviewCount}
                  />
                </Suspense>
              ) : null}
            </div>
          </details>

          <details
            className="rounded-lg border border-white/8 bg-white/3"
            open={fullPanelsOpen}
          >
            <summary
              className="cursor-pointer select-none px-3 py-2 text-[12px] font-medium uppercase tracking-[0.06em]"
              style={{ color: "var(--leadac-text-3)" }}
            >
              {copy.fullReviewTimelineLabel ?? "Review timeline"}
            </summary>
            <div className="space-y-3 px-3 pb-3 pt-1">
              <Suspense fallback={<PanelSkeleton />}>
                <ReviewTimelineChart leadId={leadId} />
              </Suspense>
            </div>
          </details>

          <details className="rounded-lg border border-white/8 bg-white/3">
            <summary
              className="cursor-pointer select-none px-3 py-2 text-[12px] font-medium uppercase tracking-[0.06em]"
              style={{ color: "var(--leadac-text-3)" }}
            >
              {copy.rawReviewsLabel ?? "Raw Google reviews"}
            </summary>
            <div className="space-y-3 px-3 pb-3 pt-1">
              <Suspense fallback={<PanelSkeleton />}>
                <GoogleReviewsAccordion leadId={leadId} />
              </Suspense>
            </div>
          </details>
        </section>
      ) : null}

      {/*
       * Phase 1.5 (V2 Richness Absorption) — VoiceNotesPanel below
       * the review section, collapsed by default. The recording FAB
       * lives elsewhere on the page; this panel exists to LIST and
       * delete the existing recordings so the rep can hear back on
       * what they last said about the lead.
       */}
      {copy.voiceNotesLabel ? (
        <VoiceNotesDisclosure
          leadId={leadId}
          label={copy.voiceNotesLabel}
        />
      ) : null}

    </div>
  );
}

interface VoiceNotesDisclosureProps {
  leadId: string;
  label: string;
}

/**
 * Phase 1.5 — owns its open/close state and only mounts the lazy
 * panel after the first expand so the audio bundle stays out of
 * the initial download for cold sessions.
 */
function VoiceNotesDisclosure({ leadId, label }: VoiceNotesDisclosureProps): ReactNode {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  return (
    <details
      className="rounded-lg border border-white/8 bg-white/3"
      open={open}
      onToggle={(e) => {
        const next = e.currentTarget.open;
        setOpen(next);
        if (next) setEverOpened(true);
      }}
      data-testid="history-voice-notes"
    >
      <summary
        className="cursor-pointer select-none px-3 py-2 text-[12px] font-medium uppercase tracking-[0.06em]"
        style={{ color: "var(--leadac-text-3)" }}
      >
        {label}
      </summary>
      <div className="space-y-3 px-3 pb-3 pt-1">
        {everOpened ? (
          <Suspense fallback={<PanelSkeleton />}>
            <VoiceNotesPanel leadId={leadId} />
          </Suspense>
        ) : null}
      </div>
    </details>
  );
}

function PanelSkeleton() {
  return (
    <div className="space-y-1.5">
      <div className="h-3 w-2/3 rounded bg-white/5" />
      <div className="h-3 w-1/2 rounded bg-white/5" />
      <div className="h-3 w-3/4 rounded bg-white/5" />
    </div>
  );
}
