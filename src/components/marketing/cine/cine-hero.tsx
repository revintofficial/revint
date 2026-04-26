"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Play,
  Sparkles,
  CheckCircle2,
  Rocket,
} from "lucide-react";

type CineHeroProps = {
  // Kept for interface stability — not used in the Voxr redesign,
  // which uses CSS glows instead of a scroll-scrub frame sequence.
  framesPath?: string;
  frameCount?: number;
  frameExt?: "jpg" | "webp";
  badge: string;
  tagline: string;
  headline: string;
  sub: string;
  ctaPrimary: { label: string; href: string };
  ctaSecondary?: { label: string; href: string };
  partners?: string[];
  partnersLabel?: string;
};

/**
 * Voxr-style hero. Dark stage with a single purple halo, floating glass
 * pill badges on the right, and a rounded "magic pill" primary CTA with
 * an inset circular arrow bubble. No frame-scrub; the visual weight comes
 * from the purple glow + pill composition, not a video sequence.
 */
// LCP source of truth. The hero H1 must be the Largest Contentful Paint
// element, not the background video. We render the gradient/glow backdrop
// synchronously and only attach the video source after first paint +
// IntersectionObserver unlock. Result: LCP pins to the headline, the video
// is a deferred enhancement.
const HERO_VIDEO_SRC = "https://u1core-dev.com/hero_section_4K_full.mp4";

