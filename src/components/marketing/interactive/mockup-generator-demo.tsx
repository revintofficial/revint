"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Wand2,
  Loader2,
  RefreshCw,
  Phone,
  MapPin,
  ArrowRight,
  Star,
  Quote,
  Link as LinkIcon,
} from "lucide-react";
import type { DemoLead } from "./types";

interface MockupGeneratorDemoProps {
  lead: DemoLead;
  variants?: number;
}

// Three palettes mirror the three site directions Leadac drafts off the
// prospect's brand colour: warm/terracotta (food), cool sage (wellness /
// dental), and a saturated amber (hospitality / cafes). The bg1/bg2 pair
// is the page gradient; surface layers above it are derived from `text`
// at low alpha, which keeps the type-on-tinted-bg contrast readable.
const PALETTES = [
  { name: "Terracotta", primary: "#C25A3D", accent: "#F0B27A", text: "#FFF7EE", bg1: "#1B0F0B", bg2: "#341B12" },
  { name: "Sage", primary: "hsl(152 38% 48%)", accent: "hsl(152 28% 78%)", text: "#F0FAF5", bg1: "#0E1F19", bg2: "#1A2F26" },
  { name: "Amber", primary: "#E0A23A", accent: "#FFD27A", text: "#FFF8E8", bg1: "#1F1505", bg2: "#3A2710" },
];

