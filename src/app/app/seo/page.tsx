import { notFound } from "next/navigation";
import { getOptionalUser } from "@/lib/auth";
import { getRedis } from "@/lib/redis";
import { PageHeader } from "@/components/ui/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { isGscConfigured } from "@/lib/seo/gsc";
import { isIndexNowConfigured } from "@/lib/seo/indexnow";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const GSC_CACHE_QUERIES = "seo:gsc:queries:latest";
const GSC_CACHE_PAGES = "seo:gsc:pages:latest";
const GSC_CACHE_DAILY = "seo:gsc:daily";
const BROKEN_LINKS_KEY = "seo:broken-links:latest";
const VITALS_KEYS = ["LCP", "CLS", "INP", "FCP", "TTFB"] as const;

type GscCache = {
  updatedAt: number;
  range?: { start: string; end: string };
  rows: Array<{
    keys: string[];
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
};

type VitalsSample = {
  name: string;
  value: number;
  rating: string | null;
  path: string | null;
  ts: number;
};

type BrokenLinksCache = {
  scannedAt: number;
  totalUrls: number;
  sampled: number;
  broken: Array<{ url: string; status: number }>;
};

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const r = getRedis();
    const raw = await r.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function readVitals(): Promise<
  Record<string, { p75: number | null; count: number }>
> {
  const result: Record<string, { p75: number | null; count: number }> = {};
  const r = getRedis();
  for (const name of VITALS_KEYS) {
    const key = `web-vitals:${name}`;
    try {
      const raw = await r.zrange(key, -500, -1);
      const values = raw
        .map((s) => {
          try {
            return JSON.parse(s) as VitalsSample;
          } catch {
            return null;
          }
        })
        .filter((v): v is VitalsSample => v !== null);
      if (values.length === 0) {
        result[name] = { p75: null, count: 0 };
        continue;
      }
      const sorted = values.map((v) => v.value).sort((a, b) => a - b);
      const p75 = sorted[Math.floor(sorted.length * 0.75)] ?? null;
      result[name] = { p75, count: values.length };
    } catch {
      result[name] = { p75: null, count: 0 };
    }
  }
  return result;
}

function vitalStatus(
  name: string,
  p75: number | null,
): { label: string; tone: "good" | "ni" | "poor" | "unknown" } {
  if (p75 == null) return { label: "—", tone: "unknown" };
  const thresholds: Record<string, [number, number]> = {
    LCP: [2500, 4000],
    CLS: [0.1, 0.25],
    INP: [200, 500],
    FCP: [1800, 3000],
    TTFB: [800, 1800],
  };
  const t = thresholds[name];
  if (!t) return { label: "—", tone: "unknown" };
  if (p75 <= t[0]) return { label: "Good", tone: "good" };
  if (p75 <= t[1]) return { label: "Needs improvement", tone: "ni" };
  return { label: "Poor", tone: "poor" };
}

function fmtVital(name: string, p75: number | null): string {
  if (p75 == null) return "—";
  if (name === "CLS") return p75.toFixed(3);
  if (p75 >= 1000) return `${(p75 / 1000).toFixed(2)} s`;
  return `${Math.round(p75)} ms`;
}

function fmtRelative(ts: number | undefined): string {
  if (!ts) return "never";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default async function SeoDashboardPage() {
  const session = await getOptionalUser();
  if (!session) notFound();
  if (session.role !== "OWNER" && session.role !== "ADMIN") notFound();

  const [queries, pages, daily, broken, vitals] = await Promise.all([
    readJson<GscCache>(GSC_CACHE_QUERIES),
    readJson<GscCache>(GSC_CACHE_PAGES),
    readJson<GscCache>(GSC_CACHE_DAILY),
    readJson<BrokenLinksCache>(BROKEN_LINKS_KEY),
    readVitals(),
  ]);

  const gscReady = isGscConfigured();
  const indexNowReady = isIndexNowConfigured();

  const totalClicks =
    daily?.rows.reduce((s, r) => s + (r.clicks ?? 0), 0) ?? 0;
  const totalImpressions =
    daily?.rows.reduce((s, r) => s + (r.impressions ?? 0), 0) ?? 0;
  const avgPosition =
    daily && daily.rows.length > 0
      ? daily.rows.reduce((s, r) => s + (r.position ?? 0), 0) /
        daily.rows.length
      : null;
  const overallCtr =
    totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <PageHeader
        title="SEO operations"
        subtitle="Indexed URLs, Core Web Vitals, Search Console signals, broken-link scans."
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Clicks (28d)"
          value={gscReady ? totalClicks.toLocaleString() : "—"}
          hint={gscReady ? "GSC daily" : "GSC not wired"}
        />
        <KpiCard
          label="Impressions (28d)"
          value={gscReady ? totalImpressions.toLocaleString() : "—"}
          hint={gscReady ? "GSC daily" : "GSC not wired"}
        />
        <KpiCard
          label="CTR (28d)"
          value={overallCtr != null ? `${overallCtr.toFixed(2)}%` : "—"}
          hint="Clicks / impressions"
        />
        <KpiCard
          label="Avg position (28d)"
          value={avgPosition != null ? avgPosition.toFixed(1) : "—"}
          hint="Lower is better"
        />
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span>Core Web Vitals (p75, last ~500 samples)</span>
              <Badge variant="outline" className="font-mono text-[10px]">
                /api/web-vitals
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {VITALS_KEYS.map((name) => {
              const v = vitals[name];
              const s = vitalStatus(name, v.p75);
              return (
                <div
                  key={name}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="font-mono text-white/80">{name}</div>
                  <div className="flex items-center gap-3">
                    <div className="text-white">{fmtVital(name, v.p75)}</div>
                    <div className="text-xs text-white/50">
                      {v.count} samples
                    </div>
                    <VitalPill tone={s.tone} label={s.label} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Operations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-white/80">
            <OpsRow
              label="Search Console ingest"
              status={gscReady ? "ready" : "not-configured"}
              detail={
                gscReady
                  ? `Last run ${fmtRelative(queries?.updatedAt)}`
                  : "Set GSC_SERVICE_ACCOUNT_JSON + GSC_SITE_URL"
              }
            />
            <OpsRow
              label="IndexNow push"
              status={indexNowReady ? "ready" : "not-configured"}
              detail={
                indexNowReady
                  ? "Fire via enqueueSeoOpsJob() when new pages publish"
                  : "Set INDEXNOW_KEY"
              }
            />
            <OpsRow
              label="Broken-link scan"
              status={broken ? "ready" : "pending"}
              detail={
                broken
                  ? `Last run ${fmtRelative(broken.scannedAt)} — sampled ${broken.sampled}, ${broken.broken.length} broken`
                  : "First weekly scan pending"
              }
            />
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Top queries ({queries?.range?.start ?? "—"} →{" "}
              {queries?.range?.end ?? "—"})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {queries && queries.rows.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-white/50">
                    <th className="pb-2">Query</th>
                    <th className="pb-2 text-right">Clicks</th>
                    <th className="pb-2 text-right">Impr.</th>
                    <th className="pb-2 text-right">CTR</th>
                    <th className="pb-2 text-right">Pos.</th>
                  </tr>
                </thead>
                <tbody>
                  {queries.rows
                    .slice()
                    .sort((a, b) => b.clicks - a.clicks)
                    .slice(0, 20)
                    .map((row, i) => (
                      <tr
                        key={`${row.keys[0]}-${i}`}
                        className="border-t border-white/5"
                      >
                        <td className="py-1.5 pr-2 text-white/90">
                          {row.keys[0]}
                        </td>
                        <td className="py-1.5 text-right text-white/70">
                          {row.clicks}
                        </td>
                        <td className="py-1.5 text-right text-white/50">
                          {row.impressions}
                        </td>
                        <td className="py-1.5 text-right text-white/50">
                          {(row.ctr * 100).toFixed(1)}%
                        </td>
                        <td className="py-1.5 text-right text-white/70">
                          {row.position.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ) : (
              <EmptyState text={gscReady ? "Awaiting first ingest" : "GSC not configured"} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top pages</CardTitle>
          </CardHeader>
          <CardContent>
            {pages && pages.rows.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-white/50">
                    <th className="pb-2">Page</th>
                    <th className="pb-2 text-right">Clicks</th>
                    <th className="pb-2 text-right">Pos.</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.rows
                    .slice()
                    .sort((a, b) => b.clicks - a.clicks)
                    .slice(0, 20)
                    .map((row, i) => (
                      <tr
                        key={`${row.keys[0]}-${i}`}
                        className="border-t border-white/5"
                      >
                        <td className="truncate py-1.5 pr-2 text-white/80">
                          <span className="font-mono text-xs">
                            {shortenUrl(row.keys[0])}
                          </span>
                        </td>
                        <td className="py-1.5 text-right text-white/70">
                          {row.clicks}
                        </td>
                        <td className="py-1.5 text-right text-white/70">
                          {row.position.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ) : (
              <EmptyState text={gscReady ? "Awaiting first ingest" : "GSC not configured"} />
            )}
          </CardContent>
        </Card>
      </div>

      {broken && broken.broken.length > 0 ? (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-base text-red-300">
              Broken links — {broken.broken.length} of {broken.sampled} sampled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-white/50">
                    <th className="pb-2">URL</th>
                    <th className="pb-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {broken.broken.slice(0, 200).map((b) => (
                    <tr key={b.url} className="border-t border-white/5">
                      <td className="truncate py-1.5 pr-2">
                        <a
                          href={b.url}
                          rel="nofollow noopener"
                          className="font-mono text-xs text-red-300 hover:underline"
                        >
                          {shortenUrl(b.url)}
                        </a>
                      </td>
                      <td className="py-1.5 text-right text-white/70">
                        {b.status || "fetch error"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function shortenUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + (u.search || "");
  } catch {
    return url;
  }
}

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-xs font-medium uppercase tracking-wide text-white/50">
          {label}
        </div>
        <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
        {hint ? (
          <div className="mt-1 text-xs text-white/50">{hint}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function VitalPill({
  tone,
  label,
}: {
  tone: "good" | "ni" | "poor" | "unknown";
  label: string;
}) {
  const tones: Record<typeof tone, string> = {
    good: "bg-emerald-500/15 text-emerald-300 border-emerald-400/20",
    ni: "bg-amber-500/15 text-amber-300 border-amber-400/20",
    poor: "bg-red-500/15 text-red-300 border-red-400/20",
    unknown: "bg-white/5 text-white/50 border-white/10",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${tones[tone]}`}
    >
      {label}
    </span>
  );
}

function OpsRow({
  label,
  status,
  detail,
}: {
  label: string;
  status: "ready" | "not-configured" | "pending";
  detail: string;
}) {
  const dotClass =
    status === "ready"
      ? "bg-emerald-400"
      : status === "pending"
        ? "bg-amber-400"
        : "bg-white/30";
  return (
    <div className="flex items-start gap-3">
      <span className={`mt-1 h-2 w-2 flex-none rounded-full ${dotClass}`} />
      <div className="flex-1">
        <div className="text-white">{label}</div>
        <div className="text-xs text-white/50">{detail}</div>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-white/10 p-6 text-center text-sm text-white/40">
      {text}
    </div>
  );
}
