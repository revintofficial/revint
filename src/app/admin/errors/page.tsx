import Link from "next/link";
import {
  getErrorAggregates,
  getWebVitalsSummary,
  rangeForPreset,
} from "@/lib/admin/queries";
import { RangePicker, normaliseRange } from "@/components/admin/range-picker";
import { formatNumber, formatPct, relativeTime } from "@/lib/admin/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const VITAL_UNITS: Record<string, "ms" | "score"> = {
  LCP: "ms",
  INP: "ms",
  FCP: "ms",
  TTFB: "ms",
  CLS: "score",
};

function fmtVital(metric: string, value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (VITAL_UNITS[metric] === "score") return value.toFixed(2);
  return value < 1000 ? `${Math.round(value)}ms` : `${(value / 1000).toFixed(2)}s`;
}

export default async function AdminErrorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const preset = normaliseRange(sp.range);
  const range = rangeForPreset(preset);
  const [errors, vitals] = await Promise.all([
    getErrorAggregates(range),
    getWebVitalsSummary(),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--revint-text-1)]">
            Errors &amp; Web Vitals
          </h1>
          <p className="mt-1 text-sm text-[var(--revint-text-2)]">
            JS errors captured client-side plus Core Web Vitals from the
            existing beacon.
          </p>
        </div>
        <RangePicker current={preset} basePath="/admin/errors" />
      </header>

      <section>
        <h2 className="text-sm font-medium text-[var(--revint-text-1)] mb-2">
          Web Vitals (last 30d sample)
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {vitals.map((v) => (
            <div
              key={v.metric}
              className="rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)] p-4"
            >
              <div className="text-xs uppercase tracking-wider text-[var(--revint-text-3)]">
                {v.metric}
              </div>
              <div className="mt-1 text-xl font-semibold text-[var(--revint-text-1)] tabular-nums">
                {fmtVital(v.metric, v.p75)}
              </div>
              <div className="mt-1 text-[10px] text-[var(--revint-text-3)] tabular-nums">
                p50 {fmtVital(v.metric, v.p50)} · p95 {fmtVital(v.metric, v.p95)}
              </div>
              <div className="mt-2 text-[10px] text-[var(--revint-text-3)]">
                {formatNumber(v.count)} samples · {formatPct(v.goodPct, 0)} good
              </div>
            </div>
          ))}
          {vitals.length === 0 && (
            <div className="col-span-full text-sm text-[var(--revint-text-3)]">
              No vitals captured yet (Redis empty or unreachable).
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-[var(--revint-text-1)] mb-2">
          Client errors ({formatNumber(errors.length)} unique)
        </h2>
        <div className="rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--revint-hover)]/40 text-xs uppercase tracking-wider text-[var(--revint-text-3)]">
              <tr>
                <th className="text-left px-3 py-2">Message</th>
                <th className="text-left px-3 py-2">Source</th>
                <th className="text-right px-3 py-2">Count</th>
                <th className="text-right px-3 py-2">Sessions</th>
                <th className="text-left px-3 py-2">Last seen</th>
                <th className="text-left px-3 py-2">Sample</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--revint-border)]">
              {errors.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-[var(--revint-text-3)]"
                  >
                    No errors captured. Either the site is bulletproof or no
                    one has visited yet.
                  </td>
                </tr>
              )}
              {errors.map((e, i) => (
                <tr key={i} className="hover:bg-[var(--revint-hover)]/40">
                  <td className="px-3 py-2 align-top">
                    <code className="text-[var(--revint-error)]">{e.message}</code>
                  </td>
                  <td className="px-3 py-2 align-top text-xs text-[var(--revint-text-3)] max-w-[260px] truncate">
                    {e.source ?? "—"}
                  </td>
                  <td className="px-3 py-2 align-top text-right tabular-nums">
                    {formatNumber(e.count)}
                  </td>
                  <td className="px-3 py-2 align-top text-right tabular-nums">
                    {formatNumber(e.sessions)}
                  </td>
                  <td className="px-3 py-2 align-top text-xs text-[var(--revint-text-3)]">
                    {relativeTime(e.lastSeen)}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <Link
                      href={`/admin/sessions/${e.exampleSessionId}`}
                      className="text-xs text-[var(--revint-300)] hover:text-[var(--revint-200)]"
                    >
                      Open session →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
