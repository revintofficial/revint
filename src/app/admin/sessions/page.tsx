import Link from "next/link";
import { listSessions } from "@/lib/admin/queries";
import {
  flagEmoji,
  formatCountry,
  formatDuration,
  formatNumber,
  relativeTime,
  shortVisitorId,
} from "@/lib/admin/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 50;

function parseBool(v: string | string[] | undefined): boolean | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  if (s === "true") return true;
  if (s === "false") return false;
  return undefined;
}
function s(v: string | string[] | undefined): string | undefined {
  const x = Array.isArray(v) ? v[0] : v;
  return x && x.trim() ? x.trim() : undefined;
}

export default async function AdminSessionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const page = Number(s(sp.page) ?? 0) || 0;

  const { items, total, hasNext } = await listSessions(
    {
      country: s(sp.country),
      device: s(sp.device),
      utmSource: s(sp.utmSource),
      visitorId: s(sp.visitorId),
      hasConverted: parseBool(sp.hasConverted),
      hasEngaged: parseBool(sp.hasEngaged),
    },
    page,
    PAGE_SIZE,
  );

  // Build pagination links preserving filters.
  const buildHref = (nextPage: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (k === "page") continue;
      if (typeof v === "string") next.set(k, v);
      else if (Array.isArray(v) && v[0]) next.set(k, v[0]);
    }
    next.set("page", String(nextPage));
    return `/admin/sessions?${next.toString()}`;
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--leadac-text-1)]">
            Sessions
          </h1>
          <p className="mt-1 text-sm text-[var(--leadac-text-2)]">
            {formatNumber(total)} sessions match. Click any row for the full
            timeline.
          </p>
        </div>
      </header>

      <FilterBar searchParams={sp} />

      <div className="rounded-xl border border-[var(--leadac-border)] bg-[var(--leadac-card)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--leadac-hover)]/40 text-xs uppercase tracking-wider text-[var(--leadac-text-3)]">
            <tr>
              <th className="text-left px-3 py-2">When</th>
              <th className="text-left px-3 py-2">Visitor</th>
              <th className="text-left px-3 py-2">Geo</th>
              <th className="text-left px-3 py-2">Device</th>
              <th className="text-left px-3 py-2">Source</th>
              <th className="text-left px-3 py-2">Landing → Exit</th>
              <th className="text-right px-3 py-2">Pages</th>
              <th className="text-right px-3 py-2">Duration</th>
              <th className="text-right px-3 py-2">Scroll</th>
              <th className="text-left px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--leadac-border)]">
            {items.length === 0 && (
              <tr>
                <td
                  colSpan={10}
                  className="px-4 py-8 text-center text-sm text-[var(--leadac-text-3)]"
                >
                  No sessions match. Adjust the filters or wait for traffic.
                </td>
              </tr>
            )}
            {items.map((it) => (
              <tr
                key={it.id}
                className="hover:bg-[var(--leadac-hover)]/40 transition-colors"
              >
                <td className="px-3 py-2 align-top">
                  <Link
                    href={`/admin/sessions/${it.id}`}
                    className="text-[var(--leadac-text-1)] hover:text-[var(--leadac-300)]"
                  >
                    {relativeTime(it.startedAt)}
                  </Link>
                </td>
                <td className="px-3 py-2 align-top">
                  <code className="text-xs text-[var(--leadac-text-2)]">
                    {shortVisitorId(it.visitorId)}
                  </code>
                </td>
                <td className="px-3 py-2 align-top">
                  <span className="mr-1">{flagEmoji(it.country)}</span>
                  <span className="text-[var(--leadac-text-2)]">
                    {formatCountry(it.country)}
                  </span>
                </td>
                <td className="px-3 py-2 align-top text-[var(--leadac-text-2)]">
                  {it.device ?? "—"}
                </td>
                <td className="px-3 py-2 align-top text-[var(--leadac-text-2)]">
                  {it.utmSource ?? "(direct)"}
                </td>
                <td className="px-3 py-2 align-top text-xs text-[var(--leadac-text-2)] max-w-[260px] truncate">
                  <code>{it.landingPath}</code>
                  {it.exitPath && it.exitPath !== it.landingPath && (
                    <>
                      <span className="text-[var(--leadac-text-3)]"> → </span>
                      <code>{it.exitPath}</code>
                    </>
                  )}
                </td>
                <td className="px-3 py-2 align-top text-right tabular-nums">
                  {it.pageCount}
                </td>
                <td className="px-3 py-2 align-top text-right tabular-nums">
                  {formatDuration(it.durationMs)}
                </td>
                <td className="px-3 py-2 align-top text-right tabular-nums">
                  {it.maxScrollPct}%
                </td>
                <td className="px-3 py-2 align-top">
                  <div className="flex flex-col gap-1">
                    {it.hasConverted && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--leadac-success)]/15 text-[var(--leadac-success)]">
                        converted
                      </span>
                    )}
                    {it.hasEngaged && !it.hasConverted && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--leadac-info)]/15 text-[var(--leadac-info)]">
                        engaged
                      </span>
                    )}
                    {!it.hasEngaged && !it.hasConverted && (
                      <span className="text-[10px] text-[var(--leadac-text-3)]">
                        bounce
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <div className="text-[var(--leadac-text-3)]">
          Page {page + 1} · {formatNumber(total)} total
        </div>
        <div className="flex items-center gap-2">
          {page > 0 && (
            <Link
              href={buildHref(page - 1)}
              className="px-3 py-1 rounded border border-[var(--leadac-border)] text-[var(--leadac-text-2)] hover:text-[var(--leadac-text-1)]"
            >
              ← Prev
            </Link>
          )}
          {hasNext && (
            <Link
              href={buildHref(page + 1)}
              className="px-3 py-1 rounded border border-[var(--leadac-border)] text-[var(--leadac-text-2)] hover:text-[var(--leadac-text-1)]"
            >
              Next →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterBar({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const get = (k: string) => {
    const v = searchParams[k];
    return Array.isArray(v) ? v[0] : v;
  };
  return (
    <form
      action="/admin/sessions"
      method="get"
      className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--leadac-border)] bg-[var(--leadac-card)] p-3"
    >
      <FilterField label="Country" name="country" value={get("country")} />
      <FilterField label="Device" name="device" value={get("device")} placeholder="mobile" />
      <FilterField label="UTM source" name="utmSource" value={get("utmSource")} />
      <FilterField label="Visitor id" name="visitorId" value={get("visitorId")} />
      <FilterSelect
        label="Engaged"
        name="hasEngaged"
        value={get("hasEngaged")}
        options={[
          { v: "", label: "Any" },
          { v: "true", label: "Engaged" },
          { v: "false", label: "Bounce" },
        ]}
      />
      <FilterSelect
        label="Converted"
        name="hasConverted"
        value={get("hasConverted")}
        options={[
          { v: "", label: "Any" },
          { v: "true", label: "Yes" },
          { v: "false", label: "No" },
        ]}
      />
      <button
        type="submit"
        className="px-3 py-1.5 rounded-md text-xs bg-[var(--leadac-500)] text-black font-medium hover:bg-[var(--leadac-400)]"
      >
        Apply
      </button>
      <Link
        href="/admin/sessions"
        className="px-3 py-1.5 rounded-md text-xs border border-[var(--leadac-border)] text-[var(--leadac-text-2)] hover:text-[var(--leadac-text-1)]"
      >
        Reset
      </Link>
    </form>
  );
}

function FilterField({
  label,
  name,
  value,
  placeholder,
}: {
  label: string;
  name: string;
  value: string | undefined;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-[var(--leadac-text-3)]">
        {label}
      </span>
      <input
        type="text"
        name={name}
        defaultValue={value ?? ""}
        placeholder={placeholder}
        className="px-2 py-1 rounded-md text-sm bg-[var(--leadac-bg)] border border-[var(--leadac-border)] text-[var(--leadac-text-1)] focus:outline-none focus:border-[var(--leadac-500)]"
      />
    </label>
  );
}

function FilterSelect({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value: string | undefined;
  options: Array<{ v: string; label: string }>;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-[var(--leadac-text-3)]">
        {label}
      </span>
      <select
        name={name}
        defaultValue={value ?? ""}
        className="px-2 py-1 rounded-md text-sm bg-[var(--leadac-bg)] border border-[var(--leadac-border)] text-[var(--leadac-text-1)] focus:outline-none focus:border-[var(--leadac-500)]"
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
