import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string | number;
  hint?: string;
  className?: string;
}

export function KpiCard({ label, value, hint, className }: KpiCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--leadac-border)] bg-[var(--leadac-card)] p-4",
        className,
      )}
    >
      <div className="text-xs uppercase tracking-wider text-[var(--leadac-text-3)]">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-[var(--leadac-text-1)] tabular-nums">
        {value}
      </div>
      {hint && (
        <div className="mt-1 text-xs text-[var(--leadac-text-3)]">{hint}</div>
      )}
    </div>
  );
}
