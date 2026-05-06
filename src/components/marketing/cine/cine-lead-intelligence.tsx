"use client";

import { motion, useReducedMotion } from "framer-motion";
import { resolveCineIcon, type CineIconName } from "./icon-map";

export type CineIntelligenceFeature = {
  icon: CineIconName;
  title: string;
  body: string;
};

type Props = {
  eyebrow: string;
  headline: string;
  sub?: string;
  features: CineIntelligenceFeature[];
};

/**
 * Replaces the old dual-panel "Brain" section (Copilot tools + Memory
 * kinds) with a single clean 5-card grid. Same dark soft-section
 * styling so the page rhythm (light → dark → light → dark) still works,
 * but the message is no longer "compounding intelligence" / "memory
 * loop" — it's a concrete list of what runs server-side per prospect.
 *
 * Sits below pricing on the homepage (buried, per the web-overhaul plan
 * Phase B). The first-time-visitor doesn't need to read this; the
 * prospect who scrolled past pricing into "what's actually inside" does.
 */
export function CineLeadIntelligence({
  eyebrow,
  headline,
  sub,
  features,
}: Props) {
  const reduce = useReducedMotion();

  const words = headline.split(" ");
  const firstPart = words.slice(0, -1).join(" ");
  const lastWord = words.at(-1) ?? "";

  return (
    <section
      id="intelligence"
      className="vx-dark-section-soft relative py-24 md:py-32 overflow-hidden"
    >
      <div
        className="relative z-10 max-w-(--cine-max) mx-auto"
        style={{
          paddingLeft: "var(--cine-gutter)",
          paddingRight: "var(--cine-gutter)",
        }}
      >
        <div className="flex flex-col items-center text-center gap-5 mb-14 md:mb-18 max-w-3xl mx-auto">
          <span
            className="rounded-full px-4 py-1.5 text-[11.5px] font-medium"
            style={{
              background: "rgba(255,255,255,0.04)",
              border:
                "1px solid hsl(var(--leadac-h) var(--leadac-s) 68% / 0.28)",
              color: "rgba(255,255,255,0.85)",
            }}
          >
            {eyebrow}
          </span>
          <h2 className="vx-display text-[clamp(32px,5vw,56px)] leading-[1.04] tracking-[-0.02em] text-white max-w-[20ch]">
            {firstPart}{" "}
            {lastWord && <span className="vx-text-gradient">{lastWord}</span>}
          </h2>
          {sub && (
            <p className="text-[15px] md:text-[16.5px] text-white/60 max-w-xl leading-relaxed">
              {sub}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => {
            const Icon = resolveCineIcon(f.icon);
            // Last card on a 5-item grid spans both columns at md to keep
            // the row balanced. Ignored above lg where 3 columns wrap cleanly.
            const isLastOnFiveCardOddRow =
              features.length === 5 && i === 4;
            return (
              <motion.div
                key={f.title}
                initial={reduce ? { opacity: 1 } : { opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{
                  duration: 0.55,
                  delay: reduce ? 0 : i * 0.07,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className={[
                  "rounded-2xl p-7 flex flex-col gap-4",
                  isLastOnFiveCardOddRow
                    ? "md:col-span-2 lg:col-span-1"
                    : "",
                ].join(" ")}
                style={{
                  background:
                    "linear-gradient(180deg, rgba(32,32,36,0.92), rgba(22,22,26,0.96))",
                  border: "0.5px solid rgba(255,255,255,0.08)",
                  boxShadow: "0 18px 48px rgba(0,0,0,0.40)",
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background:
                      "linear-gradient(135deg, hsl(var(--leadac-h) var(--leadac-s) 78% / 0.25), hsl(var(--leadac-h) var(--leadac-s) 50% / 0.15))",
                    border:
                      "1px solid hsl(var(--leadac-h) var(--leadac-s) 60% / 0.35)",
                    color: "var(--leadac-300)",
                  }}
                  aria-hidden
                >
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-[18px] md:text-[20px] font-semibold tracking-[-0.005em] text-white leading-[1.2]">
                  {f.title}
                </h3>
                <p className="text-[13.5px] text-white/60 leading-relaxed">
                  {f.body}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
