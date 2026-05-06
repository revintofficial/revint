"use client";

import { motion, useReducedMotion } from "framer-motion";

export type CineOnboardingMilestone = {
  /** Day label, e.g. "Day 1", "Week 2", "Month 1". */
  day: string;
  /** Short title for the milestone. */
  title: string;
  /** One-sentence description. */
  body: string;
};

type Props = {
  eyebrow: string;
  headline: string;
  sub?: string;
  milestones: CineOnboardingMilestone[];
};

/**
 * Onboarding timeline — "what week 4 looks like" answered as a visible
 * vertical-on-mobile / horizontal-on-desktop chain of milestones.
 *
 * Designed to slot into either the homepage (after pricing, before
 * CineLeadIntelligence) or the pricing page (above the FAQ). The
 * milestones array drives content; the rendering handles the timeline
 * line and dot rhythm.
 *
 * Tone rule: Each milestone is a concrete, observable thing the operator
 * can point at. "Day 14: first reply" — not "Day 14: gain confidence in
 * your pipeline." If we can't make the milestone observable, drop it.
 */
export function CineOnboarding({ eyebrow, headline, sub, milestones }: Props) {
  const reduce = useReducedMotion();

  const words = headline.split(" ");
  const firstPart = words.slice(0, -1).join(" ");
  const lastWord = words.at(-1) ?? "";

  return (
    <section
      id="onboarding"
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

        {/* Mobile: vertical stack with a left rail. Desktop: horizontal
            chain with a connecting line behind the dots. */}
        <div className="relative">
          {/* Desktop horizontal connector */}
          <div
            aria-hidden
            className="hidden md:block absolute left-0 right-0 top-[34px] h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, hsl(var(--leadac-h) var(--leadac-s) 50% / 0.30) 12%, hsl(var(--leadac-h) var(--leadac-s) 50% / 0.30) 88%, transparent 100%)",
            }}
          />

          <ol
            className={[
              "grid grid-cols-1 gap-8",
              "md:grid-cols-5 md:gap-4",
            ].join(" ")}
          >
            {milestones.map((m, i) => (
              <motion.li
                key={m.day}
                initial={reduce ? { opacity: 1 } : { opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{
                  duration: 0.5,
                  delay: reduce ? 0 : i * 0.1,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="relative flex md:flex-col items-start md:items-center gap-4 md:gap-3 md:text-center"
              >
                {/* Dot */}
                <div
                  className="relative w-[68px] h-[68px] rounded-full flex items-center justify-center shrink-0 z-10"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--vx-card), var(--vx-card-2, var(--vx-card)))",
                    border:
                      "1px solid hsl(var(--leadac-h) var(--leadac-s) 50% / 0.30)",
                    boxShadow:
                      "0 8px 22px hsl(var(--leadac-h) var(--leadac-s) 42% / 0.18)",
                  }}
                >
                  <span
                    className="text-[10.5px] uppercase tracking-[0.14em] font-semibold leading-none"
                    style={{ color: "var(--vx-purple-700)" }}
                  >
                    {m.day}
                  </span>
                </div>

                <div className="flex-1 md:flex-none md:max-w-[22ch]">
                  <h3 className="text-[15.5px] md:text-[16px] font-semibold tracking-[-0.005em] text-[color:var(--vx-ink)] leading-[1.25] mb-1.5">
                    {m.title}
                  </h3>
                  <p className="text-[12.5px] md:text-[13px] text-[color:var(--vx-ink-mute)] leading-relaxed">
                    {m.body}
                  </p>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
