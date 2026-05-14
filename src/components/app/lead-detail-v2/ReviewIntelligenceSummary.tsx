"use client";

/**
 * ReviewIntelligenceSummary — Phase 2.5 + Truth Layer v1 (T-G).
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
 *
 * Truth Layer v1 — Track G "Surface Fidelity":
 *   - The bare "%82" weakness KPI percent was misread as "82% of all
 *     reviews mention this issue". Operators with 397 total reviews
 *     and 11 negatives saw `wait time · %82` and panic-flagged a
 *     non-existent reputational fire. The new label spells the
 *     denominator out: `wait time · 9 mentions (82% of negative
 *     reviews)`. T-C will eventually attach a `percentBase` field
 *     ("negative_reviews" | "total_reviews") to each KPI in
 *     `review-analyst.ts`; until that ships we treat the field as
 *     absent and default to `negative_reviews` (preserves existing
 *     denominator semantics — only the label changes).
 *   - Each rendered KPI row carries an `aria-label` that includes the
 *     implied denominator (e.g. "9 mentions out of 11 negative
 *     reviews — 82%") so screen readers never have to infer the base.
 *   - Emits `truth.surface.review_kpi_rendered` once per KPI on mount
 *     (T-H Observability dashboards consume this to detect regressions
 *     in operator-facing percent semantics).
 */

import { useEffect, type ReactNode } from "react";

import type { ReviewIntelSummaryDto } from "@/lib/lead-detail/use-decision-surface";
import { track } from "@/lib/lead-detail/telemetry";

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
  /**
   * Lead id forwarded so the T-G `truth.surface.review_kpi_rendered`
   * event can attribute KPI renders to a lead. Optional because the
   * parent (`HistoryBlock`) wires it through opportunistically — a
   * missing id silently skips the emit (UI still renders).
   */
  leadId?: string;
  copy: ReviewIntelligenceSummaryCopy;
}

type PercentBase = "negative_reviews" | "total_reviews";

/**
 * T-C will eventually attach `percentBase` to each KPI row. Until
 * that schema ships we read it defensively and fall back to the
 * existing semantics (`negative_reviews`) — that matches what
 * `review-analyst.ts` produces today.
 */
function readPercentBase(kpi: unknown): PercentBase {
  if (kpi && typeof kpi === "object" && "percentBase" in kpi) {
    const value = (kpi as { percentBase?: unknown }).percentBase;
    if (value === "total_reviews") return "total_reviews";
    if (value === "negative_reviews") return "negative_reviews";
  }
  return "negative_reviews";
}

function pct(value: number | null): string {
  if (value == null) return "—";
  return `${Math.round(value * 100)}%`;
}

interface KpiRowView {
  key: string;
  label: string;
  count: number | null;
  percent: number | null;
  percentBase: PercentBase;
  /**
   * Implied denominator the percent is OF (e.g. count=9, percent=82
   * → 11 negative reviews). Null when the math can't be derived
   * (count missing, percent missing, or percent === 0).
   */
  denominator: number | null;
  /** Visible label string. Shape varies based on which numbers we have. */
  text: string;
  /** Screen-reader expansion that always names the denominator base. */
  ariaLabel: string;
}

function deriveDenominator(
  count: number | null,
  percent: number | null,
): number | null {
  if (count == null || percent == null || percent <= 0) return null;
  return Math.round(count / (percent / 100));
}

function buildKpiRow(
  kpi: { label: string; count: number | null; percent: number | null },
  index: number,
): KpiRowView {
  const percentBase = readPercentBase(kpi);
  const { label, count, percent } = kpi;
  const denominator = deriveDenominator(count, percent);

  const denomNoun =
    percentBase === "total_reviews" ? "all reviews" : "negative reviews";
  const ariaDenomNoun =
    percentBase === "total_reviews" ? "reviews" : "negative reviews";

  let text: string;
  let ariaLabel: string;

  if (count != null && percent != null) {
    text = `${label} · ${count} mentions (${percent}% of ${denomNoun})`;
    ariaLabel =
      denominator != null
        ? `${count} mentions out of ${denominator} ${ariaDenomNoun} — ${percent}%`
        : `${count} mentions — ${percent}% of ${denomNoun}`;
  } else if (count != null) {
    text = `${label} · ${count} mentions`;
    ariaLabel = `${label}: ${count} mentions`;
  } else if (percent != null) {
    // No count — keep the legacy short form but at least name the base.
    text = `${label} · ${percent}% of ${denomNoun}`;
    ariaLabel = `${label}: ${percent}% of ${denomNoun}`;
  } else {
    text = label;
    ariaLabel = label;
  }

  return {
    key: `${index}-${label}`,
    label,
    count,
    percent,
    percentBase,
    denominator,
    text,
    ariaLabel,
  };
}

export function ReviewIntelligenceSummary({
  summary,
  onExpandTimeline,
  leadId,
  copy,
}: ReviewIntelligenceSummaryProps): ReactNode {
  const weaknessRows: KpiRowView[] = summary
    ? summary.weaknessKpisTop3.map(buildKpiRow)
    : [];

  // T-G telemetry — emit once per KPI on mount. The dashboard uses
  // these to detect regressions in `percentBase` (e.g. an operator
  // segment where the percent suddenly flips to "total_reviews"
  // would shift the histogram).
  useEffect(() => {
    if (!leadId) return;
    if (weaknessRows.length === 0) return;
    for (const row of weaknessRows) {
      track("truth.surface.review_kpi_rendered", {
        leadId,
        percentBase: row.percentBase,
        count: row.count ?? 0,
      });
    }
    // We deliberately depend on leadId only: the KPI list is stable
    // once the decision-surface payload settles, and re-firing on
    // every minor render would skew the dashboard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

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

      {weaknessRows.length > 0 ? (
        <div>
          <span
            className="text-[10px] uppercase tracking-[0.06em]"
            style={{ color: "var(--leadac-text-3)" }}
          >
            {copy.weaknessLabel}
          </span>
          <ul className="mt-1 flex flex-wrap gap-1">
            {weaknessRows.map((row) => (
              <li
                key={row.key}
                data-testid="review-intel-weakness-kpi"
                data-percent-base={row.percentBase}
                aria-label={row.ariaLabel}
                title={row.ariaLabel}
                className="rounded-full border border-white/10 bg-white/3 px-2 py-0.5 text-[11px]"
                style={{ color: "var(--leadac-text-2)" }}
              >
                {row.text}
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
