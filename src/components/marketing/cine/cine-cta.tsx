"use client";

import Link from "next/link";
import { ArrowRight, Rocket } from "lucide-react";

type Props = {
  headline: string;
  sub: string;
  /** Omit `href` for a non-navigating primary control (e.g. launching soon). */
  primary: { label: string; href?: string };
  secondary?: { label: string; href: string };
  /** Kept for interface stability; the Voxr CTA uses a CSS purple halo instead. */
  videoSrc?: string;
  microCopy?: string;
};

/**
 * Voxr-style final beat. Dark stage bookends the light body; single
 * purple halo behind a pared-back headline and the magic-pill primary.
 */
export function CineCta({
  headline,
  sub,
  primary,
  secondary,
  microCopy,
}: Props) {
  const words = headline.split(" ");
  const firstPart = words.slice(0, -1).join(" ");
  const lastWord = words.at(-1) ?? "";

  return (
    <section
      id="cta"
      className="vx-dark-section vx-hero-glow vx-dotgrid relative min-h-[72vh] flex flex-col items-center justify-center overflow-hidden isolate"
    >
      <div className="vx-hero-arc" aria-hidden />

      <div
        className="relative z-10 w-full max-w-(--cine-max) mx-auto py-28 md:py-40 flex flex-col items-center text-center"
        style={{
          paddingLeft: "var(--cine-gutter)",
          paddingRight: "var(--cine-gutter)",
        }}
      >
        <h2 className="vx-display text-[clamp(42px,7.5vw,108px)] leading-[0.98] tracking-[-0.035em] max-w-[18ch] mx-auto text-white">
          {firstPart}{" "}
          {lastWord && <span className="vx-text-gradient">{lastWord}</span>}
        </h2>
        <p className="mt-8 text-[16px] md:text-[18px] text-white/70 max-w-xl leading-relaxed">
          {sub}
        </p>
        <div className="mt-10 flex items-center gap-3 flex-wrap justify-center">
          {primary.href ? (
            <Link href={primary.href} className="vx-magic-pill">
              {primary.label}
              <span className="vx-arrow-bubble">
                <ArrowRight className="w-4 h-4" />
              </span>
            </Link>
          ) : (
            <span className="vx-magic-pill opacity-[0.92] cursor-default" role="status">
              {primary.label}
              <span className="vx-arrow-bubble">
                <Rocket className="w-4 h-4" />
              </span>
            </span>
          )}
          {secondary && (
            <Link href={secondary.href} className="vx-pill-ghost">
              {secondary.label}
            </Link>
          )}
        </div>
        {microCopy && (
          <p className="mt-6 text-[12px] text-white/40">{microCopy}</p>
        )}
      </div>
    </section>
  );
}
