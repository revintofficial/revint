"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, CheckCircle2, AlertCircle, Sparkles, Inbox } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";

/**
 * Notifications inbox — opens as a bottom sheet on phone, a centered modal on
 * tablet/desktop. Aggregates recent agent runs (succeeded/failed) plus
 * watchlist alerts and high-score lead arrivals.
 *
 * For the v1 we surface what already exists in the API:
 *   - GET /api/leads/processing-status — running/recent agent runs
 *   - (future) /api/notifications — once the backend lands
 *
 * If neither endpoint is available the sheet shows a clean empty state.
 */
type NotifKind = "success" | "error" | "info" | "highlight";

interface NotifItem {
  id: string;
  kind: NotifKind;
  title: string;
  body?: string;
  href?: string;
  /** ISO date or millis. */
  at?: string | number;
}

// Lucide icons accept className, strokeWidth, AND inline style — but typing
// the map as `ComponentType<{ className?: string }>` strips the `style` prop
// at the call site. Widen the type so the renderer below can colour-tint each
// icon via `style.color` without TypeScript flagging it.
const ICONS: Record<
  NotifKind,
  React.ComponentType<{
    className?: string;
    style?: React.CSSProperties;
    strokeWidth?: number;
  }>
> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Bell,
  highlight: Sparkles,
};

function formatRelative(at?: string | number): string {
  if (!at) return "";
  const ts = typeof at === "string" ? Date.parse(at) : at;
  if (!Number.isFinite(ts)) return "";
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h`;
  return `${Math.round(diff / 86_400_000)}d`;
}

async function fetchNotifications(): Promise<NotifItem[]> {
  // Best-effort fetch from existing endpoints. If they 404 we return empty.
  try {
    const res = await fetch("/api/leads/processing-status", {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      runs?: {
        id: string;
        status: string;
        kind: string;
        leadName?: string | null;
        leadId?: string | null;
        finishedAt?: string | null;
      }[];
    };
    const runs = json.runs ?? [];
    return runs.slice(0, 20).map<NotifItem>((r) => {
      const kind: NotifKind =
        r.status === "SUCCEEDED"
          ? "success"
          : r.status === "FAILED"
            ? "error"
            : "info";
      const title =
        r.status === "SUCCEEDED"
          ? `${humanize(r.kind)} finished`
          : r.status === "FAILED"
            ? `${humanize(r.kind)} failed`
            : `${humanize(r.kind)} running`;
      return {
        id: r.id,
        kind,
        title,
        body: r.leadName ?? undefined,
        href: r.leadId ? `/app/leads/${r.leadId}` : undefined,
        at: r.finishedAt ?? undefined,
      };
    });
  } catch {
    return [];
  }
}

function humanize(s: string): string {
  return s
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface NotificationsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationsSheet({ open, onOpenChange }: NotificationsSheetProps) {
  const [items, setItems] = React.useState<NotifItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setIsLoading(true);
    fetchNotifications()
      .then((result) => {
        if (!cancelled) setItems(result);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Notifications"
      description="Recent activity across your workspace."
      snap="mid"
      centered={false}
    >
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-14 rounded-xl skeleton-apple"
              aria-hidden="true"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-10 text-center gap-3"
          style={{ color: "var(--leadac-text-2)" }}
        >
          <Inbox className="w-10 h-10" style={{ color: "var(--leadac-muted)" }} />
          <p
            className="font-medium"
            style={{
              color: "var(--leadac-text-1)",
              fontSize: "var(--text-callout)",
            }}
          >
            You&apos;re all caught up
          </p>
          <p
            className="max-w-xs"
            style={{
              fontSize: "var(--text-footnote)",
            }}
          >
            New agent runs, watchlist alerts, and copilot mentions will appear here.
          </p>
        </div>
      ) : (
        <ul role="list" className="flex flex-col gap-1 -mx-2">
          {items.map((it) => {
            const Icon = ICONS[it.kind];
            const tone =
              it.kind === "success"
                ? "var(--leadac-success)"
                : it.kind === "error"
                  ? "var(--leadac-error)"
                  : it.kind === "highlight"
                    ? "var(--leadac-300)"
                    : "var(--leadac-text-2)";
            const Inner = (
              <div
                className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 active:bg-white/10 focus-visible:outline-2 focus-visible:outline-(--leadac-500)"
                style={{
                  minHeight: "var(--touch-target-min)",
                }}
              >
                <Icon className="w-5 h-5 shrink-0 mt-0.5" style={{ color: tone }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span
                      className="font-medium truncate"
                      style={{
                        color: "var(--leadac-text-1)",
                        fontSize: "var(--text-callout)",
                      }}
                    >
                      {it.title}
                    </span>
                    {it.at && (
                      <span
                        className="ml-auto shrink-0 text-[11px] tabular-nums"
                        style={{ color: "var(--leadac-text-3)" }}
                      >
                        {formatRelative(it.at)}
                      </span>
                    )}
                  </div>
                  {it.body && (
                    <p
                      className="truncate mt-0.5"
                      style={{
                        color: "var(--leadac-text-2)",
                        fontSize: "var(--text-footnote)",
                      }}
                    >
                      {it.body}
                    </p>
                  )}
                </div>
              </div>
            );
            return (
              <li key={it.id}>
                {it.href ? (
                  <Link
                    href={it.href}
                    onClick={() => onOpenChange(false)}
                    className="block"
                  >
                    {Inner}
                  </Link>
                ) : (
                  Inner
                )}
              </li>
            );
          })}
        </ul>
      )}
    </BottomSheet>
  );
}
