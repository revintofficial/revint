"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Check, Pause, Play, RotateCcw, Trophy } from "lucide-react";

const STEPS = [
  { key: "NEW", label: "New" },
  { key: "CONTACTED", label: "Contacted" },
  { key: "INTERESTED", label: "Interested" },
  { key: "MEETING", label: "Meeting" },
  { key: "WON", label: "Won" },
] as const;

const STEP_NOTES: Record<string, string> = {
  NEW: "Pulled from local-business index · 87 / 100",
  CONTACTED: "Opener sent via Smartlead · Mon 09:14",
  INTERESTED: "Replied: 'Send the mockup over' · Tue 16:42",
  MEETING: "Loom + 30-min discovery booked · Thu 11:00",
  WON: "$2,400 setup + $480/mo retainer · Fri 18:05",
};

interface PipelineBoardProps {
  intervalMs?: number;
  business?: string;
}

export function PipelineBoard({
  intervalMs = 2200,
  business = "Bella Vita Trattoria",
}: PipelineBoardProps) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) setInView(e.isIntersecting);
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!playing || !inView || reduce) return;
    const t = setTimeout(() => {
      setStep((s) => {
        if (s >= STEPS.length - 1) {
          setPlaying(false);
          return s;
        }
        return s + 1;
      });
    }, intervalMs);
    return () => clearTimeout(t);
  }, [step, playing, inView, intervalMs, reduce]);

  function reset() {
    setStep(0);
    setPlaying(true);
  }

  const won = step === STEPS.length - 1;

  return (
    <div
      ref={containerRef}
      className="rounded-2xl overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, rgba(32,32,36,0.92) 0%, rgba(22,22,26,0.96) 100%)",
        border: "0.5px solid rgba(255,255,255,0.09)",
        boxShadow:
          "0 24px 60px rgba(0,0,0,0.5), 0 80px 200px hsl(var(--leadac-h) var(--leadac-s) 42% / 0.25)",
      }}
    >
      <div
        className="px-4 py-2.5 flex items-center justify-between gap-2"
        style={{
          borderBottom: "0.5px solid rgba(255,255,255,0.07)",
          background:
            "linear-gradient(180deg, rgba(44,44,48,0.75), rgba(30,30,34,0.55))",
        }}
      >
        <div className="min-w-0">
          <p className="text-[11.5px] font-medium text-white truncate">
            {business}
          </p>
          <p className="text-[10px] text-white/40">Pipeline · auto-advancing</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="px-2 py-1 rounded-md text-[10.5px] font-medium inline-flex items-center gap-1 text-white/70"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "0.5px solid rgba(255,255,255,0.07)",
            }}
          >
            {playing ? (
              <>
                <Pause className="w-3 h-3" />
                Pause
              </>
            ) : (
              <>
                <Play className="w-3 h-3" />
                Play
              </>
            )}
          </button>
          <button
            type="button"
            onClick={reset}
            className="px-2 py-1 rounded-md text-[10.5px] font-medium inline-flex items-center gap-1 text-white/70"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "0.5px solid rgba(255,255,255,0.07)",
            }}
          >
            <RotateCcw className="w-3 h-3" />
            Replay
          </button>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <div className="flex items-center gap-1.5 mb-4 overflow-x-auto -mx-1 px-1">
          {STEPS.map((s, i) => {
            const completed = i < step;
            const current = i === step;
            const can = i <= step;
            return (
              <div key={s.key} className="flex items-center flex-1 last:flex-initial">
                <button
                  type="button"
                  onClick={() => setStep(i)}
                  className="flex items-center gap-1.5 rounded-full transition-all px-3 py-1.5 text-[11.5px] font-medium whitespace-nowrap"
                  style={{
                    background: completed
                      ? "hsl(152 48% 50% / 0.14)"
                      : current
                        ? "hsl(var(--leadac-h) var(--leadac-s) 50% / 0.18)"
                        : "rgba(255,255,255,0.04)",
                    color: completed
                      ? "hsl(152 48% 50%)"
                      : current
                        ? "var(--leadac-300)"
                        : "rgba(255,255,255,0.45)",
                    border: current
                      ? "0.5px solid hsl(var(--leadac-h) var(--leadac-s) 50% / 0.55)"
                      : "0.5px solid transparent",
                    boxShadow: current
                      ? "0 0 0 3px hsl(var(--leadac-h) var(--leadac-s) 50% / 0.12)"
                      : "none",
                  }}
                >
                  {completed ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <span
                      className="w-3 h-3 rounded-full inline-block"
                      style={{
                        border: `1.5px solid ${current ? "var(--leadac-300)" : "rgba(255,255,255,0.25)"}`,
                        background: current ? "hsl(var(--leadac-h) var(--leadac-s) 50%)" : "transparent",
                      }}
                    />
                  )}
                  <span>{s.label}</span>
                  <span className="sr-only">{can ? "active" : "locked"}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div
                    className="h-0.5 flex-1 mx-1 rounded-full overflow-hidden"
                    style={{ background: "rgba(255,255,255,0.07)" }}
                  >
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: "hsl(152 48% 50% / 0.55)" }}
                      initial={false}
                      animate={{ width: i < step ? "100%" : "0%" }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={STEPS[step].key}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 28 }}
            className="rounded-xl p-4"
            style={{
              background: "rgba(255,255,255,0.025)",
              border: "0.5px solid rgba(255,255,255,0.07)",
            }}
          >
            <p className="text-[10.5px] uppercase tracking-[0.12em] font-semibold text-(--leadac-300) mb-1.5">
              {STEPS[step].label}
            </p>
            <p className="text-[13px] text-white/85">
              {STEP_NOTES[STEPS[step].key]}
            </p>
            {won && (
              <motion.div
                initial={reduce ? false : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15, type: "spring", stiffness: 260, damping: 22 }}
                className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold"
                style={{
                  background: "hsl(152 48% 50% / 0.14)",
                  border: "0.5px solid hsl(152 48% 50% / 0.32)",
                  color: "hsl(152 48% 50%)",
                }}
              >
                <Trophy className="w-3 h-3" />
                Closed in 4 days
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
