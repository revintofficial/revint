import { cn } from "@/lib/utils";

/**
 * ManifestoBlock — long-form prose block.
 *
 * Used by /manifesto and the long-form prose section on /about. Renders
 * paragraphs with the brand-assets §1.4 external manifesto cadence.
 */

type ManifestoBlockProps = {
  eyebrow?: string;
  title?: string;
  paragraphs: string[];
  /** Optional pull quote between paragraphs. */
  pullQuote?: { quote: string; attribution?: string };
  className?: string;
};

export function ManifestoBlock({
  eyebrow,
  title,
  paragraphs,
  pullQuote,
  className,
}: ManifestoBlockProps) {
  // Insert the pull quote roughly halfway through.
  const mid = pullQuote ? Math.floor(paragraphs.length / 2) : -1;

  return (
    <section className={cn("site-section", className)}>
      <div className="site-container">
        <div className="mx-auto max-w-3xl">
          {eyebrow ? <div className="site-eyebrow mb-3">{eyebrow}</div> : null}
          {title ? (
            <h2 className="text-[30px] leading-tight tracking-tight text-paper-0 md:text-[44px]">
              {title}
            </h2>
          ) : null}
          <div className="mt-8 grid gap-6">
            {paragraphs.map((p, i) => (
              <div key={i}>
                <p className="text-[18px] leading-[1.7] text-paper-1 md:text-[19px]">
                  {p}
                </p>
                {i === mid && pullQuote ? (
                  <figure className="my-10 border-l-2 border-signal pl-6">
                    <blockquote className="text-[22px] leading-snug text-paper-0 md:text-[28px]">
                      &ldquo;{pullQuote.quote}&rdquo;
                    </blockquote>
                    {pullQuote.attribution ? (
                      <figcaption className="mt-3 text-[13px] text-paper-2">
                        {pullQuote.attribution}
                      </figcaption>
                    ) : null}
                  </figure>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
