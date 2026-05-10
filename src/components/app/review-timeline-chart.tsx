"use client";

/**
 * Review Timeline Chart.
 *
 * Stacked bar chart of a lead's GoogleReview corpus over time, split into
 * Positive (4-5★), Neutral (3★), and Negative (1-2★) buckets. Reuses the
 * existing GET /api/reviews/[leadId] endpoint so no new API surface is
 * required — every lead detail page can drop this in next to the
 * Review Intelligence panel for at-a-glance reputation trend reading.
 *
 * Bucket granularity auto-scales to the corpus' date span:
 *   - >5 years → year buckets
 *   - >18 months → quarter buckets
 *   - else → month buckets
 *
 * Renders nothing destructive on the empty path: a small placeholder
 * card so the slot in the reviews tab keeps its shape while the lead
 * has zero stored reviews (matches `ReviewIntelligencePanel`'s pattern).
 */

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart as LineChartIcon, Loader2 } from "lucide-react";

interface GoogleReview {
  id: string;
  rating: number;
  publishTime: string;
}

interface Bucket {
  bucket: string;
  bucketDate: string;
  positive: number;
  neutral: number;
  negative: number;
}

type Granularity = "month" | "quarter" | "year";

function pickGranularity(monthsSpan: number): Granularity {
  if (monthsSpan > 60) return "year";
  if (monthsSpan > 18) return "quarter";
  return "month";
}

function bucketKey(
  d: Date,
  g: Granularity,
): { key: string; label: string; sortISO: string } {
  if (g === "year") {
    const y = d.getUTCFullYear();
    return { key: `${y}`, label: `${y}`, sortISO: `${y}-01-01` };
  }
  if (g === "quarter") {
    const y = d.getUTCFullYear();
    const q = Math.floor(d.getUTCMonth() / 3) + 1;
    const month = (q - 1) * 3 + 1;
    return {
      key: `${y}-Q${q}`,
      label: `Q${q} ${String(y).slice(2)}`,
      sortISO: `${y}-${String(month).padStart(2, "0")}-01`,
    };
  }
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const label = new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "2-digit",
  }).format(d);
  return {
    key: `${y}-${m}`,
    label,
    sortISO: `${y}-${String(m + 1).padStart(2, "0")}-01`,
  };
}

export function ReviewTimelineChart({ leadId }: { leadId: string }) {
  const [reviews, setReviews] = useState<GoogleReview[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/reviews/${leadId}`);
        if (!res.ok) {
          if (!cancelled) setReviews([]);
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setReviews(Array.isArray(data.reviews) ? data.reviews : []);
        }
      } catch {
        if (!cancelled) setReviews([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  const { buckets, totals, granularity } = useMemo(() => {
    const empty = {
      buckets: [] as Bucket[],
      totals: { positive: 0, neutral: 0, negative: 0 },
      granularity: "month" as Granularity,
    };
    if (!reviews || reviews.length === 0) return empty;

    const dates = reviews
      .map((r) => new Date(r.publishTime))
      .filter((d) => !Number.isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());
    if (dates.length === 0) return empty;

    const first = dates[0];
    const last = dates[dates.length - 1];
    const monthsSpan =
      (last.getUTCFullYear() - first.getUTCFullYear()) * 12 +
      (last.getUTCMonth() - first.getUTCMonth());
    const gran = pickGranularity(monthsSpan);

    const map = new Map<string, Bucket>();
    let positive = 0;
    let neutral = 0;
    let negative = 0;

    for (const r of reviews) {
      const d = new Date(r.publishTime);
      if (Number.isNaN(d.getTime())) continue;
      const { key, label, sortISO } = bucketKey(d, gran);
      const cur =
        map.get(key) ??
        ({
          bucket: label,
          bucketDate: sortISO,
          positive: 0,
          neutral: 0,
          negative: 0,
        } as Bucket);
      if (r.rating >= 4) {
        cur.positive += 1;
        positive += 1;
      } else if (r.rating <= 2) {
        cur.negative += 1;
        negative += 1;
      } else {
        cur.neutral += 1;
        neutral += 1;
      }
      map.set(key, cur);
    }

    const sorted = Array.from(map.values()).sort((a, b) =>
      a.bucketDate.localeCompare(b.bucketDate),
    );
    return {
      buckets: sorted,
      totals: { positive, neutral, negative },
      granularity: gran,
    };
  }, [reviews]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LineChartIcon className="w-5 h-5 text-(--leadac-300)" />
            Review Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-white/40 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!reviews || reviews.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LineChartIcon className="w-5 h-5 text-(--leadac-300)" />
            Review Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-white/50">
            No reviews stored yet. Refresh reviews or pull more via Apify to see the trend.
          </p>
        </CardContent>
      </Card>
    );
  }

  const positiveColor = "var(--leadac-success)";
  const negativeColor = "var(--leadac-error)";
  const neutralColor = "rgba(255,255,255,0.30)";
  const granLabel =
    granularity === "year"
      ? "year"
      : granularity === "quarter"
        ? "quarter"
        : "month";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <LineChartIcon className="w-5 h-5 text-(--leadac-300)" />
          Review Timeline
        </CardTitle>
        <p className="text-xs text-white/40 mt-1">
          {reviews.length} review{reviews.length === 1 ? "" : "s"} bucketed by {granLabel} ·{" "}
          <span style={{ color: positiveColor }}>{totals.positive} positive</span>
          {" · "}
          <span className="text-white/55">{totals.neutral} neutral</span>
          {" · "}
          <span style={{ color: negativeColor }}>{totals.negative} negative</span>
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={buckets}
              margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
            >
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="bucket"
                stroke="rgba(255,255,255,0.35)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                minTickGap={20}
              />
              <YAxis
                stroke="rgba(255,255,255,0.35)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={28}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                contentStyle={{
                  backgroundColor: "var(--leadac-card)",
                  border: "1px solid var(--leadac-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "var(--leadac-text-3)" }}
                itemStyle={{ color: "var(--leadac-text-1)" }}
              />
              <Bar
                name="Positive (4-5★)"
                dataKey="positive"
                stackId="reviews"
                fill={positiveColor}
                radius={[0, 0, 0, 0]}
              />
              <Bar
                name="Neutral (3★)"
                dataKey="neutral"
                stackId="reviews"
                fill={neutralColor}
                radius={[0, 0, 0, 0]}
              />
              <Bar
                name="Negative (1-2★)"
                dataKey="negative"
                stackId="reviews"
                fill={negativeColor}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-4 mt-3 text-[11px] text-white/55 flex-wrap">
          <Legend dot={positiveColor} label="Positive (4-5★)" />
          <Legend dot={neutralColor} label="Neutral (3★)" />
          <Legend dot={negativeColor} label="Negative (1-2★)" />
        </div>
      </CardContent>
    </Card>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: dot }}
      />
      {label}
    </span>
  );
}
