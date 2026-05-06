"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, Quote } from "lucide-react";

export type CineCaseStudyMetric = {
  /** Big number / outcome (e.g. "12 cafes", "5 minutes", "75x"). */
  value: string;
  /** Short label under the number. */
  label: string;
};

export type CineCaseStudyBeat = {
  /** Section heading like "Before", "After", "What landed". */
  label: string;
  /** Body text — short, one or two sentences. */
  body: string;
};

type Props = {
  eyebrow: string;
  headline: string;
  /** Optional sub line under the headline. */
  sub?: string;
  /** "Anonymized" / "FineDine" / "F&B SaaS BD team". Renders inside customer-info card. */
  customerLabel: string;
  /** One-sentence customer setup. */
  customerSetup: string;
  /** Cohort beats — Before / After / What landed / What didn't. 3-5 items. */
  beats: CineCaseStudyBeat[];
  /** Top-line metrics — usually 2 or 3 cells. */
  metrics: CineCaseStudyMetric[];
  /** Footer disclosure (e.g. "Anonymized at customer request"). */
  disclosure?: string;
};

/**
 * Light-section case study card. Single customer, story-shape.
 *
 * Replaces the marquee testimonial component on the homepage. Reddit
 * pull-quotes worked when there was no real cohort to point at; now
 * there's the FineDine Camden cohort. The layout deliberately reads
 * like a cohort write-up rather than a testimonial — B2B agency
 * buyers respond to "here is what landed and here is what didn't"
 * better than "Sarah, growth marketer, said ⭐⭐⭐⭐⭐".
 */
export function CineCaseStudy({
  eyebrow,
  headline,
  sub,
  customerLabel,
  customerSetup,
  beats,
  metrics,
  disclosure,
}: Props) {
  const reduce = useReducedMotion();

  const words = headline.split(" ");
  const firstPart = words.slice(0, -1).join(" ");
  const lastWord = words.at(-1) ?? "";

  return (
    <section
      id="case-study"
      className="vx-light-section-alt relative py-24 md:py-32"
    >
      <div
        className="max-w-(--cine-max) mx-auto"
        style={{
          paddingLeft: "var(--cine-gutter)",
          paddingRight: "var(--cine-gutter)",
        }}
      >
        <div className="flex flex-col items-center text-center gap-5 mb-12 md:mb-16 max-w-3xl mx-auto">
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

        <motion.article
          initial={reduce ? { opacity: 1 } : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="vx-card p-7 md:p-10 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-8 lg:gap-10"
        >
          {/* Left: customer + beats */}
          <div className="flex flex-col gap-6">
            <header className="flex items-start gap-3">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background:
                    "linear-gradient(135deg, var(--vx-purple-400), var(--vx-purple-700))",
                  color: "white",
                  boxShadow:
                    "0 6px 18px hsl(var(--leadac-h) var(--leadac-s) 42% / 0.30)",
                }}
                aria-hidden
              >
                <Quote className="w-5 h-5" />
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <span className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-[color:var(--vx-purple-700)]">
                  Customer
                </span>
                <p className="text-[15px] font-semibold text-[color:var(--vx-ink)] leading-tight">
                  {customerLabel}
                </p>
                <p className="text-[12.5px] text-[color:var(--vx-ink-mute)] leading-snug">
                  {customerSetup}
                </p>
              </div>
            </header>

            <div className="flex flex-col gap-5">
              {beats.map((b) => (
                <div key={b.label} className="flex items-start gap-3">
                  <CheckCircle2
                    className="w-4 h-4 mt-1 shrink-0"
                    style={{ color: "var(--vx-purple-700)" }}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="text-[11.5px] uppercase tracking-[0.12em] font-semibold text-[color:var(--vx-ink-mute)] mb-0.5">
                      {b.label}
                    </p>
                    <p className="text-[14px] text-[color:var(--vx-ink)] leading-relaxed">
                      {b.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {disclosure && (
              <p
                className="text-[11.5px] italic text-[color:var(--vx-ink-mute)] leading-snug pt-4 border-t"
                style={{ borderColor: "var(--vx-rule, rgba(22,19,31,0.08))" }}
              >
                {disclosure}
              </p>
            )}
          </div>

          {/* Right: stacked metric cells */}
          <div className="flex flex-col gap-3">
            {metrics.map((m) => (
              <div
                key={m.label}
                className="rounded-2xl p-5 md:p-6 flex flex-col gap-1.5"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--leadac-h) var(--leadac-s) 78% / 0.10), hsl(var(--leadac-h) var(--leadac-s) 50% / 0.04))",
                  border:
                    "1px solid hsl(var(--leadac-h) var(--leadac-s) 50% / 0.18)",
                }}
              >
                <div
                  className="vx-display tabular-nums tracking-[-0.03em] text-[44px] md:text-[52px] leading-none"
                  style={{ color: "var(--vx-purple-700)" }}
                >
                  {m.value}
                </div>
                <p className="text-[12.5px] text-[color:var(--vx-ink-mute)] leading-snug max-w-[28ch]">
                  {m.label}
                </p>
              </div>
            ))}
          </div>
        </motion.article>
      </div>
    </section>
  );
}
