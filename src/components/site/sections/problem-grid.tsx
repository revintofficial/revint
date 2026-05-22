import type { Pain } from "@/content/site/pains";
import { cn } from "@/lib/utils";

/**
 * ProblemGrid — pain cards sourced from `src/content/site/pains.ts`.
 *
 * Each card carries pain summary + verbatim quote + sourced citation
 * (humanizer H6). No "experts say" — every pain ships with a real link.
 */

type ProblemGridProps = {
  eyebrow?: string;
  title: string;
  /** One-paragraph framing above the grid. */
  intro?: string;
  pains: Pain[];
  className?: string;
};

export function ProblemGrid({
  eyebrow,
  title,
  intro,
  pains,
  className,
}: ProblemGridProps) {
  return (
    <section className={cn("site-section", className)}>
      <div className="site-container">
        <div className="max-w-3xl">
          {eyebrow ? <div className="site-eyebrow mb-3">{eyebrow}</div> : null}
          <h2 className="text-[30px] leading-tight tracking-tight text-paper-0 md:text-[44px]">
            {title}
          </h2>
          {intro ? (
            <p className="mt-4 text-[18px] leading-relaxed text-paper-2">
              {intro}
            </p>
          ) : null}
        </div>

        <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-ink-3 bg-ink-3 md:grid-cols-2 lg:grid-cols-3">
          {pains.map((p) => (
            <article key={p.id} className="bg-ink-1 p-6 md:p-7">
              <div className="site-mono text-[12px] uppercase tracking-wider text-signal">
                {p.id}
              </div>
              <p className="mt-3 text-[16px] leading-relaxed text-paper-0">
                {p.summary}
              </p>
              <blockquote className="mt-5 border-l-2 border-ink-3 pl-4 text-[14px] italic leading-relaxed text-paper-2">
                &ldquo;{p.quote}&rdquo;
              </blockquote>
              <a
                href={p.source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="site-source mt-4 inline-block"
              >
                {p.source.name}, {new Date(p.source.date).getFullYear()}
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
