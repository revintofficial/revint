"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sourceLabel } from "@/lib/app-log";
import { relativeTime } from "@/lib/admin/format";
import type { AdminLogRow } from "@/lib/admin/app-logs";
import { cn } from "@/lib/utils";

function rowSource(row: AdminLogRow): string {
  const runtime =
    row.fields &&
    typeof row.fields === "object" &&
    row.fields !== null &&
    "runtime" in row.fields
      ? String((row.fields as { runtime?: unknown }).runtime)
      : null;
  return sourceLabel(row.source, runtime);
}

const LEVEL_CLASS: Record<string, string> = {
  error: "text-[var(--revint-error)]",
  warn: "text-[var(--revint-warning)]",
  info: "text-[var(--revint-text-2)]",
  debug: "text-[var(--revint-text-3)]",
};

export function LogAutoRefresh() {
  const router = useRouter();
  const [live, setLive] = useState(true);

  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(id);
  }, [live, router]);

  return (
    <button
      type="button"
      onClick={() => setLive((value) => !value)}
      className={cn(
        "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
        live
          ? "border-[var(--revint-success)]/40 text-[var(--revint-success)] bg-[var(--revint-success)]/10"
          : "border-[var(--revint-border)] text-[var(--revint-text-2)]",
      )}
    >
      {live ? "Live · 5s" : "Paused"}
    </button>
  );
}

export function LogFeed({ rows }: { rows: AdminLogRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-sm text-[var(--revint-text-3)]">
        No log lines in the last 48 hours for this filter. New lines show up
        within a few seconds of the app or a worker emitting them.
      </div>
    );
  }

  return (
    <div className="divide-y divide-[var(--revint-border)]">
      {rows.map((row) => {
        const open = openId === row.id;
        return (
          <div key={row.id} className="px-3 py-2">
            <button
              type="button"
              onClick={() => setOpenId(open ? null : row.id)}
              className="w-full text-left grid grid-cols-1 md:grid-cols-[4.5rem_5.5rem_minmax(0,1fr)_7rem] gap-x-3 gap-y-1 items-baseline"
            >
              <span
                className={cn(
                  "text-[11px] uppercase tracking-wider font-medium",
                  LEVEL_CLASS[row.level] ?? "text-[var(--revint-text-2)]",
                )}
              >
                {row.level}
              </span>
              <span className="text-[11px] text-[var(--revint-text-3)]">
                {rowSource(row)}
              </span>
              <span className="min-w-0">
                <span className="font-mono text-xs text-[var(--revint-text-1)]">
                  {row.event}
                </span>
                {row.message && (
                  <span className="block truncate text-xs text-[var(--revint-text-2)]">
                    {row.message}
                  </span>
                )}
              </span>
              <span className="text-[11px] text-[var(--revint-text-3)] md:text-right tabular-nums">
                {relativeTime(row.createdAt)}
              </span>
            </button>
            {open && (
              <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-[var(--revint-hover)]/50 p-3 text-[11px] leading-relaxed text-[var(--revint-text-2)]">
                {JSON.stringify(
                  {
                    id: row.id,
                    createdAt: row.createdAt,
                    level: row.level,
                    source: row.source,
                    event: row.event,
                    message: row.message,
                    fields: row.fields,
                  },
                  null,
                  2,
                )}
              </pre>
            )}
          </div>
        );
      })}
    </div>
  );
}
