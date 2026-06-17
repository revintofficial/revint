import { cn } from "@/lib/utils";

/**
 * Lightweight horizontal bar list — used everywhere we want to show
 * "top N of X" without the weight of a full chart. Each row renders
 * a label + a fill bar + a value. Pure server component (no recharts).
 */
export function BarList({
  rows,
  emptyLabel = "No data yet.",
  className,
}: {
  rows: Array<{
    key: string;
    label: React.ReactNode;
    value: number;
    hint?: React.ReactNode;
  }>;
  emptyLabel?: string;
  className?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="px-4 py-6 text-sm text-[var(--revint-text-3)] text-center">
        {emptyLabel}
      </div>
    );
  }
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className={cn("space-y-1.5", className)}>
      {rows.map((r) => {
        const pct = (r.value / max) * 100;
        return (
          <li key={r.key} className="text-xs">
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <span className="text-[var(--revint-text-1)] truncate min-w-0 flex-1">
                {r.label}
              </span>
              {r.hint && (
                <span className="text-[var(--revint-text-3)] shrink-0">
                  {r.hint}
                </span>
              )}
              <span className="tabular-nums text-[var(--revint-text-1)] shrink-0 w-14 text-right">
                {r.value.toLocaleString("en-US")}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--revint-hover)] overflow-hidden">
              <div
                className="h-full bg-[var(--revint-500)]/70"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
