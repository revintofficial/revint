import Link from "next/link";
import { cn } from "@/lib/utils";

const RANGES: Array<{ id: string; label: string }> = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
  { id: "90d", label: "90d" },
];

export function RangePicker({
  current,
  basePath,
  preserve,
}: {
  current: string;
  basePath: string;
  preserve?: Record<string, string | undefined>;
}) {
  const search = new URLSearchParams();
  if (preserve) {
    for (const [k, v] of Object.entries(preserve)) {
      if (v !== undefined && k !== "range") search.set(k, v);
    }
  }
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-[var(--revint-border)] bg-[var(--revint-card)] p-1">
      {RANGES.map((r) => {
        const sp = new URLSearchParams(search);
        sp.set("range", r.id);
        const href = `${basePath}?${sp.toString()}`;
        const active = current === r.id;
        return (
          <Link
            key={r.id}
            href={href}
            className={cn(
              "px-3 py-1 rounded-md text-xs",
              active
                ? "bg-[var(--revint-hover)] text-[var(--revint-text-1)]"
                : "text-[var(--revint-text-2)] hover:text-[var(--revint-text-1)]",
            )}
          >
            {r.label}
          </Link>
        );
      })}
    </div>
  );
}

export function normaliseRange(v: string | string[] | undefined): "today" | "7d" | "30d" | "90d" {
  const s = Array.isArray(v) ? v[0] : v;
  if (s === "today" || s === "7d" || s === "30d" || s === "90d") return s;
  return "30d";
}
