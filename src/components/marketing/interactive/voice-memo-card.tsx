"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Mic, Pause, Play } from "lucide-react";

interface VoiceMemoCardProps {
  /** Title of the memo. Defaults to a doorstep-flavored auto-name. */
  title?: string;
  /** Lead the memo is attached to. */
  attachedTo?: string;
  /** Auto-transcribed snippet. */
  transcript?: string;
  /** Duration label (e.g. "00:30"). */
  duration?: string;
  /** Number of waveform bars (default 38). */
  bars?: number;
}

/**
 * Apple Voice Memos - flavored card. Renders a CSS-only waveform from a
 * pseudo-random sample array (deterministic seed so SSR matches client),
 * an animated playhead that sweeps once when scrolled into view, and a
 * transcribed snippet attached to a lead. Honors `useReducedMotion`.
 */
export function VoiceMemoCard({
  title = "Camden, plumber - doorstep #4",
  attachedTo = "Camden Pipes Co.",
  transcript = "Owner liked the booking widget. Asked about Stripe. Said he'd decide by Friday. Wife runs the books, send the quote to her email.",
  duration = "00:30",
  bars = 38,
}: VoiceMemoCardProps) {
  const reduce = useReducedMotion();
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const samples = generateWaveform(bars);

  useEffect(() => {
    if (reduce) {
      setProgress(1);
      return;
    }
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !startedRef.current) {
            startedRef.current = true;
            setPlaying(true);
          }
        });
      },
      { threshold: 0.4 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [reduce]);

  useEffect(() => {
    if (!playing) return;
    const start = performance.now();
    const dur = 4200;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setPlaying(false);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing]);

  return (
    <div
      ref={ref}
      className="h-full w-full p-5 sm:p-6 flex flex-col"
      style={{
        background:
          "linear-gradient(180deg, rgba(20,20,24,1) 0%, rgba(14,14,18,1) 100%)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-[#C49AFF]">
          Voice Memos
        </p>
        <span className="text-[10.5px] text-white/40">Just now</span>
      </div>

      <h3 className="text-[15px] sm:text-[17px] font-semibold tracking-tight text-white/95 mb-3 leading-snug">
        {title}
      </h3>

      {/* Waveform */}
      <div
        className="rounded-2xl p-4 mb-3"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "0.5px solid rgba(255,255,255,0.07)",
        }}
      >
        <div className="flex items-end justify-between gap-[2px] h-12 mb-3">
          {samples.map((amp, i) => {
            const passed = i / bars <= progress;
            return (
              <span
                key={i}
                className="flex-1 rounded-full transition-colors"
                style={{
                  height: `${Math.max(8, amp * 100)}%`,
                  background: passed
                    ? "linear-gradient(180deg, #C49AFF, #8B5CF6)"
                    : "rgba(255,255,255,0.18)",
                }}
              />
            );
          })}
        </div>

        {/* Controls + time */}
        <div className="flex items-center justify-between text-[11px] text-white/55 tabular-nums">
          <button
            type="button"
            aria-label={playing ? "Pause memo" : "Play memo"}
            onClick={() => {
              if (reduce) return;
              if (progress >= 1) {
                setProgress(0);
                setPlaying(true);
              } else {
                setPlaying((p) => !p);
              }
            }}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
            style={{
              background: "rgba(139,92,246,0.18)",
              border: "0.5px solid rgba(139,92,246,0.4)",
              color: "#C49AFF",
            }}
          >
            {playing ? (
              <Pause className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5 translate-x-px" />
            )}
          </button>
          <motion.span
            initial={false}
            animate={{ opacity: progress > 0 ? 1 : 0.55 }}
          >
            {formatTime(progress, duration)} / {duration}
          </motion.span>
        </div>
      </div>

      {/* Transcript */}
      <div
        className="rounded-2xl p-4 mb-3 flex-1"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "0.5px solid rgba(255,255,255,0.07)",
        }}
      >
        <div className="flex items-center gap-1.5 mb-2">
          <Mic className="w-3 h-3 text-[#C49AFF]" />
          <span className="text-[10px] uppercase tracking-[0.12em] font-semibold text-white/55">
            Auto-transcribed
          </span>
        </div>
        <p className="text-[13px] text-white/80 leading-relaxed">
          &ldquo;{transcript}&rdquo;
        </p>
      </div>

      {/* Attached-to footer */}
      <div className="flex items-center justify-between text-[11.5px]">
        <span className="text-white/45">Attached to</span>
        <span
          className="px-2 py-0.5 rounded-md font-medium"
          style={{
            background: "rgba(139,92,246,0.14)",
            border: "0.5px solid rgba(139,92,246,0.3)",
            color: "#C49AFF",
          }}
        >
          {attachedTo}
        </span>
      </div>
    </div>
  );
}

function formatTime(progress: number, durationLabel: string) {
  const [m, s] = durationLabel.split(":").map((n) => parseInt(n, 10));
  const total = (m || 0) * 60 + (s || 0);
  const cur = Math.round(total * progress);
  const cm = Math.floor(cur / 60);
  const cs = cur % 60;
  return `${cm.toString().padStart(2, "0")}:${cs.toString().padStart(2, "0")}`;
}

/** Deterministic pseudo-random waveform so SSR matches CSR. */
function generateWaveform(n: number): number[] {
  const out: number[] = [];
  let seed = 7;
  for (let i = 0; i < n; i++) {
    seed = (seed * 9301 + 49297) % 233280;
    const r = seed / 233280;
    const env = Math.sin((i / n) * Math.PI) * 0.7 + 0.3;
    out.push(Math.min(1, Math.max(0.12, r * env)));
  }
  return out;
}
