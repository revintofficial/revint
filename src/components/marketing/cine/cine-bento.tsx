"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { resolveCineIcon, type CineIconName } from "./icon-map";

export type CineService = {
  icon: CineIconName;
  title: string;
  body: string;
  /**
   * Kept for interface stability with the old cine system, but ignored
   * in the Voxr redesign. Everything sits on a single purple accent.
   */
  accent?: string;
};

type Props = {
  eyebrow: string;
  headline: string;
  sub?: string;
  services: CineService[];
};

/**
 * Voxr-style feature grid, light theme. Three columns × two rows on
 * desktop, with the first card getting a soft lavender tint to anchor
 * the grid. Single purple accent across all icons.
 */
export function CineBento({ eyebrow, headline, sub, services }: Props) {
  const reduce = useReducedMotion();

  // Split the headline to apply the purple accent to the tail word(s).
  const words = headline.split(" ");
  const firstPart = words.slice(0, -1).join(" ");
  const lastWord = words.at(-1) ?? "";

  return (
    <section
      id="services"
      className="vx-light-section relative py-24 md:py-36"
    >
      <div
        className="max-w-(--cine-max) mx-auto"
        style={{
          paddingLeft: "var(--cine-gutter)",
          paddingRight: "var(--cine-gutter)",
        }}
      >
        <div className="flex flex-col items-center text-center gap-5 mb-14 md:mb-20 max-w-3xl mx-auto">
          <span className="vx-badge-light">{eyebrow}</span>
          <h2 className="vx-display text-[clamp(34px,5vw,64px)] leading-[1.02] text-[color:var(--vx-ink)] max-w-[22ch]">
            {firstPart}{" "}
            {lastWord && <span className="vx-text-gradient">{lastWord}</span>}
          </h2>
          {sub && (
            <p className="text-[15px] md:text-[16.5px] text-[color:var(--vx-ink-mute)] max-w-xl leading-relaxed">
              {sub}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {services.map((s, i) => (
            <motion.div
              key={s.title}
              initial={reduce ? { opacity: 1 } : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{
                duration: 0.55,
                delay: reduce ? 0 : i * 0.06,
                ease: [0.22, 1, 0.36, 1],
              }}
              className={
                i === 0
                  ? "vx-card-tinted p-7 md:p-8 flex flex-col gap-5 relative overflow-hidden lg:row-span-2 lg:min-h-[440px]"
                  : "vx-card p-7 md:p-8 flex flex-col gap-5 relative overflow-hidden"
              }
            >
              <BentoIcon name={s.icon} />
              <div>
                <h3 className="text-[18px] md:text-[20px] font-semibold tracking-[-0.01em] text-[color:var(--vx-ink)] mb-2">
                  {s.title}
                </h3>
                <p className="text-[14px] text-[color:var(--vx-ink-mute)] leading-relaxed">
                  {s.body}
                </p>
              </div>
              <ArrowUpRight
                className="absolute top-6 right-6 w-4 h-4 text-[color:var(--vx-purple-500)]/60"
                aria-hidden
              />
              {i === 0 && (
                <div className="mt-auto pt-4 flex items-center gap-2 text-[11.5px] font-medium text-[color:var(--vx-purple-700)] uppercase tracking-[0.12em]">
                  <span className="w-6 h-px bg-[color:var(--vx-purple-500)]" />
                  Start here
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BentoIcon({ name }: { name: CineIconName }) {
  const Icon = resolveCineIcon(name);
  return (
    <div
      className="w-12 h-12 rounded-2xl flex items-center justify-center"
      style={{
        background:
          "linear-gradient(135deg, hsl(var(--leadac-h) var(--leadac-s) 78% / 0.22), hsl(var(--leadac-h) var(--leadac-s) 50% / 0.12))",
        border: "1px solid hsl(var(--leadac-h) var(--leadac-s) 50% / 0.25)",
        color: "var(--vx-purple-700)",
      }}
    >
      <Icon className="w-5 h-5" />
    </div>
  );
}
