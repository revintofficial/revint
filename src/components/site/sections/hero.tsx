import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Hero — top-of-page surface.
 *
 * Two postures:
 *   - default       — left-aligned, two-column with optional `visual` slot.
 *                     Used on /integrations/hubspot and most legacy pages.
 *   - layout="center" — single column, centered, larger type, single CTA
 *                     emphasis. Apple/Clari posture. The homepage uses
 *                     this; the StackLayersDiagram lives in its own
 *                     section directly below.
 *
 * brand-assets §3.3 12-word test: the headline must stay tight and pass
 * who/what/why-us across the cluster.
 */

type HeroProps = {
  eyebrow?: string;
  /** Tight headline. Sentence case (humanizer H8). */
  headline: string;
  /** Optional second-line headline for two-beat openings. */
  headlineCoda?: string;
  /** 1–2 sentences. Says something new. */
  subhead: string;
  primaryCta: { href: string; label: string };
  secondaryCta?: { href: string; label: string };
  /** Anchor number rendered above the headline, e.g. "$100K/yr Gong → $1.5K/mo Revint". */
  anchor?: {
    label: string;
    /** Verb-style note next to the data, e.g. "starts at" or "compared with". */
    note?: string;
  };
  /** Optional right column slot — pre-call brief preview, sample card, diagram. */
  visual?: React.ReactNode;
  /**
   * Optional full-bleed background image for the centered layout. Rendered
   * behind the copy with a brand-indigo scrim + a cream fade at the bottom so
   * the hero reads as a dark band on the otherwise light page while the text
   * stays legible. Only honored when `layout="center"`.
   */
  backgroundImage?: string;
  /** Posture. Defaults to "split" for backward compatibility. */
  layout?: "split" | "center";
  className?: string;
};

export function Hero({
  eyebrow,
  headline,
  headlineCoda,
  subhead,
  primaryCta,
  secondaryCta,
  anchor,
  visual,
  backgroundImage,
  layout = "split",
  className,
}: HeroProps) {
  const isCentered = layout === "center";

  if (isCentered) {
    return (
      <section
        className={cn(
          "site-section relative overflow-hidden",
          backgroundImage
            ? "pt-0 pb-16 md:pb-24"
            : "pt-28 pb-16 md:pt-40 md:pb-24 lg:pt-48",
          className,
        )}
      >
        {backgroundImage ? (
          <div className="relative w-full">
            <Image
              src={backgroundImage}
              alt=""
              width={1024}
              height={390}
              priority
              sizes="100vw"
              className="h-auto w-full"
            />
            {/* Melt the bottom edge into the cream page below */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-[linear-gradient(to_bottom,transparent,hsl(42_46%_92%))] md:h-24" />
          </div>
        ) : (
          <div className="site-hero-bg" aria-hidden>
            <div className="site-hero-hairline" />
            <div className="site-hero-grid" />
            <div className="site-hero-glow" />
          </div>
        )}
        <div
          className={cn(
            "site-container relative z-10",
            backgroundImage && "pt-12 md:pt-16",
          )}
        >
          <div className="site-blur-up mx-auto flex max-w-3xl flex-col items-center text-center">
            {anchor ? (
              <div className="mb-7 inline-flex items-center gap-2.5 rounded-full border border-ink-3 bg-ink-1/80 px-3.5 py-1 backdrop-blur-sm">
                <span className="site-signal-dot" />
                <span className="text-[12.5px] text-paper-2">
                  {anchor.note ? `${anchor.note} ` : null}
                  <span className="site-mono text-paper-0">{anchor.label}</span>
                </span>
              </div>
            ) : null}
            {eyebrow ? (
              <div className="site-eyebrow mb-5">{eyebrow}</div>
            ) : null}
            <h1 className="text-[44px] font-light leading-[1.02] tracking-[-0.035em] text-paper-0 sm:text-[60px] md:text-[76px] lg:text-[88px]">
              {headline}
              {headlineCoda ? (
                <>
                  <br />
                  <span className="text-paper-2">{headlineCoda}</span>
                </>
              ) : null}
            </h1>
            <p className="mx-auto mt-7 max-w-2xl text-[17px] leading-relaxed text-paper-2 md:text-[20px] md:leading-[1.55]">
              {subhead}
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={primaryCta.href}
                className="site-btn-primary group"
                data-cta={`hero-primary:${primaryCta.label}`}
              >
                {primaryCta.label}
                <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
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
        </div>
      </section>
    );
  }

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
              {headlineCoda ? (
                <>
                  <br />
                  <span className="text-paper-2">{headlineCoda}</span>
                </>
              ) : null}
            </h1>
            <p className="mt-6 max-w-2xl text-[18px] leading-relaxed text-paper-2 md:text-[22px]">
              {subhead}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href={primaryCta.href}
                className="site-btn-primary group"
                data-cta={`hero-primary:${primaryCta.label}`}
              >
                {primaryCta.label}
                <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
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
