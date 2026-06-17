import Link from "next/link";
import {
  getCityBreakdown,
  getCountryBreakdown,
  rangeForPreset,
} from "@/lib/admin/queries";
import { RangePicker, normaliseRange } from "@/components/admin/range-picker";
import {
  flagEmoji,
  formatCountry,
  formatDuration,
  formatNumber,
  formatPct,
} from "@/lib/admin/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminGeographyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const preset = normaliseRange(sp.range);
  const range = rangeForPreset(preset);
  const [countries, cities] = await Promise.all([
    getCountryBreakdown(range),
    getCityBreakdown(range, 100),
  ]);

  const totalSessions = countries.reduce((a, c) => a + c.sessions, 0);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--revint-text-1)]">
            Geography
          </h1>
          <p className="mt-1 text-sm text-[var(--revint-text-2)]">
            Where your traffic actually comes from. Country &amp; city
            resolution from edge headers (no IP lookup).
          </p>
        </div>
        <RangePicker current={preset} basePath="/admin/geography" />
      </header>

      <section>
        <h2 className="text-sm font-medium text-[var(--revint-text-1)] mb-2">
          Countries ({formatNumber(countries.length)})
        </h2>
        <div className="rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--revint-hover)]/40 text-xs uppercase tracking-wider text-[var(--revint-text-3)]">
              <tr>
                <th className="text-left px-3 py-2">Country</th>
                <th className="text-left px-3 py-2 w-44">Share</th>
                <th className="text-right px-3 py-2">Sessions</th>
                <th className="text-right px-3 py-2">Visitors</th>
                <th className="text-right px-3 py-2">Conversions</th>
                <th className="text-right px-3 py-2">Conv rate</th>
                <th className="text-right px-3 py-2">Avg time</th>
                <th className="text-left px-3 py-2">Top city</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--revint-border)]">
              {countries.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-sm text-[var(--revint-text-3)]"
                  >
                    No traffic in this window yet.
                  </td>
                </tr>
              )}
              {countries.map((c) => {
                const share =
                  totalSessions > 0 ? (c.sessions / totalSessions) * 100 : 0;
                return (
                  <tr key={c.country ?? "_unknown"} className="hover:bg-[var(--revint-hover)]/40">
                    <td className="px-3 py-2 align-middle">
                      <Link
                        href={c.country ? `/admin/sessions?country=${encodeURIComponent(c.country)}` : "/admin/sessions"}
                        className="inline-flex items-center gap-2 text-[var(--revint-text-1)] hover:text-[var(--revint-300)]"
                      >
                        <span className="text-base">{flagEmoji(c.country)}</span>
                        <span>{formatCountry(c.country)}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-[var(--revint-hover)] overflow-hidden">
                          <div
                            className="h-full bg-[var(--revint-500)]/80"
                            style={{ width: `${share}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-[var(--revint-text-3)] w-9 text-right tabular-nums">
                          {share.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 align-middle text-right tabular-nums">
                      {formatNumber(c.sessions)}
                    </td>
                    <td className="px-3 py-2 align-middle text-right tabular-nums">
                      {formatNumber(c.uniqueVisitors)}
                    </td>
                    <td className="px-3 py-2 align-middle text-right tabular-nums">
                      {formatNumber(c.conversions)}
                    </td>
                    <td className="px-3 py-2 align-middle text-right tabular-nums">
                      {formatPct(c.conversionRatePct)}
                    </td>
                    <td className="px-3 py-2 align-middle text-right tabular-nums">
                      {formatDuration(c.avgDurationMs)}
                    </td>
                    <td className="px-3 py-2 align-middle text-[var(--revint-text-2)]">
                      {c.topCity ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-[var(--revint-text-1)] mb-2">
          Cities ({formatNumber(cities.length)} top)
        </h2>
        <div className="rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--revint-hover)]/40 text-xs uppercase tracking-wider text-[var(--revint-text-3)]">
              <tr>
                <th className="text-left px-3 py-2">City</th>
                <th className="text-left px-3 py-2">Region</th>
                <th className="text-left px-3 py-2">Country</th>
                <th className="text-right px-3 py-2">Sessions</th>
                <th className="text-right px-3 py-2">Visitors</th>
                <th className="text-right px-3 py-2">Conversions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--revint-border)]">
              {cities.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-sm text-[var(--revint-text-3)]"
                  >
                    No city resolution available. Make sure edge headers
                    (`x-vercel-ip-city` etc.) reach the ingest endpoint.
                  </td>
                </tr>
              )}
              {cities.map((c, i) => (
                <tr key={i} className="hover:bg-[var(--revint-hover)]/40">
                  <td className="px-3 py-2 align-middle text-[var(--revint-text-1)]">
                    {c.city}
                  </td>
                  <td className="px-3 py-2 align-middle text-[var(--revint-text-2)]">
                    {c.region ?? "—"}
                  </td>
                  <td className="px-3 py-2 align-middle text-[var(--revint-text-2)]">
                    <span className="mr-1">{flagEmoji(c.country)}</span>
                    {formatCountry(c.country)}
                  </td>
                  <td className="px-3 py-2 align-middle text-right tabular-nums">
                    {formatNumber(c.sessions)}
                  </td>
                  <td className="px-3 py-2 align-middle text-right tabular-nums">
                    {formatNumber(c.uniqueVisitors)}
                  </td>
                  <td className="px-3 py-2 align-middle text-right tabular-nums">
                    {formatNumber(c.conversions)}
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