export function CineHero({
  badge,
  tagline,
  headline,
  sub,
  ctaPrimary,
  ctaSecondary,
  partners,
  partnersLabel,
}: CineHeroProps) {
  const reduce = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);

  useEffect(() => {
    if (reduce) return;
    if (typeof window === "undefined") return;

    const saveData =
      (navigator as unknown as { connection?: { saveData?: boolean } })
        .connection?.saveData === true;
    if (saveData) return;

    let cancelled = false;
    const attach = () => {
      if (cancelled) return;
      setVideoSrc(HERO_VIDEO_SRC);
    };

    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void;
      setTimeout: typeof setTimeout;
      clearTimeout: typeof clearTimeout;
    };

    if (typeof w.requestIdleCallback === "function") {
      w.requestIdleCallback(attach, { timeout: 2500 });
      return () => {
        cancelled = true;
      };
    }

    const t = w.setTimeout(attach, 1200);
    return () => {
      cancelled = true;
      w.clearTimeout(t);
    };
  }, [reduce]);

  // Split the headline into two halves so the second half can take the
  // purple gradient treatment (Voxr: "Start Closing Them.").
  const words = headline.split(" ");
  const pivot = Math.max(1, Math.ceil(words.length / 2));
  const firstHalf = words.slice(0, pivot).join(" ");
  const secondHalf = words.slice(pivot).join(" ");

  return (
    <section
      aria-label="Hero"
      className="relative vx-dark-section vx-dotgrid vx-hero-glow overflow-hidden isolate"
    >
      {/* Background film. Deferred: source is attached after first paint so
          the <h1> wins LCP. mix-blend-lighten lets the dark hero base bleed
          through; on lg+ we let the video render straight. */}
      {/* Hue-rotate shifts the source video (purple ~270°) to the active
          brand hue (--leadac-h). Saturate compensates for muddiness that
          hue-rotate can introduce on already-saturated frames. The whole
          chain runs on the GPU; theme changes flow through with no JS. */}
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        preload="none"
        aria-hidden
        className="absolute bottom-0 left-0 w-full h-auto object-cover mix-blend-lighten lg:mix-blend-normal pointer-events-none z-0 opacity-90"
        style={{
          aspectRatio: "16/9",
          filter:
            "saturate(1.1) hue-rotate(calc(var(--leadac-h) * 1deg - 270deg))",
          maskImage:
            "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.35) 8%, black 22%, black 100%)",
          WebkitMaskImage:
            "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.35) 8%, black 22%, black 100%)",
        }}
      >
        {videoSrc && <source src={videoSrc} type="video/mp4" />}
      </video>

      {/* Readability scrim. Darker on the left where the headline lives,
          lighter on the right so the video's 3D scene still glows. */}
      <div
        aria-hidden
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, hsl(var(--leadac-h) 60% 5% / 0.75) 0%, hsl(var(--leadac-h) 60% 5% / 0.55) 35%, hsl(var(--leadac-h) 60% 5% / 0.25) 70%, hsl(var(--leadac-h) 60% 5% / 0.05) 100%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-40 z-[1] pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, hsl(var(--leadac-h) 60% 5% / 0.85) 0%, hsl(var(--leadac-h) 60% 5% / 0) 100%)",
        }}
      />

      {/* Accent arc at the ground plane */}
      <div className="vx-hero-arc" aria-hidden />

      <div
        className="relative z-10 mx-auto max-w-(--cine-max) pt-32 md:pt-40 pb-28 md:pb-36"
        style={{
          paddingLeft: "var(--cine-gutter)",
          paddingRight: "var(--cine-gutter)",
        }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-16 items-center">
          {/* LEFT: copy column */}
          <div className="flex flex-col items-start">
            <motion.div
              initial={reduce ? { opacity: 1 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full pl-1.5 pr-4 py-1.5 mb-8 text-[11.5px] text-white/80"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid hsl(var(--leadac-h) var(--leadac-s) 68% / 0.25)",
                backdropFilter: "blur(18px)",
                WebkitBackdropFilter: "blur(18px)",
              }}
            >
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  background:
                    "linear-gradient(135deg, var(--vx-purple-400), var(--vx-purple-600))",
                  color: "white",
                  boxShadow: "0 0 12px hsl(var(--leadac-h) var(--leadac-s) 60% / 0.5)",
                }}
              >
                <Sparkles className="w-2.5 h-2.5" />
                {badge}
              </span>
              <span className="text-white/70">{tagline}</span>
            </motion.div>

            <motion.h1
              initial={reduce ? { opacity: 1 } : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="vx-display text-[clamp(40px,6.8vw,100px)] leading-[0.98] text-white max-w-[20ch]"
            >
              {firstHalf}{" "}
              {secondHalf && <span className="vx-text-gradient">{secondHalf}</span>}
            </motion.h1>

            <motion.p
              initial={reduce ? { opacity: 1 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.6 }}
              className="mt-7 max-w-xl text-[15px] md:text-[16.5px] text-white/65 leading-relaxed"
            >
              {sub}
            </motion.p>

            <motion.div
              initial={reduce ? { opacity: 1 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.55 }}
              className="mt-10 flex items-center gap-3 flex-wrap"
            >
              <Link href={ctaPrimary.href} className="vx-magic-pill">
                {ctaPrimary.label}
                <span className="vx-arrow-bubble">
                  <ArrowRight className="w-4 h-4" />
                </span>
              </Link>
              {ctaSecondary && (
                <Link href={ctaSecondary.href} className="vx-pill-ghost">
                  <Play className="w-3.5 h-3.5 fill-current" />
                  {ctaSecondary.label}
                </Link>
              )}
            </motion.div>
          </div>

          {/* RIGHT: floating pill stack (Voxr's signature) + orbs */}
          <div className="relative flex flex-col items-start lg:items-end gap-4 min-h-[360px] lg:min-h-[520px]">
            <motion.div
              initial={reduce ? { opacity: 1 } : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.55, duration: 0.55 }}
              className="vx-pill-glass vx-float"
            >
              <span className="vx-pill-icon">
                <Sparkles className="w-3.5 h-3.5" />
              </span>
              Your on-demand SDR pod
            </motion.div>

            <motion.div
              initial={reduce ? { opacity: 1 } : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7, duration: 0.55 }}
              className="vx-pill-glass vx-float"
              style={{ animationDelay: "1.2s" }}
            >
              <span className="vx-pill-icon">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </span>
              47 audited leads in 5 minutes
            </motion.div>

            <motion.div
              initial={reduce ? { opacity: 1 } : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.85, duration: 0.55 }}
              className="vx-pill-glass vx-float"
              style={{ animationDelay: "2.4s" }}
            >
              <span className="vx-pill-icon">
                <Rocket className="w-3.5 h-3.5" />
              </span>
              4× reply lift with a mockup
            </motion.div>

            {/* Decorative orbs suggest the 3D scene without the asset */}
            <div
              aria-hidden
              className="vx-orb vx-float"
              style={{
                width: 140,
                height: 140,
                right: "12%",
                bottom: "10%",
                animationDelay: "0.4s",
              }}
            />
            <div
              aria-hidden
              className="vx-orb vx-float"
              style={{
                width: 64,
                height: 64,
                right: "48%",
                bottom: "22%",
                opacity: 0.7,
                animationDelay: "1.8s",
              }}
            />
            <div
              aria-hidden
              className="vx-orb vx-float"
              style={{
                width: 28,
                height: 28,
                right: "72%",
                bottom: "34%",
                opacity: 0.55,
                animationDelay: "0.8s",
              }}
            />
          </div>
        </div>

        {/* Partners strip */}
        {partners && partners.length > 0 && (
          <div className="mt-24 md:mt-28 flex flex-col items-center gap-6">
            {partnersLabel && (
              <span
                className="rounded-full px-4 py-1.5 text-[10.5px] uppercase tracking-[0.14em] font-semibold text-white/55"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {partnersLabel}
              </span>
            )}
            <div className="flex items-center gap-6 md:gap-14 flex-wrap justify-center">
              {partners.map((p) => (
                <span
                  key={p}
                  className="text-[15px] md:text-[17px] font-medium tracking-tight text-white/35 hover:text-white/70 transition-colors"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* SR-only description for assistive tech */}
      <p className="sr-only">
        Leadac AI scans Google Maps for local businesses, scores their
        websites, and drafts a personalised opener — all in five minutes.
      </p>
    </section>
  );
}
