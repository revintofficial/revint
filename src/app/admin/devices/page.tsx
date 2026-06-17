import {
  getBrowserBreakdown,
  getDeviceBreakdown,
  getOsBreakdown,
  rangeForPreset,
  type BreakdownRow,
} from "@/lib/admin/queries";
import { RangePicker, normaliseRange } from "@/components/admin/range-picker";
import { BreakdownPie } from "@/components/admin/breakdown-pie";
import { formatDuration, formatNumber, formatPct } from "@/lib/admin/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminDevicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const preset = normaliseRange(sp.range);
  const range = rangeForPreset(preset);
  const [devices, browsers, oses] = await Promise.all([
    getDeviceBreakdown(range),
    getBrowserBreakdown(range),
    getOsBreakdown(range),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--revint-text-1)]">
            Devices &amp; browsers
          </h1>
          <p className="mt-1 text-sm text-[var(--revint-text-2)]">
            Mobile vs desktop, which browser, which OS. Useful when only
            one chunk of visitors is bouncing.
          </p>
        </div>
        <RangePicker current={preset} basePath="/admin/devices" />
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <PieCard title="Device" rows={devices} />
        <PieCard title="Browser" rows={browsers} />
        <PieCard title="Operating system" rows={oses} />
      </div>

      <BreakdownTable title="Device" rows={devices} />
      <BreakdownTable title="Browser" rows={browsers} />
      <BreakdownTable title="Operating system" rows={oses} />
    </div>
  );
}

function PieCard({ title, rows }: { title: string; rows: BreakdownRow[] }) {
  const total = rows.reduce((a, c) => a + c.sessions, 0);
  return (
    <section className="rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)] p-4">
      <header className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-medium text-[var(--revint-text-1)]">{title}</h2>
        <span className="text-[10px] text-[var(--revint-text-3)] tabular-nums">
          {formatNumber(total)} sessions
        </span>
      </header>
      <BreakdownPie data={rows} total={total} label={title} />
    </section>
  );
}

function BreakdownTable({ title, rows }: { title: string; rows: BreakdownRow[] }) {
  return (
    <section>
      <h2 className="text-sm font-medium text-[var(--revint-text-1)] mb-2">
        {title} breakdown
      </h2>
      <div className="rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--revint-hover)]/40 text-xs uppercase tracking-wider text-[var(--revint-text-3)]">
            <tr>
              <th className="text-left px-3 py-2">{title}</th>
              <th className="text-right px-3 py-2">Sessions</th>
              <th className="text-right px-3 py-2">Conversions</th>
              <th className="text-right px-3 py-2">Conv rate</th>
              <th className="text-right px-3 py-2">Avg time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--revint-border)]">
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-sm text-[var(--revint-text-3)]"
                >
                  No data yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.key} className="hover:bg-[var(--revint-hover)]/40">
                <td className="px-3 py-2 align-middle text-[var(--revint-text-1)] capitalize">
                  {r.label}
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
                <td className="px-3 py-2 align-middle text-right tabular-nums">
                  {formatDuration(r.avgDurationMs)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
