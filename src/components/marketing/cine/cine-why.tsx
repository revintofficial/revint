"use client";

import { motion, useReducedMotion } from "framer-motion";
import { resolveCineIcon, type CineIconName } from "./icon-map";

export type CineReason = {
  icon: CineIconName;
  title: string;
  body: string;
};

type Props = {
  eyebrow: string;
  headline: string;
  sub?: string;
  reasons: CineReason[];
};

/**
 * Voxr-style "why bother" grid. Light section, four reason cards in a
 * single row on desktop. Icon sits inside a lavender square tile, the
 * rest is clean typography.
 */
export function CineWhy({ eyebrow, headline, sub, reasons }: Props) {
  const reduce = useReducedMotion();

  const words = headline.split(" ");
  const firstPart = words.slice(0, -1).join(" ");
  const lastWord = words.at(-1) ?? "";

  return (
    <section
      id="why"
      className="vx-light-section-alt relative py-24 md:py-36"
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
          <h2 className="vx-display text-[clamp(32px,5vw,60px)] leading-[1.02] text-[color:var(--vx-ink)] max-w-[18ch]">
            {firstPart}{" "}
            {lastWord && <span className="vx-text-gradient">{lastWord}</span>}
          </h2>
          {sub && (
            <p className="text-[15px] md:text-[16.5px] text-[color:var(--vx-ink-mute)] max-w-xl leading-relaxed">
              {sub}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {reasons.map((r, i) => {
            const Icon = resolveCineIcon(r.icon);
            return (
              <motion.div
                key={r.title}
                initial={reduce ? { opacity: 1 } : { opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{
                  duration: 0.55,
                  delay: reduce ? 0 : i * 0.08,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="vx-card p-7 flex flex-col gap-5 min-h-[240px]"
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{
                    background: "rgba(139, 92, 246, 0.10)",
                    border: "1px solid rgba(139, 92, 246, 0.18)",
                    color: "var(--vx-purple-700)",
                  }}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[17px] font-semibold tracking-[-0.005em] text-[color:var(--vx-ink)] mb-2">
                    {r.title}
                  </h3>
                  <p className="text-[13.5px] text-[color:var(--vx-ink-mute)] leading-relaxed">
                    {r.body}
                  </p>
                </div>
                <div className="mt-auto h-px w-10 bg-gradient-to-r from-[color:var(--vx-purple-500)] to-transparent" />
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
