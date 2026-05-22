import { cn } from "@/lib/utils";

/**
 * ProofRow — 3–5 monospace data cells under the hero.
 *
 * Style guide §1 humanizer note: cells must carry a specific number with a
 * specific unit. No "trusted by" stripes — those are forbidden because
 * they generalise instead of cite.
 */

type ProofCell = {
  /** The specific, dated number, e.g. "200 accounts" or "5.6 hrs/rep/week". */
  value: string;
  /** The label that explains what the number measures. */
  label: string;
  /** Optional inline source link. */
  source?: { name: string; url: string };
};

type ProofRowProps = {
  cells: ProofCell[];
  className?: string;
  variant?: "default" | "bare";
};

export function ProofRow({
  cells,
  className,
  variant = "default",
}: ProofRowProps) {
  if (cells.length < 3 || cells.length > 5) {
    // Render anyway in production; the dev console gets the warning so we
    // catch shape drift in PR review.
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `<ProofRow /> expected 3–5 cells; received ${cells.length}.`,
      );
    }
  }

  return (
    <section
      className={cn(
        variant === "bare" ? "py-8" : "site-section py-16",
        className,
      )}
    >
      <div className="site-container">
        <div
          className={cn(
            "grid gap-px overflow-hidden rounded-xl border border-ink-3 bg-ink-3",
            cells.length === 3 && "md:grid-cols-3",
            cells.length === 4 && "md:grid-cols-2 lg:grid-cols-4",
            cells.length === 5 && "md:grid-cols-2 lg:grid-cols-5",
          )}
        >
          {cells.map((c, i) => (
            <div
              key={`${c.label}-${i}`}
              className="bg-ink-1 p-6"
            >
              <div className="site-mono text-[24px] text-paper-0 md:text-[30px]">
                {c.value}
              </div>
              <div className="mt-2 text-[13px] text-paper-2">{c.label}</div>
              {c.source ? (
                <a
                  href={c.source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="site-source mt-2 inline-block"
                >
                  {c.source.name}
                </a>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
