import { getDefaultFunnel, rangeForPreset } from "@/lib/admin/queries";
import { RangePicker, normaliseRange } from "@/components/admin/range-picker";
import { formatNumber, formatPct } from "@/lib/admin/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminFunnelsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const preset = normaliseRange(sp.range);
  const range = rangeForPreset(preset);
  const steps = await getDefaultFunnel(range);
  const top = steps[0]?.count ?? 0;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--revint-text-1)]">
            Funnels
          </h1>
          <p className="mt-1 text-sm text-[var(--revint-text-2)]">
            Default funnel: home → pricing → signup → completed.
          </p>
        </div>
        <RangePicker current={preset} basePath="/admin/funnels" />
      </header>

      <div className="rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)] p-4">
        <ol className="space-y-3">
          {steps.map((s, i) => {
            const widthPct = top > 0 ? Math.max(2, (s.count / top) * 100) : 0;
            return (
              <li key={s.label} className="flex items-center gap-4">
                <div className="w-28 shrink-0">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--revint-text-3)]">
                    Step {i + 1}
                  </div>
                  <div className="text-sm text-[var(--revint-text-1)]">
                    {s.label}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="relative h-8 rounded-md bg-[var(--revint-hover)] overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-[var(--revint-500)]/80 flex items-center justify-end pr-3 text-xs font-medium text-black"
                      style={{ width: `${widthPct}%` }}
                    >
                      {formatNumber(s.count)}
                    </div>
                  </div>
                </div>
                <div className="w-32 shrink-0 text-right">
                  {i > 0 && s.dropoffPct > 0 && (
                    <span className="text-xs text-[var(--revint-error)]">
                      −{formatPct(s.dropoffPct, 0)} drop
                    </span>
                  )}
                  {i === 0 && (
                    <span className="text-xs text-[var(--revint-text-3)]">
                      entry
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)] p-4">
          <div className="text-xs uppercase tracking-wider text-[var(--revint-text-3)]">
            Top → Bottom conversion
          </div>
          <div className="mt-1 text-2xl font-semibold text-[var(--revint-text-1)] tabular-nums">
            {top > 0 && steps[steps.length - 1]
              ? formatPct(((steps[steps.length - 1]?.count ?? 0) / top) * 100)
              : "—"}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)] p-4">
          <div className="text-xs uppercase tracking-wider text-[var(--revint-text-3)]">
            Biggest drop
          </div>
          <div className="mt-1 text-sm text-[var(--revint-text-1)]">
            {(() => {
              let worst = { label: "—", pct: 0 };
              for (let i = 1; i < steps.length; i++) {
                if (steps[i]!.dropoffPct > worst.pct) {
                  worst = { label: steps[i]!.label, pct: steps[i]!.dropoffPct };
                }
              }
              return worst.pct > 0
                ? `${worst.label} (${formatPct(worst.pct, 0)})`
                : "No drop yet";
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
