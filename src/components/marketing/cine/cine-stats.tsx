"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "framer-motion";

export type CineStat = {
  value: string;
  label: string;
};

type Props = {
  eyebrow?: string;
  stats: CineStat[];
  /** Kept for interface stability; unused in the Voxr light-theme stats band. */
  videoSrc?: string;
};

/**
 * Voxr-style stats band. Light background, four tinted cards with big
 * purple numerals. Numeric values count up on scroll into view.
 */
export function CineStats({ eyebrow, stats }: Props) {
  return (
    <section
      id="stats"
      className="vx-light-section-alt relative py-24 md:py-32"
    >
      <div
        className="max-w-(--cine-max) mx-auto"
        style={{
          paddingLeft: "var(--cine-gutter)",
          paddingRight: "var(--cine-gutter)",
        }}
      >
        {eyebrow && (
          <div className="flex justify-center mb-10 md:mb-14">
            <span className="vx-badge-light">{eyebrow}</span>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          {stats.map((s) => (
            <StatCell key={s.label} value={s.value} label={s.label} />
          ))}
        </div>
      </div>
    </section>
  );
}

function StatCell({ value, label }: { value: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (reduce) return;
    const match = value.match(/^(\d+(?:[.,]\d+)?)(.*)$/);
    if (!match || !inView) return;
    const target = parseFloat(match[1].replace(",", "."));
    const suffix = match[2];
    if (!Number.isFinite(target)) return;

    const duration = 1400;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const current = target * eased;
      const formatted =
        target >= 100
          ? Math.round(current).toString()
          : current.toFixed(target % 1 === 0 ? 0 : 1);
      setDisplay(formatted + suffix);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduce, value]);

  return (
    <div ref={ref} className="vx-card p-7 md:p-8 flex flex-col gap-2">
      <div
        className="vx-display tabular-nums tracking-[-0.03em] text-[56px] md:text-[68px] leading-none"
        style={{ color: "var(--vx-purple-700)" }}
      >
        {display}
      </div>
      <p className="mt-3 text-[13px] text-[color:var(--vx-ink-mute)] leading-snug max-w-[22ch]">
        {label}
      </p>
    </div>
  );
}
