import Link from "next/link";
import { getSourceMatrix, rangeForPreset } from "@/lib/admin/queries";
import { RangePicker, normaliseRange } from "@/components/admin/range-picker";
import { formatNumber, formatPct } from "@/lib/admin/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminSourcesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const preset = normaliseRange(sp.range);
  const range = rangeForPreset(preset);
  const rows = await getSourceMatrix(range);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--revint-text-1)]">
            Sources
          </h1>
          <p className="mt-1 text-sm text-[var(--revint-text-2)]">
            UTM + referrer attribution. Filter sessions by clicking a source.
          </p>
        </div>
        <RangePicker current={preset} basePath="/admin/sources" />
      </header>

      <div className="rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--revint-hover)]/40 text-xs uppercase tracking-wider text-[var(--revint-text-3)]">
            <tr>
              <th className="text-left px-3 py-2">Source</th>
              <th className="text-left px-3 py-2">Medium</th>
              <th className="text-left px-3 py-2">Campaign</th>
              <th className="text-right px-3 py-2">Sessions</th>
              <th className="text-right px-3 py-2">Conversions</th>
              <th className="text-right px-3 py-2">Conv rate</th>
              <th className="text-left px-3 py-2">Top landing</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--revint-border)]">
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-sm text-[var(--revint-text-3)]"
                >
                  No traffic in this window yet.
                </td>
              </tr>
            )}
            {rows.map((r, i) => {
              const isUtm = !r.source.startsWith("(");
              return (
                <tr key={i} className="hover:bg-[var(--revint-hover)]/40">
                  <td className="px-3 py-2 align-middle">
                    {isUtm ? (
                      <Link
                        href={`/admin/sessions?utmSource=${encodeURIComponent(r.source)}`}
                        className="text-[var(--revint-text-1)] hover:text-[var(--revint-300)]"
                      >
                        {r.source}
                      </Link>
                    ) : (
                      <span className="text-[var(--revint-text-2)]">{r.source}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-middle text-[var(--revint-text-2)]">
                    {r.medium ?? "—"}
                  </td>
                  <td className="px-3 py-2 align-middle text-[var(--revint-text-2)]">
                    {r.campaign ?? "—"}
                  </td>
                  <td className="px-3 py-2 align-middle text-right tabular-nums">
                    {formatNumber(r.sessions)}
                  </td>
                  <td className="px-3 py-2 align-middle text-right tabular-nums">
                    {formatNumber(r.conversions)}
                  </td>
                  <td className="px-3 py-2 align-middle text-right tabular-nums">
                    {formatPct(r.conversionRatePct)}
                  </td>
                  <td className="px-3 py-2 align-middle text-xs text-[var(--revint-text-2)] max-w-[260px] truncate">
                    {r.topLandingPath ? <code>{r.topLandingPath}</code> : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
