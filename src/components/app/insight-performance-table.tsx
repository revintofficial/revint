"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface InsightPerformanceRow {
  insightId: string;
  industryMyth: string;
  reframe: string;
  nicheSlug: string | null;
  basePriority: number;
  applied: number;
  replyPositive: number;
  replyNegative: number;
  ignored: number;
  meetingBooked: number;
  won: number;
  winRate: number;
}

export function InsightPerformanceTable() {
  const [rows, setRows] = useState<InsightPerformanceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/settings/insight-performance", {
          cache: "no-store",
        });
        if (cancelled) return;
        if (!res.ok) {
          setError(`HTTP ${res.status}`);
          return;
        }
        const json = await res.json();
        if (!cancelled) setRows(json.rows ?? []);
      } catch (err) {
        if (!cancelled) setError(String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="rounded-md border border-[var(--leadac-error)]/40 bg-[var(--leadac-card)] p-4 text-sm text-[var(--leadac-error)]">
        Failed to load insight performance: {error}
      </div>
    );
  }

  if (rows === null) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-[var(--leadac-border)] bg-[var(--leadac-card)] p-6 text-center text-sm text-[var(--leadac-text-3)]">
        No commercial insights are available yet. Seed a niche pack
        (e.g. <code className="font-mono">scripts/seed-restaurant-tech.ts</code>)
        or wait for a workspace admin to add one.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--leadac-border)] bg-[var(--leadac-card)]">
      <table className="w-full text-left text-sm">
        <thead className="bg-[var(--leadac-bg)] text-[10px] uppercase tracking-wide text-[var(--leadac-text-3)]">
          <tr>
            <th className="px-3 py-2 font-medium">Insight</th>
            <th className="px-3 py-2 text-right font-medium">Applied</th>
            <th className="px-3 py-2 text-right font-medium">Win-rate</th>
            <th className="px-3 py-2 text-right font-medium">Replies (+/−)</th>
            <th className="px-3 py-2 text-right font-medium">Meetings</th>
            <th className="px-3 py-2 text-right font-medium">Won</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--leadac-border)]">
          {rows.map((r) => (
            <tr key={r.insightId} className="align-top">
              <td className="px-3 py-3">
                <div className="font-medium text-[var(--leadac-text-1)]">
                  {r.industryMyth}
                </div>
                <div className="mt-0.5 line-clamp-2 text-xs text-[var(--leadac-text-3)]">
                  {r.reframe}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {r.nicheSlug ? (
                    <Badge
                      variant="outline"
                      className="border-[var(--leadac-border)] text-[10px] text-[var(--leadac-text-2)]"
                    >
                      {r.nicheSlug}
                    </Badge>
                  ) : null}
                  <Badge
                    variant="outline"
                    className="border-[var(--leadac-border)] text-[10px] text-[var(--leadac-text-3)]"
                  >
                    base priority {r.basePriority}
                  </Badge>
                </div>
              </td>
              <td className="px-3 py-3 text-right tabular-nums text-[var(--leadac-text-2)]">
                {r.applied}
              </td>
              <td className="px-3 py-3 text-right">
                <WinRateBadge rate={r.winRate} applied={r.applied} />
              </td>
              <td className="px-3 py-3 text-right text-xs tabular-nums text-[var(--leadac-text-2)]">
                <span className="text-[var(--leadac-success)]">+{r.replyPositive}</span>
                {" / "}
                <span className="text-[var(--leadac-error)]">−{r.replyNegative}</span>
              </td>
              <td className="px-3 py-3 text-right tabular-nums text-[var(--leadac-text-2)]">
                {r.meetingBooked}
              </td>
              <td className="px-3 py-3 text-right tabular-nums font-medium text-[var(--leadac-text-1)]">
                {r.won}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WinRateBadge({ rate, applied }: { rate: number; applied: number }) {
  if (applied === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-[var(--leadac-text-3)]">
        <Minus className="h-3 w-3" /> n/a
      </span>
    );
  }
  if (rate >= 30) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--leadac-success)]">
        <TrendingUp className="h-3 w-3" /> {rate.toFixed(1)}%
      </span>
    );
  }
  if (rate <= 5) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--leadac-error)]">
        <TrendingDown className="h-3 w-3" /> {rate.toFixed(1)}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-[var(--leadac-text-2)]">
      <Minus className="h-3 w-3" /> {rate.toFixed(1)}%
    </span>
  );
}
