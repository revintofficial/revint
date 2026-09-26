import Link from "next/link";
import { loadAdminLogs } from "@/lib/admin/app-logs";
import { formatNumber } from "@/lib/admin/format";
import { LogsTabs } from "@/components/admin/logs-tabs";
import { LogAutoRefresh, LogFeed } from "@/components/admin/log-feed";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const LEVELS = ["error", "warn", "info", "debug"] as const;
const SOURCES = [
  { value: "web", label: "Vercel" },
  { value: "worker", label: "Railway" },
] as const;

function one(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function logsHref(input: {
  level?: string;
  source?: string;
  q?: string;
  cursor?: string;
}): string {
  const params = new URLSearchParams();
  if (input.level) params.set("level", input.level);
  if (input.source) params.set("source", input.source);
  if (input.q) params.set("q", input.q);
  if (input.cursor) params.set("cursor", input.cursor);
  const qs = params.toString();
  return qs ? `/admin/logs?${qs}` : "/admin/logs";
}

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const level = one(sp.level) ?? "";
  const source = one(sp.source) ?? "";
  const q = one(sp.q) ?? "";
  const cursor = one(sp.cursor) ?? "";
  const data = await loadAdminLogs({
    level,
    source,
    q,
    cursor,
  });
  const total = data.counts.reduce((sum, row) => sum + row.count, 0);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div className="space-y-3">
          <LogsTabs current="runtime" />
          <div>
            <h1 className="text-2xl font-semibold text-[var(--revint-text-1)]">
              Logs
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--revint-text-2)]">
              Every logger line from the Vercel app and the Railway workers,
              plus console errors that skipped the logger. Kept for 48 hours.
              Tokens, cookies, and database URLs are redacted.
            </p>
          </div>
        </div>
        <LogAutoRefresh />
      </header>

      <form
        key={`${level}|${source}|${q}`}
        action="/admin/logs"
        className="flex flex-wrap items-center gap-2"
      >
        <select
          name="level"
          defaultValue={level}
          className="rounded-lg border border-[var(--revint-border)] bg-[var(--revint-card)] px-2 py-1.5 text-sm text-[var(--revint-text-1)]"
        >
          <option value="">All levels</option>
          {LEVELS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          name="source"
          defaultValue={source}
          className="rounded-lg border border-[var(--revint-border)] bg-[var(--revint-card)] px-2 py-1.5 text-sm text-[var(--revint-text-1)]"
        >
          <option value="">Vercel + Railway</option>
          {SOURCES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <input
          name="q"
          defaultValue={q}
          placeholder="Search event or message"
          className="min-w-[220px] flex-1 rounded-lg border border-[var(--revint-border)] bg-[var(--revint-card)] px-3 py-1.5 text-sm text-[var(--revint-text-1)] placeholder:text-[var(--revint-text-3)]"
        />
        <button
          type="submit"
          className="rounded-lg border border-[var(--revint-border)] bg-[var(--revint-hover)] px-3 py-1.5 text-sm text-[var(--revint-text-1)]"
        >
          Filter
        </button>
        {(level || source || q) && (
          <Link
            href="/admin/logs"
            className="text-xs text-[var(--revint-text-3)] hover:text-[var(--revint-text-1)]"
          >
            Clear
          </Link>
        )}
      </form>

      <div className="flex flex-wrap gap-2">
        <span className="rounded-full border border-[var(--revint-border)] px-2.5 py-1 text-[11px] text-[var(--revint-text-2)] tabular-nums">
          {formatNumber(total)} in 48h
        </span>
        {data.counts.map((row) => (
          <Link
            key={row.level}
            href={logsHref({ level: row.level, source, q })}
            className="rounded-full border border-[var(--revint-border)] px-2.5 py-1 text-[11px] text-[var(--revint-text-2)] tabular-nums hover:text-[var(--revint-text-1)]"
          >
            {row.level} {formatNumber(row.count)}
          </Link>
        ))}
      </div>

      {data.error && (
        <div className="rounded-xl border border-[var(--revint-error)]/40 bg-[var(--revint-error)]/10 px-4 py-3 text-sm text-[var(--revint-error)]">
          {data.error}
        </div>
      )}

      <section className="rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)] overflow-hidden">
        <LogFeed rows={data.rows} />
      </section>

      {data.nextCursor && (
        <div className="flex justify-end">
          <Link
            href={logsHref({
              level,
              source,
              q,
              cursor: data.nextCursor,
            })}
            className="text-sm text-[var(--revint-300)] hover:text-[var(--revint-200)]"
          >
            Older lines →
          </Link>
        </div>
      )}
    </div>
  );
}
