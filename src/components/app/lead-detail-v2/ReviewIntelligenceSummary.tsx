"use client";

/**
 * ReviewIntelligenceSummary — Phase 2.5.
 *
 * Always-rendered subsection inside `HistoryBlock` summarising the
 * cached `ReviewAnalysis` row in 4 strands:
 *   - leadScore (0-100, hot-prospect score)
 *   - sentiment breakdown (positive / neutral / negative bars)
 *   - top-3 weakness KPIs (free-friendly — most actionable to sales)
 *   - top-3 switch signals
 *
 * Reads `decision-surface.reviewIntelSummary`. When the analysis row
 * is missing entirely the component renders a one-line "no review
 * intel yet" placeholder. The full panel (timeline chart + raw
 * reviews) sits behind `ReviewTimelineMini`'s lazy expand.
 */

import { type ReactNode } from "react";

import type { ReviewIntelSummaryDto } from "@/lib/lead-detail/use-decision-surface";

export interface ReviewIntelligenceSummaryCopy {
  title: string;
  leadScoreLabel: string;
  sentimentLabel: string;
  weaknessLabel: string;
  switchSignalsLabel: string;
  reviewsAnalyzed: string;
  empty: string;
  positive: string;
  neutral: string;
  negative: string;
  expandTimelineCta: string;
}

export interface ReviewIntelligenceSummaryProps {
  summary: ReviewIntelSummaryDto | null;
  /** Mounted lazily — parent passes the open handler so the
   * `ReviewTimelineMini` companion fetch only fires when the rep
   * actually wants the timeline. */
  onExpandTimeline?: () => void;
  copy: ReviewIntelligenceSummaryCopy;
}

function pct(value: number | null): string {
  if (value == null) return "—";
  return `${Math.round(value * 100)}%`;
}

export function ReviewIntelligenceSummary({
  summary,
  onExpandTimeline,
  copy,
}: ReviewIntelligenceSummaryProps): ReactNode {
  if (!summary) {
    return (
      <div
        data-testid="review-intel-empty"
        className="text-[12px]"
        style={{ color: "var(--leadac-text-3)" }}
      >
        {copy.empty}
      </div>
    );
  }

  const positive = summary.sentimentBreakdown.positive;
  const neutral = summary.sentimentBreakdown.neutral;
  const negative = summary.sentimentBreakdown.negative;
  const totalSentiment =
    (positive ?? 0) + (neutral ?? 0) + (negative ?? 0);
  const hasSentiment = totalSentiment > 0;

  return (
    <div data-testid="review-intel-summary" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3
          className="text-[11px] font-medium uppercase tracking-[0.06em]"
          style={{ color: "var(--leadac-text-3)" }}
        >
          {copy.title}
        </h3>
        <span
          className="rounded-full border border-white/10 bg-white/3 px-2 py-0.5 text-[10px]"
          style={{ color: "var(--leadac-text-2)" }}
        >
          {copy.leadScoreLabel}: {summary.leadScore}
        </span>
      </div>

      {summary.summary ? (
        <p
          className="text-[12px] leading-snug"
          style={{ color: "var(--leadac-text-1)" }}
        >
          {summary.summary}
        </p>
      ) : null}

      {hasSentiment ? (
        <div>
          <span
            className="text-[10px] uppercase tracking-[0.06em]"
            style={{ color: "var(--leadac-text-3)" }}
          >
            {copy.sentimentLabel}
          </span>
          <div
            className="mt-1 flex h-2 w-full overflow-hidden rounded-full border border-white/8"
            role="img"
            aria-label={`${copy.positive} ${pct(positive)}, ${copy.neutral} ${pct(neutral)}, ${copy.negative} ${pct(negative)}`}
          >
            {positive && positive > 0 ? (
              <span
                style={{
                  width: `${positive * 100}%`,
                  background: "var(--leadac-success)",
                }}
              />
            ) : null}
            {neutral && neutral > 0 ? (
              <span
                style={{
                  width: `${neutral * 100}%`,
                  background: "var(--leadac-text-3)",
                  opacity: 0.5,
                }}
              />
            ) : null}
            {negative && negative > 0 ? (
              <span
                style={{
                  width: `${negative * 100}%`,
                  background: "var(--leadac-error)",
                }}
              />
            ) : null}
          </div>
          <div
            className="mt-1 flex justify-between text-[10px]"
            style={{ color: "var(--leadac-text-3)" }}
          >
            <span>{copy.positive} {pct(positive)}</span>
            <span>{copy.neutral} {pct(neutral)}</span>
            <span>{copy.negative} {pct(negative)}</span>
          </div>
        </div>
      ) : null}

      {summary.weaknessKpisTop3.length > 0 ? (
        <div>
          <span
            className="text-[10px] uppercase tracking-[0.06em]"
            style={{ color: "var(--leadac-text-3)" }}
          >
            {copy.weaknessLabel}
          </span>
          <ul className="mt-1 flex flex-wrap gap-1">
            {summary.weaknessKpisTop3.map((k) => (
              <li
                key={k.label}
                className="rounded-full border border-white/10 bg-white/3 px-2 py-0.5 text-[11px]"
                style={{ color: "var(--leadac-text-2)" }}
              >
                {k.label}
                {k.percent != null ? ` · ${k.percent}%` : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {summary.switchSignalsTop3.length > 0 ? (
        <div>
          <span
            className="text-[10px] uppercase tracking-[0.06em]"
            style={{ color: "var(--leadac-text-3)" }}
          >
            {copy.switchSignalsLabel}
          </span>
          <ul className="mt-1 space-y-0.5">
            {summary.switchSignalsTop3.map((s, i) => (
              <li
                key={`${i}-${s.slice(0, 24)}`}
                className="text-[11px]"
                style={{ color: "var(--leadac-text-2)" }}
              >
                · {s}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex items-center justify-between text-[10px]">
        <span style={{ color: "var(--leadac-text-3)" }}>
          {copy.reviewsAnalyzed}: {summary.reviewsAnalyzedCount}
        </span>
        {onExpandTimeline ? (
          <button
            type="button"
            onClick={onExpandTimeline}
            className="underline"
            style={{ color: "var(--leadac-info)" }}
          >
            {copy.expandTimelineCta}
          </button>
        ) : null}
      </div>
    </div>
  );
}