export function MockupGeneratorDemo({
  lead,
  variants = 3,
}: MockupGeneratorDemoProps) {
  const reduce = useReducedMotion();
  const [variant, setVariant] = useState(0);
  const [phase, setPhase] = useState<"idle" | "generating" | "done">("idle");
  const containerRef = useRef<HTMLDivElement>(null);
  const startedAutoplay = useRef(false);
  const palette = PALETTES[variant % PALETTES.length];
  const services = lead.services ?? [
    "Online booking",
    "Mobile-first design",
    "Reviews integration",
  ];

  function regenerate(next?: number) {
    setPhase("generating");
    setTimeout(
      () => {
        setVariant((v) => (next !== undefined ? next : (v + 1) % variants));
        setPhase("done");
      },
      reduce ? 0 : 900
    );
  }

  useEffect(() => {
    if (!containerRef.current || startedAutoplay.current) return;
    const el = containerRef.current;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !startedAutoplay.current) {
            startedAutoplay.current = true;
            regenerate(0);
            io.disconnect();
          }
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background:
            "linear-gradient(180deg, rgba(32,32,36,0.92) 0%, rgba(22,22,26,0.96) 100%)",
          border: "0.5px solid rgba(255,255,255,0.09)",
          boxShadow:
            "0 24px 60px rgba(0,0,0,0.5), 0 80px 200px hsl(var(--leadac-h) var(--leadac-s) 42% / 0.25)",
        }}
      >
        {/* Top bar */}
        <div
          className="px-4 py-2.5 flex items-center justify-between gap-2"
          style={{
            borderBottom: "0.5px solid rgba(255,255,255,0.07)",
            background:
              "linear-gradient(180deg, rgba(44,44,48,0.75), rgba(30,30,34,0.55))",
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
              style={{
                background: "rgba(167,139,250,0.18)",
                border: "0.5px solid rgba(167,139,250,0.35)",
              }}
            >
              <Wand2 className="w-3 h-3 text-[hsl(var(--leadac-h) var(--leadac-s) 78%)]" />
            </div>
            <div className="min-w-0">
              <p className="text-[11.5px] font-medium text-white truncate">
                Mockup for {lead.name}
              </p>
              <p className="text-[10px] text-white/40 truncate font-mono">
                {palette.name.toLowerCase()} · variant {variant + 1}/{variants} · gemini 2.5 flash
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "0.5px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.55)",
              }}
            >
              <LinkIcon className="w-2.5 h-2.5" />
              leadac.ai/m/{lead.name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .slice(0, 18)}
            </span>
            <button
              type="button"
              onClick={() => regenerate()}
              disabled={phase === "generating"}
              className="px-2.5 py-1 rounded-md text-[11px] font-medium inline-flex items-center gap-1 disabled:opacity-60"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "0.5px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.85)",
              }}
            >
              {phase === "generating" ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              Regenerate
            </button>
          </div>
        </div>

        {/* Mockup viewport */}
        <div className="relative min-h-[340px] sm:min-h-[420px]">
          <AnimatePresence mode="wait">
            {phase === "generating" ? (
              <motion.div
                key="generating"
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                style={{
                  background:
                    "linear-gradient(180deg, hsl(var(--leadac-h) var(--leadac-ns) 8% / 0.95), rgba(16,16,20,0.98))",
                }}
              >
                <div className="relative w-12 h-12">
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background:
                        "conic-gradient(from 0deg, hsl(var(--leadac-h) var(--leadac-s) 50% / 0), hsl(var(--leadac-h) var(--leadac-s) 50% / 0.9))",
                    }}
                    animate={reduce ? {} : { rotate: 360 }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                  />
                  <div
                    className="absolute inset-1 rounded-full flex items-center justify-center"
                    style={{ background: "#16161A" }}
                  >
                    <Wand2 className="w-4 h-4 text-[hsl(var(--leadac-h) var(--leadac-s) 78%)]" />
                  </div>
                </div>
                <p className="text-[12px] text-white/55 font-medium">
                  Composing layout, hero, services, CTA…
                </p>
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-(--leadac-300)"
                      animate={
                        reduce
                          ? {}
                          : { opacity: [0.3, 1, 0.3], y: [0, -2, 0] }
                      }
                      transition={{
                        duration: 0.9,
                        repeat: Infinity,
                        delay: i * 0.15,
                      }}
                    />
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={`mockup-${variant}`}
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 220, damping: 28 }}
                className="absolute inset-0 overflow-hidden"
                style={{
                  background: `linear-gradient(180deg, ${palette.bg1}, ${palette.bg2})`,
                }}
              >
                {/* Mock site nav */}
                <div
                  className="px-5 sm:px-7 py-3 flex items-center justify-between"
                  style={{ borderBottom: `1px solid ${palette.text}0d` }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold"
                      style={{
                        background: palette.primary,
                        color: palette.text,
                        boxShadow: `0 4px 12px ${palette.primary}55`,
                      }}
                    >
                      {lead.name.charAt(0)}
                    </div>
                    <span
                      className="text-[12px] font-semibold tracking-tight"
                      style={{ color: palette.text, letterSpacing: "-0.01em" }}
                    >
                      {lead.name}
                    </span>
                  </div>
                  <div
                    className="flex items-center gap-4 text-[10px]"
                    style={{ color: `${palette.text}99` }}
                  >
                    <span>Menu</span>
                    <span>Reviews</span>
                    <span>Visit</span>
                    <button
                      className="px-2.5 py-1 rounded text-[10px] font-semibold"
                      style={{
                        background: palette.primary,
                        color: palette.text,
                      }}
                    >
                      Reserve
                    </button>
                  </div>
                </div>

                {/* Hero */}
                <div className="px-5 sm:px-7 pt-5 pb-4">
                  <div className="flex items-center gap-1.5 mb-3">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-semibold"
                      style={{
                        background: `${palette.accent}22`,
                        color: palette.accent,
                        border: `0.5px solid ${palette.accent}44`,
                      }}
                    >
                      <Star className="w-2.5 h-2.5 fill-current" />
                      {lead.rating.toFixed(1)} · {lead.reviewCount} Google reviews
                    </span>
                    {lead.niche && (
                      <span
                        className="text-[9.5px] font-medium px-2 py-0.5 rounded-full"
                        style={{
                          color: `${palette.text}aa`,
                          background: `${palette.text}08`,
                          border: `0.5px solid ${palette.text}10`,
                        }}
                      >
                        {lead.niche}
                      </span>
                    )}
                  </div>
                  <h3
                    className="text-[22px] sm:text-[28px] font-bold leading-[1.02] mb-2 tracking-tight"
                    style={{ color: palette.text, letterSpacing: "-0.025em" }}
                  >
                    {lead.name}
                  </h3>
                  <p
                    className="text-[12px] leading-relaxed mb-4 max-w-[36ch]"
                    style={{ color: `${palette.text}b5` }}
                  >
                    A {lead.rating.toFixed(1)}★ {lead.niche?.toLowerCase() ?? "neighbourhood favourite"} in {lead.city.split(",")[0]} —
                    with a site that finally loads as fast as the line outside.
                  </p>
                  <div className="flex items-center gap-2.5">
                    <button
                      className="px-3.5 py-1.5 rounded-md text-[11.5px] font-semibold inline-flex items-center gap-1.5"
                      style={{
                        background: palette.primary,
                        color: palette.text,
                        boxShadow: `0 8px 24px ${palette.primary}40`,
                      }}
                    >
                      Reserve a table
                      <ArrowRight className="w-3 h-3" />
                    </button>
                    <span
                      className="text-[10.5px]"
                      style={{ color: `${palette.text}88` }}
                    >
                      <Phone className="w-2.5 h-2.5 inline -mt-0.5 mr-1" />
                      {lead.phone}
                    </span>
                  </div>
                </div>

                {/* Review proof strip */}
                {lead.reviewQuote && (
                  <div
                    className="mx-5 sm:mx-7 mb-4 px-3.5 py-2.5 rounded-lg flex items-start gap-2.5"
                    style={{
                      background: `${palette.text}08`,
                      border: `0.5px solid ${palette.text}10`,
                    }}
                  >
                    <Quote
                      className="w-3 h-3 mt-0.5 shrink-0"
                      style={{ color: palette.accent }}
                    />
                    <p
                      className="text-[10.5px] italic leading-snug"
                      style={{ color: `${palette.text}c5` }}
                    >
                      &ldquo;{lead.reviewQuote}&rdquo;
                      <span
                        className="not-italic ml-1.5 text-[9.5px]"
                        style={{ color: `${palette.text}77` }}
                      >
                        — pulled from Google
                      </span>
                    </p>
                  </div>
                )}

                {/* Service cards */}
                <div className="px-5 sm:px-7 pb-4 grid grid-cols-3 gap-2">
                  {services.slice(0, 3).map((s, i) => (
                    <div
                      key={s}
                      className="rounded-lg p-2.5"
                      style={{
                        background: `${palette.text}0a`,
                        border: `0.5px solid ${palette.text}14`,
                      }}
                    >
                      <div
                        className="w-5 h-5 rounded-md flex items-center justify-center mb-1.5 text-[10px] font-bold tabular-nums"
                        style={{
                          background: `${palette.accent}22`,
                          color: palette.accent,
                          border: `0.5px solid ${palette.accent}33`,
                        }}
                      >
                        0{i + 1}
                      </div>
                      <p
                        className="text-[10.5px] font-semibold leading-tight"
                        style={{ color: palette.text, letterSpacing: "-0.005em" }}
                      >
                        {s}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Address strip */}
                <div
                  className="mx-5 sm:mx-7 mb-5 px-3 py-2 rounded-md flex items-center gap-2 text-[10px]"
                  style={{
                    background: `${palette.text}08`,
                    color: `${palette.text}aa`,
                    border: `0.5px solid ${palette.text}10`,
                  }}
                >
                  <MapPin className="w-3 h-3" />
                  {lead.city}
                  <span className="ml-auto" style={{ color: `${palette.text}66` }}>
                    Open today · 11am–10pm
                  </span>
                </div>

                {/* Variant chips */}
                <div className="absolute bottom-3 right-3 flex gap-1.5">
                  {Array.from({ length: variants }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => regenerate(i)}
                      className="w-2 h-2 rounded-full transition-all"
                      style={{
                        background:
                          i === variant
                            ? palette.accent
                            : `${palette.text}33`,
                        transform: i === variant ? "scale(1.3)" : "scale(1)",
                      }}
                      aria-label={`Variant ${i + 1}`}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
