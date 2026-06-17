import Link from "next/link";
import {
  getCountryBreakdown,
  getDeviceBreakdown,
  getBrowserBreakdown,
  getOverviewKpis,
  getTimeSeries,
  getTopPages,
  getTopSources,
  pickGranularity,
  rangeForPreset,
} from "@/lib/admin/queries";
import { KpiCard } from "@/components/admin/kpi-card";
import { LiveCounter } from "@/components/admin/live-counter";
import { RangePicker, normaliseRange } from "@/components/admin/range-picker";
import { BarList } from "@/components/admin/bar-list";
import { BreakdownPie } from "@/components/admin/breakdown-pie";
import { TimeSeriesChart } from "@/components/admin/time-series-chart";
import {
  flagEmoji,
  formatCountry,
  formatDuration,
  formatNumber,
  formatPct,
} from "@/lib/admin/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const preset = normaliseRange(sp.range);
  const range = rangeForPreset(preset);
  const granularity = pickGranularity(preset);

  const [kpis, topPages, topSources, timeSeries, countries, devices, browsers] =
    await Promise.all([
      getOverviewKpis(range),
      getTopPages(range, 8),
      getTopSources(range, 8),
      getTimeSeries(range, granularity),
      getCountryBreakdown(range),
      getDeviceBreakdown(range),
      getBrowserBreakdown(range),
    ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--revint-text-1)]">
            Overview
          </h1>
          <p className="mt-1 text-sm text-[var(--revint-text-2)]">
            Marketing forensics. Every visitor, every step.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <LiveCounter />
          <RangePicker current={preset} basePath="/admin" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Sessions" value={formatNumber(kpis.sessions)} />
        <KpiCard label="Unique visitors" value={formatNumber(kpis.uniqueVisitors)} />
        <KpiCard
          label="Conversions"
          value={formatNumber(kpis.conversions)}
          hint={formatPct(kpis.conversionRatePct)}
        />
        <KpiCard label="Avg duration" value={formatDuration(kpis.avgDurationMs)} />
        <KpiCard label="Pages / session" value={kpis.avgPagesPerSession.toFixed(2)} />
        <KpiCard label="Engaged" value={formatPct(kpis.engagedRatePct)} />
        <KpiCard label="Bounce rate" value={formatPct(kpis.bounceRatePct)} />
        <KpiCard
          label="Window"
          value={preset === "today" ? "Today" : preset.toUpperCase()}
        />
      </div>

      <section className="rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)] p-4">
        <header className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium text-[var(--revint-text-1)]">
            Traffic over time
          </h2>
          <span className="text-[10px] uppercase tracking-wider text-[var(--revint-text-3)]">
            {granularity === "hour" ? "Hourly" : "Daily"}
          </span>
        </header>
        <TimeSeriesChart data={timeSeries} granularity={granularity} />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Top countries" linkHref="/admin/geography" linkLabel="See all">
          <BarList
            rows={countries.slice(0, 8).map((c) => ({
              key: c.country ?? "(unknown)",
              label: (
                <span className="inline-flex items-center gap-2">
                  <span>{flagEmoji(c.country)}</span>
                  <span>{formatCountry(c.country)}</span>
                </span>
              ),
              value: c.sessions,
              hint:
                c.conversions > 0 ? (
                  <span className="text-[var(--revint-success)]">
                    +{formatNumber(c.conversions)} conv
                  </span>
                ) : undefined,
            }))}
            emptyLabel="No geo data yet."
          />
        </Card>

        <Card title="Devices" linkHref="/admin/devices" linkLabel="See all">
          <BreakdownPie
            data={devices}
            total={devices.reduce((a, c) => a + c.sessions, 0)}
            label="device"
          />
        </Card>

        <Card title="Browsers" linkHref="/admin/devices" linkLabel="See all">
          <BreakdownPie
            data={browsers}
            total={browsers.reduce((a, c) => a + c.sessions, 0)}
            label="browser"
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Top pages" linkHref="/admin/pages" linkLabel="See all">
          <BarList
            rows={topPages.map((p) => ({
              key: p.path,
              label: <code className="text-[var(--revint-text-1)]">{p.path}</code>,
              value: p.views,
            }))}
            emptyLabel="No traffic in this window yet."
          />
        </Card>

        <Card title="Top sources" linkHref="/admin/sources" linkLabel="See all">
          <BarList
            rows={topSources.map((s) => ({
              key: s.source,
              label: s.source,
              value: s.sessions,
            }))}
            emptyLabel="No sessions in this window yet."
          />
        </Card>
      </div>
    </div>
  );
}

function Card({
  title,
  linkHref,
  linkLabel,
  children,
}: {
  title: string;
  linkHref?: string;
  linkLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)]">
      <header className="px-4 py-3 border-b border-[var(--revint-border)] flex items-center justify-between">
        <h2 className="text-sm font-medium text-[var(--revint-text-1)]">{title}</h2>
        {linkHref && (
          <Link
            href={linkHref}
            className="text-xs text-[var(--revint-text-3)] hover:text-[var(--revint-text-1)]"
          >
            {linkLabel ?? "Open"} →
          </Link>
        )}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
