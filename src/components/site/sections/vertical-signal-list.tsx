import { cn } from "@/lib/utils";
import type { VerticalPack } from "@/content/site/verticals";

/**
 * VerticalSignalList — instrument-panel data row of the public signals
 * we index for a given vertical pack.
 *
 * Used on /for/<vertical> pages. Each row carries the signal name +
 * the observable description in monospace.
 */

type VerticalSignalListProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  vertical: VerticalPack;
  className?: string;
};

export function VerticalSignalList({
  eyebrow,
  title,
  subtitle,
  vertical,
  className,
}: VerticalSignalListProps) {
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

        <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-ink-3 bg-ink-3 md:grid-cols-2">
          {vertical.signals.map((s, i) => (
            <div key={s.label} className="bg-ink-1 p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[16px] font-medium text-paper-0">
                  {s.label}
                </div>
                <div className="site-mono text-[12px] uppercase tracking-wider text-signal">
                  {String(i + 1).padStart(2, "0")}
                </div>
              </div>
              <p className="mt-3 text-[14px] leading-relaxed text-paper-2">
                {s.observable}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
