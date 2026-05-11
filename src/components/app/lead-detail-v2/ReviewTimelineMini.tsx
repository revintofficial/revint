"use client";

/**
 * ReviewTimelineMini — Phase 2.5.
 *
 * Lazy-mounted chart inside the expanded `HistoryBlock`. Fetches
 * `/api/leads/[id]/review-intel` (Phase 2.5 companion endpoint) and
 * renders a stacked-bar volume-over-time chart of reviews per month.
 * Re-skin of the legacy `ReviewTimelineChart`.
 *
 * The fetch is deferred until the parent flips a `mounted` prop —
 * the parent should only mount this component when the rep clicks
 * "View timeline →" in `ReviewIntelligenceSummary`. Empty / failed
 * fetches render an inline fallback so the block never holds the
 * card open with a spinner.
 *
 * Pure CSS bars (no chart-library dep) — the render is a row of
 * vertical divs whose heights are normalised to the max-count
 * bucket. The card stays under 8KB gzipped and renders in <2 frames
 * on mobile.
 */

import { useEffect, useState, type ReactNode } from "react";

interface ReviewByMonthDto {
  month: string;
  count: number;
  avgRating: number | null;
}

interface RecentReviewDto {
  id: string;
  authorName: string;
  rating: number;
  text: string | null;
  publishTime: string;
  relativeTime: string;
}

interface ReviewIntelResponse {
  status: string;
  reviewsByMonth: ReviewByMonthDto[];
  recentReviews: RecentReviewDto[];
  totalReviews: number;
}

export interface ReviewTimelineMiniCopy {
  loading: string;
  empty: string;
  error: string;
  monthBucketLabel: string;
  countLabel: string;
  avgRatingLabel: string;
  recentReviewsHeading: string;
}

export interface ReviewTimelineMiniProps {
  leadId: string;
  /** When false, the component renders nothing (no fetch fired). */
  mounted: boolean;
  copy: ReviewTimelineMiniCopy;
}

export function ReviewTimelineMini({
  leadId,
  mounted,
  copy,
}: ReviewTimelineMiniProps): ReactNode {
  const [data, setData] = useState<ReviewIntelResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetch(`/api/leads/${leadId}/review-intel`, { cache: "no-store" })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setError(true);
          setLoading(false);
          return;
        }
        const json = (await res.json()) as ReviewIntelResponse;
        if (cancelled) return;
        setData(json);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mounted, leadId]);

  if (!mounted) return null;

  if (loading) {
    return (
      <div
        data-testid="review-timeline-loading"
        className="text-[12px]"
        style={{ color: "var(--leadac-text-3)" }}
      >
        {copy.loading}
      </div>
    );
  }
  if (error) {
    return (
      <div
        data-testid="review-timeline-error"
        className="text-[12px]"
        style={{ color: "var(--leadac-text-3)" }}
      >
        {copy.error}
      </div>
    );
  }
  if (!data || data.reviewsByMonth.length === 0) {
    return (
      <div
        data-testid="review-timeline-empty"
        className="text-[12px]"
        style={{ color: "var(--leadac-text-3)" }}
      >
        {copy.empty}
      </div>
    );
  }

  const maxCount = data.reviewsByMonth.reduce(
    (acc, m) => (m.count > acc ? m.count : acc),
    0,
  );
  const lastTwelve = data.reviewsByMonth.slice(-12);

  return (
    <div data-testid="review-timeline-mini" className="space-y-3">
      <div className="flex items-end gap-1.5">
        {lastTwelve.map((m) => {
          const heightPct =
            maxCount > 0 ? Math.max(4, (m.count / maxCount) * 100) : 0;
          return (
            <div
              key={m.month}
              className="flex flex-1 flex-col items-center gap-1"
              title={`${copy.monthBucketLabel}: ${m.month} · ${copy.countLabel}: ${m.count}${
                m.avgRating != null
                  ? ` · ${copy.avgRatingLabel}: ${m.avgRating}`
                  : ""
              }`}
            >
              <div
                className="w-full rounded-sm border border-white/10"
                style={{
                  height: `${heightPct}%`,
                  minHeight: "4px",
                  maxHeight: "60px",
                  background:
                    "color-mix(in srgb, var(--leadac-info) 35%, transparent)",
                }}
              />
              <span
                className="text-[9px]"
                style={{ color: "var(--leadac-text-3)" }}
              >
                {m.month.slice(2, 7)}
              </span>
            </div>
          );
        })}
      </div>

      {data.recentReviews.length > 0 ? (
        <div>
          <span
            className="text-[10px] uppercase tracking-[0.06em]"
            style={{ color: "var(--leadac-text-3)" }}
          >
            {copy.recentReviewsHeading}
          </span>
          <ul className="mt-1.5 space-y-1.5">
            {data.recentReviews.slice(0, 5).map((r) => (
              <li
                key={r.id}
                className="rounded-md border border-white/8 bg-white/2 px-2 py-1.5 text-[11px]"
                style={{ color: "var(--leadac-text-2)" }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span style={{ color: "var(--leadac-text-1)" }}>
                    {r.authorName}
                  </span>
                  <span style={{ color: "var(--leadac-warning)" }}>
                    {"★".repeat(r.rating)}
                  </span>
                </div>
                {r.text ? (
                  <p className="mt-0.5 line-clamp-2 leading-snug">
                    {r.text}
                  </p>
                ) : null}
                <span
                  className="text-[9px]"
                  style={{ color: "var(--leadac-text-3)" }}
                >
                  {r.relativeTime}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
