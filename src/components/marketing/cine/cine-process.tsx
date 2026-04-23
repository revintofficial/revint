"use client";

import { motion, useReducedMotion } from "framer-motion";

export type CineStep = {
  n: string;
  title: string;
  body: string;
};

type Props = {
  eyebrow: string;
  headline: string;
  sub?: string;
  steps: CineStep[];
};

/**
 * Voxr-style process strip. Light section, four horizontal numbered
 * beats. Giant outlined purple numerals anchor each step, a faint
 * connector line threads between them on desktop.
 */
export function CineProcess({ eyebrow, headline, sub, steps }: Props) {
  const reduce = useReducedMotion();

  const words = headline.split(" ");
  const firstPart = words.slice(0, -1).join(" ");
  const lastWord = words.at(-1) ?? "";

  const gridColsClass =
    steps.length >= 5
      ? "md:grid-cols-2 lg:grid-cols-5"
      : steps.length === 3
      ? "md:grid-cols-3 lg:grid-cols-3"
      : "md:grid-cols-2 lg:grid-cols-4";

  return (
    <section id="how" className="vx-light-section relative py-24 md:py-36">
      <div
        className="max-w-(--cine-max) mx-auto"
        style={{
          paddingLeft: "var(--cine-gutter)",
          paddingRight: "var(--cine-gutter)",
        }}
      >
        <div className="flex flex-col items-center text-center gap-5 mb-16 md:mb-24 max-w-3xl mx-auto">
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

        <div
          className={`grid grid-cols-1 ${gridColsClass} gap-8 lg:gap-4 relative`}
          role="list"
        >
          {/* Desktop-only connector line spanning the row */}
          <div
            aria-hidden
            className="hidden lg:block absolute top-[56px] left-[6%] right-[6%] h-px"
            style={{
              background:
                "linear-gradient(to right, transparent, rgba(139, 92, 246, 0.35), transparent)",
            }}
          />

          {steps.map((step, i) => (
            <motion.div
              key={step.n}
              role="listitem"
              initial={reduce ? { opacity: 1 } : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{
                duration: 0.6,
                delay: reduce ? 0 : i * 0.09,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="relative px-2 md:px-4 flex flex-col items-start gap-4"
            >
              <div
                className="relative z-10 w-[72px] h-[72px] rounded-full flex items-center justify-center bg-white"
                style={{
                  border: "1px solid rgba(139, 92, 246, 0.25)",
                  boxShadow: "0 8px 28px rgba(124, 58, 237, 0.18)",
                }}
              >
                <span
                  className="vx-display text-[34px] leading-none"
                  style={{ color: "var(--vx-purple-700)" }}
                >
                  {step.n}
                </span>
              </div>
              <h3 className="text-[20px] md:text-[22px] font-semibold tracking-[-0.01em] text-[color:var(--vx-ink)]">
                {step.title}
              </h3>
              <p className="text-[14px] text-[color:var(--vx-ink-mute)] leading-relaxed max-w-[32ch]">
                {step.body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
