import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * BeforeAfterTable — the contrast section.
 *
 * Psych: Status-quo bias break + Contrast effect (psych-map). The "Before"
 * column reads as the team's current reality; the "After" column reads as
 * what a working LeadAC team looks like. Each row pairs one fixed pain
 * with one shipped behaviour — no aspirational copy.
 *
 * Visual: two-column instrument panel. Before column muted (ink + paper-2),
 * After column lit (signal accent + paper-0). On mobile rows collapse to
 * a stacked pair with an arrow between them.
 */

type BeforeAfterRow = {
  before: string;
  after: string;
};

type BeforeAfterTableProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  rows: BeforeAfterRow[];
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
};

export function BeforeAfterTable({
  eyebrow,
  title,
  subtitle,
  rows,
  beforeLabel = "Before LeadAC",
  afterLabel = "After LeadAC",
  className,
}: BeforeAfterTableProps) {
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

        <div className="mt-10 overflow-hidden rounded-xl border border-ink-3">
          {/* Header */}
          <div
            className="grid items-stretch bg-ink-1"
            style={{ gridTemplateColumns: "1fr auto 1fr" }}
            role="row"
          >
            <div className="px-5 py-4 md:px-6 md:py-5">
              <div className="site-mono text-[11px] uppercase tracking-wider text-paper-3">
                {beforeLabel}
              </div>
            </div>
            <div aria-hidden className="w-px bg-ink-3" />
            <div className="px-5 py-4 md:px-6 md:py-5">
              <div className="flex items-center gap-2">
                <span className="site-signal-dot" />
                <div className="site-mono text-[11px] uppercase tracking-wider text-signal">
                  {afterLabel}
                </div>
              </div>
            </div>
          </div>

          {/* Rows */}
          <ul role="rowgroup" className="divide-y divide-ink-3">
            {rows.map((r, i) => (
              <li
                key={i}
                role="row"
                className="grid items-center bg-ink-0"
                style={{ gridTemplateColumns: "1fr auto 1fr" }}
              >
                <div
                  role="cell"
                  className="px-5 py-5 text-[14px] leading-snug text-paper-2 md:px-6 md:py-6 md:text-[15px]"
                >
                  {r.before}
                </div>
                <div
                  aria-hidden
                  className="flex h-full w-px items-center justify-center bg-ink-3"
                >
                  <span className="-mx-3 flex h-7 w-7 items-center justify-center rounded-full border border-ink-3 bg-ink-1">
                    <ArrowRight className="h-3.5 w-3.5 text-signal" />
                  </span>
                </div>
                <div
                  role="cell"
                  className="bg-ink-1 px-5 py-5 text-[14px] leading-snug text-paper-0 md:px-6 md:py-6 md:text-[15px]"
                >
                  {r.after}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
