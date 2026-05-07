import { getPageAggregates, rangeForPreset } from "@/lib/admin/queries";
import { RangePicker, normaliseRange } from "@/components/admin/range-picker";
import { formatDuration, formatNumber, formatPct } from "@/lib/admin/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const preset = normaliseRange(sp.range);
  const range = rangeForPreset(preset);
  const rows = await getPageAggregates(range);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--leadac-text-1)]">
            Pages
          </h1>
          <p className="mt-1 text-sm text-[var(--leadac-text-2)]">
            Per-path engagement, scroll depth and exit rate.
          </p>
        </div>
        <RangePicker current={preset} basePath="/admin/pages" />
      </header>

      <div className="rounded-xl border border-[var(--leadac-border)] bg-[var(--leadac-card)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--leadac-hover)]/40 text-xs uppercase tracking-wider text-[var(--leadac-text-3)]">
            <tr>
              <th className="text-left px-3 py-2">Path</th>
              <th className="text-right px-3 py-2">Views</th>
              <th className="text-right px-3 py-2">Visitors</th>
              <th className="text-right px-3 py-2">Avg time</th>
              <th className="text-right px-3 py-2">Avg scroll</th>
              <th className="text-left px-3 py-2 w-64">Scroll distribution</th>
              <th className="text-right px-3 py-2">Exits</th>
              <th className="text-right px-3 py-2">Exit rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--leadac-border)]">
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-sm text-[var(--leadac-text-3)]"
                >
                  No page data yet.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const total =
                r.bucketLt25 + r.bucket25to50 + r.bucket50to75 + r.bucket75to100 || 1;
              return (
                <tr key={r.path} className="hover:bg-[var(--leadac-hover)]/40">
                  <td className="px-3 py-2 align-middle">
                    <code className="text-[var(--leadac-text-1)]">{r.path}</code>
                  </td>
                  <td className="px-3 py-2 align-middle text-right tabular-nums">
                    {formatNumber(r.views)}
                  </td>
                  <td className="px-3 py-2 align-middle text-right tabular-nums">
                    {formatNumber(r.uniqueVisitors)}
                  </td>
                  <td className="px-3 py-2 align-middle text-right tabular-nums">
                    {formatDuration(r.avgDurationMs)}
                  </td>
                  <td className="px-3 py-2 align-middle text-right tabular-nums">
                    {r.avgScrollPct}%
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <DistributionBar
                      lt25={r.bucketLt25 / total}
                      m25={r.bucket25to50 / total}
                      m50={r.bucket50to75 / total}
                      m75={r.bucket75to100 / total}
                    />
                  </td>
                  <td className="px-3 py-2 align-middle text-right tabular-nums">
                    {formatNumber(r.exits)}
                  </td>
                  <td className="px-3 py-2 align-middle text-right tabular-nums">
                    {formatPct(r.exitRatePct)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-[var(--leadac-text-3)]">
        Distribution colors: red &lt;25% · orange 25–50% · yellow 50–75% ·
        green 75–100%. Hover bars to read exact share.
      </p>
    </div>
  );
}

function DistributionBar({
  lt25,
  m25,
  m50,
  m75,
}: {
  lt25: number;
  m25: number;
  m50: number;
  m75: number;
}) {
  const segs = [
    { v: lt25, color: "var(--leadac-error)", label: "<25%" },
    { v: m25, color: "var(--leadac-warning)", label: "25-50%" },
    { v: m50, color: "var(--leadac-300)", label: "50-75%" },
    { v: m75, color: "var(--leadac-success)", label: "75-100%" },
  ];
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-md bg-[var(--leadac-hover)]">
      {segs.map((s, i) => {
        if (s.v <= 0) return null;
        return (
          <div
            key={i}
            title={`${s.label}: ${(s.v * 100).toFixed(0)}%`}
            style={{ width: `${s.v * 100}%`, backgroundColor: s.color }}
          />
        );
      })}
    </div>
  );
}
