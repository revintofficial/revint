"use client";

import { motion, useReducedMotion } from "framer-motion";
import { resolveCineIcon, type CineIconName } from "./icon-map";

export type CinePainPoint = {
  icon: CineIconName;
  title: string;
  body: string;
  /** Sourced quote (Reddit, forum, transcript). Optional — used for credibility. */
  source?: { quote: string; attribution: string };
};

type Props = {
  eyebrow: string;
  headline: string;
  sub?: string;
  points: CinePainPoint[];
};

/**
 * Voxr-style "what changed" pain section. Light section to match cine-why
 * but tinted card styling (vx-card-tinted) so the cards read as hot/urgent
 * rather than neutral feature cards. Three cards, each one a documented
 * shift in the 2025-2026 outbound landscape — recycled-list saturation,
 * AI-personalization collapse, and the manual-research throughput cap.
 *
 * Drops between Hero and CineFeatures: the user has just read the outcome
 * promise; this section is the operator agreeing on why that promise is
 * worth their time.
 */
export function CinePain({ eyebrow, headline, sub, points }: Props) {
  const reduce = useReducedMotion();

  const words = headline.split(" ");
  const firstPart = words.slice(0, -1).join(" ");
  const lastWord = words.at(-1) ?? "";

  return (
    <section
      id="pain"
      className="vx-light-section relative py-24 md:py-32"
    >
      <div
        className="max-w-(--cine-max) mx-auto"
        style={{
          paddingLeft: "var(--cine-gutter)",
          paddingRight: "var(--cine-gutter)",
        }}
      >
        <div className="flex flex-col items-center text-center gap-5 mb-14 md:mb-18 max-w-3xl mx-auto">
          <span className="vx-badge-light">{eyebrow}</span>
          <h2 className="vx-display text-[clamp(32px,5vw,56px)] leading-[1.04] text-[color:var(--vx-ink)] max-w-[22ch]">
            {firstPart}{" "}
            {lastWord && <span className="vx-text-gradient">{lastWord}</span>}
          </h2>
          {sub && (
            <p className="text-[15px] md:text-[16.5px] text-[color:var(--vx-ink-mute)] max-w-xl leading-relaxed">
              {sub}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {points.map((p, i) => {
            const Icon = resolveCineIcon(p.icon);
            return (
              <motion.div
                key={p.title}
                initial={reduce ? { opacity: 1 } : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{
                  duration: 0.55,
                  delay: reduce ? 0 : i * 0.1,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="vx-card-tinted p-7 md:p-8 flex flex-col gap-4 min-h-[280px]"
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{
                    background:
                      "linear-gradient(135deg, hsl(var(--leadac-h) var(--leadac-s) 78% / 0.18), hsl(var(--leadac-h) var(--leadac-s) 50% / 0.10))",
                    border:
                      "1px solid hsl(var(--leadac-h) var(--leadac-s) 50% / 0.22)",
                    color: "var(--vx-purple-700)",
                  }}
                  aria-hidden
                >
                  <Icon className="w-5 h-5" />
                </div>

                <div className="flex flex-col gap-2.5">
                  <h3 className="text-[17.5px] md:text-[19px] font-semibold tracking-[-0.01em] text-[color:var(--vx-ink)] leading-[1.2]">
                    {p.title}
                  </h3>
                  <p className="text-[13.5px] md:text-[14px] text-[color:var(--vx-ink-mute)] leading-relaxed">
                    {p.body}
                  </p>
                </div>

                {p.source && (
                  <figure
                    className="mt-auto pt-4 border-t"
                    style={{
                      borderColor: "var(--vx-rule, rgba(22,19,31,0.08))",
                    }}
                  >
                    <blockquote className="text-[12.5px] italic text-[color:var(--vx-ink-soft)] leading-snug">
                      &quot;{p.source.quote}&quot;
                    </blockquote>
                    <figcaption className="mt-1.5 text-[10.5px] uppercase tracking-[0.12em] text-[color:var(--vx-ink-mute)]">
                      {p.source.attribution}
                    </figcaption>
                  </figure>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
