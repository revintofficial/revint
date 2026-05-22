import { cn } from "@/lib/utils";
import type { Persona } from "@/content/site/personas";

/**
 * QuoteBlock — single persona quote with named source.
 *
 * Used on the homepage and vertical pages to ground the page in a real
 * voice (psych: Liking/Similarity + Mimetic desire). humanizer H6:
 * source must be a real person + a real link.
 */

type QuoteBlockProps = {
  persona: Persona;
  className?: string;
  variant?: "default" | "compact";
};

export function QuoteBlock({
  persona,
  className,
  variant = "default",
}: QuoteBlockProps) {
  return (
    <section
      className={cn(
        variant === "default" ? "site-section" : "py-12",
        className,
      )}
    >
      <div className="site-container">
        <div className="mx-auto max-w-3xl rounded-2xl border border-ink-3 bg-ink-1 p-8 md:p-12">
          <div className="site-mono text-[14px] uppercase tracking-wider text-signal">
            {persona.role}
          </div>
          <blockquote className="mt-5 text-[20px] leading-relaxed text-paper-0 md:text-[26px]">
            &ldquo;{persona.quote}&rdquo;
          </blockquote>
          <div className="mt-6 flex flex-col gap-2 text-[13px] text-paper-2 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-paper-0">{persona.name}</div>
              <div>{persona.contextLine}</div>
            </div>
            <a
              href={persona.source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="site-source"
            >
              {persona.source.name},{" "}
              {new Date(persona.source.date).getFullYear()}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
