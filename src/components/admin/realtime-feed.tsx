"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { flagEmoji, formatCountry, shortVisitorId } from "@/lib/admin/format";

export interface RealtimeRow {
  id: string;
  visitorId: string;
  startedAt: string;
  lastActivityAt: string;
  country: string | null;
  city: string | null;
  device: string | null;
  browser: string | null;
  utmSource: string | null;
  pageCount: number;
  hasConverted: boolean;
  currentPath: string | null;
  currentPageEnteredAt: string | null;
}

const POLL_INTERVAL_MS = 5_000;

function relSec(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

export function RealtimeFeed({ initial }: { initial: RealtimeRow[] }) {
  const [rows, setRows] = useState<RealtimeRow[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const flashRef = useRef<Map<string, number>>(new Map());

  // Periodic refetch.
  useEffect(() => {
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const res = await fetch("/api/admin/realtime", { cache: "no-store" });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const j = (await res.json()) as { rows: RealtimeRow[] };
        if (cancelled) return;
        // Mark which session ids are new since last poll so we can
        // briefly highlight them in the UI.
        const next = j.rows;
        const known = new Set(rows.map((r) => r.id));
        const now = Date.now();
        for (const r of next) {
          if (!known.has(r.id)) {
            flashRef.current.set(r.id, now);
          }
        }
        // Drop expired flash markers (>4s).
        for (const [id, ts] of flashRef.current) {
          if (now - ts > 4000) flashRef.current.delete(id);
        }
        setRows(next);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "fetch failed");
      }
    };
    void fetchOnce();
    const t = window.setInterval(fetchOnce, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tick once per second so the relative timers update without
  // refetching. Cheap because it only re-renders this component.
  useEffect(() => {
    const t = window.setInterval(() => setTick((x) => x + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  // Reference `tick` so the linter doesn't complain that it's unused.
  void tick;

  const totalActive = rows.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-sm">
        <span className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-[var(--leadac-card)] border border-[var(--leadac-border)]">
          <span
            className={
              totalActive > 0
                ? "h-2 w-2 rounded-full bg-[var(--leadac-success)] animate-pulse"
                : "h-2 w-2 rounded-full bg-[var(--leadac-text-3)]"
            }
          />
          <span className="text-[var(--leadac-text-1)] tabular-nums">
            {totalActive}
          </span>
          <span className="text-[var(--leadac-text-3)]">active now</span>
        </span>
        {error && (
          <span className="text-xs text-[var(--leadac-error)]">
            offline — retrying ({error})
          </span>
        )}
      </div>

      <div className="rounded-xl border border-[var(--leadac-border)] bg-[var(--leadac-card)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--leadac-hover)]/40 text-xs uppercase tracking-wider text-[var(--leadac-text-3)]">
            <tr>
              <th className="text-left px-3 py-2 w-24">Last seen</th>
              <th className="text-left px-3 py-2">Visitor</th>
              <th className="text-left px-3 py-2">Geo</th>
              <th className="text-left px-3 py-2">Device</th>
              <th className="text-left px-3 py-2">Source</th>
              <th className="text-left px-3 py-2">Now on</th>
              <th className="text-right px-3 py-2">On page</th>
              <th className="text-right px-3 py-2">Pages</th>
              <th className="text-left px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--leadac-border)]">
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-10 text-center text-sm text-[var(--leadac-text-3)]"
                >
                  No active visitors. Open the marketing site in another tab
                  to see yourself appear.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const isFlash =
                flashRef.current.has(r.id) &&
                Date.now() - (flashRef.current.get(r.id) ?? 0) < 4000;
              return (
                <tr
                  key={r.id}
                  className={
                    isFlash
                      ? "bg-[var(--leadac-success)]/10 transition-colors"
                      : "hover:bg-[var(--leadac-hover)]/40 transition-colors"
                  }
                >
                  <td className="px-3 py-2 align-top text-xs text-[var(--leadac-text-3)] tabular-nums">
                    {relSec(r.lastActivityAt)} ago
                  </td>
                  <td className="px-3 py-2 align-top">
                    <code className="text-xs text-[var(--leadac-text-2)]">
                      {shortVisitorId(r.visitorId)}
                    </code>
                  </td>
                  <td className="px-3 py-2 align-top text-[var(--leadac-text-2)]">
                    <span className="mr-1">{flagEmoji(r.country)}</span>
                    {formatCountry(r.country)}
                    {r.city && (
                      <span className="text-[var(--leadac-text-3)]">
                        {" · "}
                        {r.city}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top text-[var(--leadac-text-2)]">
                    {r.device ?? "—"}
                    {r.browser && (
                      <span className="text-[var(--leadac-text-3)]">
                        {" · "}
                        {r.browser}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top text-[var(--leadac-text-2)]">
                    {r.utmSource ?? "(direct)"}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {r.currentPath ? (
                      <code className="text-[var(--leadac-text-1)]">
                        {r.currentPath}
                      </code>
                    ) : (
                      <span className="text-[var(--leadac-text-3)]">
                        (between pages)
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top text-right text-xs tabular-nums text-[var(--leadac-text-3)]">
                    {relSec(r.currentPageEnteredAt)}
                  </td>
                  <td className="px-3 py-2 align-top text-right tabular-nums">
                    {r.pageCount}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <Link
                      href={`/admin/sessions/${r.id}`}
                      className="text-xs text-[var(--leadac-300)] hover:text-[var(--leadac-200)]"
                    >
                      Open →
                    </Link>
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
