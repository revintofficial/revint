import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Hero — top-of-page surface.
 *
 * Layout: eyebrow / headline / subhead / CTA pair / optional psych-anchor
 * strip. The anchor strip is the slot for "$100K/yr Gong" or "$29K/yr
 * Apollo+Clay+Gong+Smartlead stack" — the number that the headline
 * out-frames (Anchoring + Contrast psych model).
 *
 * brand-assets §3.3 12-word test: the headline must be ≤12 words and
 * pass who/what/why-us across the cluster.
 */

type HeroProps = {
  eyebrow?: string;
  /** ≤12 word headline. Sentence case (humanizer H8). */
  headline: string;
  /** 1–2 sentences. Says something new. */
  subhead: string;
  primaryCta: { href: string; label: string };
  secondaryCta?: { href: string; label: string };
  /** Anchor number rendered above the headline, e.g. "$100K/yr Gong → $1.5K/mo LeadAC". */
  anchor?: {
    label: string;
    /** Verb-style note next to the data, e.g. "starts at" or "compared with". */
    note?: string;
  };
  /** Optional right column slot — pre-call brief preview, sample card, diagram. */
  visual?: React.ReactNode;
  className?: string;
};

export function Hero({
  eyebrow,
  headline,
  subhead,
  primaryCta,
  secondaryCta,
  anchor,
  visual,
  className,
}: HeroProps) {
  return (
    <section
      className={cn(
        "site-section pt-24 md:pt-32",
        visual ? "lg:pt-32" : "lg:pt-40",
        className,
      )}
    >
      <div className="site-container">
        <div
          className={cn(
            "grid items-start gap-12",
            visual ? "lg:grid-cols-2 lg:gap-16" : "max-w-3xl",
          )}
        >
          <div className="site-blur-up">
            {anchor ? (
              <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-ink-3 bg-ink-1 px-4 py-1.5">
                <span className="site-signal-dot" />
                <span className="text-[13px] text-paper-2">
                  {anchor.note ? `${anchor.note} ` : null}
                  <span className="site-mono text-paper-0">{anchor.label}</span>
                </span>
              </div>
            ) : null}
            {eyebrow ? (
              <div className="site-eyebrow mb-4">{eyebrow}</div>
            ) : null}
            <h1 className="text-[40px] leading-[1.05] tracking-[-0.02em] text-paper-0 sm:text-[56px] md:text-[64px]">
              {headline}
            </h1>
            <p className="mt-6 max-w-2xl text-[18px] leading-relaxed text-paper-2 md:text-[22px]">
              {subhead}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href={primaryCta.href}
                className="site-btn-primary"
                data-cta={`hero-primary:${primaryCta.label}`}
              >
                {primaryCta.label}
              </Link>
              {secondaryCta ? (
                <Link
                  href={secondaryCta.href}
                  className="site-btn-secondary"
                  data-cta={`hero-secondary:${secondaryCta.label}`}
                >
                  {secondaryCta.label}
                </Link>
              ) : null}
            </div>
          </div>
          {visual ? <div className="site-blur-up">{visual}</div> : null}
        </div>
      </div>
    </section>
  );
}
