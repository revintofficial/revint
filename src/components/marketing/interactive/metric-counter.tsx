"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "framer-motion";

interface MetricCounterProps {
  value: number;
  label: string;
  prefix?: string;
  suffix?: string;
  duration?: number;
  accent?: string;
}

export function MetricCounter({
  value,
  label,
  prefix = "",
  suffix = "",
  duration = 1400,
  accent = "var(--leadac-300)",
}: MetricCounterProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const reduce = useReducedMotion();
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    if (reduce || !inView) return;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setAnimated(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration, reduce]);

  const display = reduce ? value : animated;

  return (
    <div
      ref={ref}
      className="p-6 rounded-2xl"
      style={{
        background:
          "linear-gradient(180deg, hsl(var(--leadac-h) var(--leadac-ns) 11% / 0.6), hsl(var(--leadac-h) var(--leadac-ns) 8% / 0.4))",
        border: "0.5px solid rgba(255,255,255,0.08)",
      }}
    >
      <div
        className="text-[44px] sm:text-[56px] font-semibold leading-none tracking-tight tabular-nums"
        style={{
          color: accent,
          letterSpacing: "-0.03em",
        }}
      >
        {prefix}
        {display.toLocaleString()}
        {suffix}
      </div>
      <p className="mt-3 text-[13px] text-white/55 leading-relaxed">{label}</p>
    </div>
  );
}
