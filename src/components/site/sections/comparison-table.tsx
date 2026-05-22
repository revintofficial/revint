import { Check, Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ComparisonTable — monospace karşılaştırma matrix used on /vs/* pages.
 *
 * Each column is a competitor + us. Each row is a capability with a
 * status (`yes`, `partial`, `no`, or a custom text label like "$100K/yr").
 * The instrument-panel feel comes from the mono data labels + the signal
 * lamp on our column.
 */

type Status = "yes" | "partial" | "no" | string;

type ComparisonRow = {
  /** The capability or attribute the row measures. */
  capability: string;
  /** Same order as `columns`. Length must match. */
  values: Status[];
};

type ComparisonColumn = {
  /** e.g. "LeadAC", "Apollo", "Clay". */
  label: string;
  /** True on the LeadAC column to highlight with the signal lamp. */
  isUs?: boolean;
  /** Optional one-line sub-label, e.g. "from $1,500/mo". */
  subLabel?: string;
};

type ComparisonTableProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  columns: ComparisonColumn[];
  rows: ComparisonRow[];
  /** Source citations rendered under the table. */
  sources?: Array<{ name: string; url: string }>;
  className?: string;
};

function statusContent(value: Status, isUs: boolean) {
  if (value === "yes") {
    return (
      <Check className={cn("h-4 w-4", isUs ? "text-signal" : "text-paper-2")} />
    );
  }
  if (value === "no") {
    return <X className="h-4 w-4 text-paper-3" />;
  }
  if (value === "partial") {
    return <Minus className="h-4 w-4 text-paper-3" />;
  }
  return (
    <span
      className={cn(
        "site-mono text-[13px]",
        isUs ? "text-paper-0" : "text-paper-2",
      )}
    >
      {value}
    </span>
  );
}

export function ComparisonTable({
  eyebrow,
  title,
  subtitle,
  columns,
  rows,
  sources,
  className,
}: ComparisonTableProps) {
  return (
    <section className={cn("site-section", className)}>
      <div className="site-container">
        <div className="max-w-3xl">
          {eyebrow ? <div className="site-eyebrow mb-3">{eyebrow}</div> : null}
          <h2 className="text-[30px] leading-tight tracking-tight text-paper-0 md:text-[44px]">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-4 text-[18px] leading-relaxed text-paper-2">
              {subtitle}
            </p>
          ) : null}
        </div>

        <div className="mt-10 overflow-x-auto rounded-xl border border-ink-3">
          <table className="min-w-full divide-y divide-ink-3">
            <thead>
              <tr className="bg-ink-1">
                <th className="px-5 py-4 text-left text-[12px] uppercase tracking-wider text-paper-3">
                  Capability
                </th>
                {columns.map((c) => (
                  <th
                    key={c.label}
                    className={cn(
                      "px-5 py-4 text-left text-[13px] font-medium",
                      c.isUs ? "bg-ink-2 text-paper-0" : "text-paper-1",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {c.isUs ? <span className="site-signal-dot" /> : null}
                      <span>{c.label}</span>
                    </div>
                    {c.subLabel ? (
                      <div className="site-mono mt-1 text-[12px] text-paper-2">
                        {c.subLabel}
                      </div>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-3 bg-ink-0">
              {rows.map((row, i) => (
                <tr key={i}>
                  <td className="px-5 py-4 text-[14px] text-paper-1">
                    {row.capability}
                  </td>
                  {row.values.map((value, j) => (
                    <td
                      key={j}
                      className={cn(
                        "px-5 py-4",
                        columns[j].isUs && "bg-ink-1",
                      )}
                    >
                      {statusContent(value, !!columns[j].isUs)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sources && sources.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-paper-3">
            <span className="text-paper-2">Sources:</span>
            {sources.map((s) => (
              <a
                key={s.url}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="site-source"
              >
                {s.name}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
