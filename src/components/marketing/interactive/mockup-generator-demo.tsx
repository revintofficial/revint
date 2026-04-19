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
} from "lucide-react";
import type { DemoLead } from "./types";

interface MockupGeneratorDemoProps {
  lead: DemoLead;
  variants?: number;
}

const PALETTES = [
  { primary: "#5E6AD2", accent: "#A5B4FC", text: "#FFFFFF", bg1: "#0F1024", bg2: "#1B1D3A" },
  { primary: "#34D399", accent: "#86EFAC", text: "#04221A", bg1: "#0F2A21", bg2: "#173B30" },
  { primary: "#F59E0B", accent: "#FCD34D", text: "#1F1404", bg1: "#241704", bg2: "#3A2710" },
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
            "0 24px 60px rgba(0,0,0,0.5), 0 80px 200px rgba(49,46,129,0.25)",
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
              <Wand2 className="w-3 h-3 text-[#C4B5FD]" />
            </div>
            <div className="min-w-0">
              <p className="text-[11.5px] font-medium text-white truncate">
                Mockup for {lead.name}
              </p>
              <p className="text-[10px] text-white/40 truncate">
                Variant {variant + 1} of {variants} · Gemini 2.5 Flash
              </p>
            </div>
          </div>
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
                    "linear-gradient(180deg, rgba(20,20,22,0.95), rgba(16,16,20,0.98))",
                }}
              >
                <div className="relative w-12 h-12">
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background:
                        "conic-gradient(from 0deg, rgba(94,106,210,0), rgba(94,106,210,0.9))",
                    }}
                    animate={reduce ? {} : { rotate: 360 }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                  />
                  <div
                    className="absolute inset-1 rounded-full flex items-center justify-center"
                    style={{ background: "#16161A" }}
                  >
                    <Wand2 className="w-4 h-4 text-[#C4B5FD]" />
                  </div>
                </div>
                <p className="text-[12px] text-white/55 font-medium">
                  Composing layout, hero, services, CTA…
                </p>
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-[#A5B4FC]"
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
                <div className="px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded-md"
                      style={{
                        background: palette.primary,
                        boxShadow: `0 4px 12px ${palette.primary}55`,
                      }}
                    />
                    <span
                      className="text-[12px] font-semibold tracking-tight"
                      style={{ color: palette.text }}
                    >
                      {lead.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px]" style={{ color: `${palette.text}99` }}>
                    <span>Services</span>
                    <span>Reviews</span>
                    <span>Contact</span>
                    <button
                      className="px-2 py-1 rounded text-[10px] font-semibold"
                      style={{
                        background: palette.primary,
                        color: palette.text,
                      }}
                    >
                      Contact
                    </button>
                  </div>
                </div>

                {/* Hero */}
                <div className="px-5 sm:px-7 pt-4 pb-5">
                  <div
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium mb-3"
                    style={{
                      background: `${palette.accent}22`,
                      color: palette.accent,
                      border: `0.5px solid ${palette.accent}44`,
                    }}
                  >
                    <Star className="w-2.5 h-2.5 fill-current" />
                    {lead.rating.toFixed(1)} on Google · {lead.reviewCount} reviews
                  </div>
                  <h3
                    className="text-[20px] sm:text-[26px] font-bold leading-[1.05] mb-2 tracking-tight"
                    style={{ color: palette.text, letterSpacing: "-0.02em" }}
                  >
                    {lead.name}
                  </h3>
                  <p
                    className="text-[11.5px] leading-relaxed mb-3"
                    style={{ color: `${palette.text}aa` }}
                  >
                    {lead.rating.toFixed(1)}★ in {lead.city}, with a site that
                    finally matches the reviews.
                  </p>
                  <div className="flex items-center gap-2 mb-4">
                    <button
                      className="px-3 py-1.5 rounded text-[11px] font-semibold inline-flex items-center gap-1"
                      style={{
                        background: palette.primary,
                        color: palette.text,
                      }}
                    >
                      Get in touch
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

                {/* Service cards */}
                <div
                  className="px-5 sm:px-7 pb-4 grid grid-cols-3 gap-2"
                  style={{ borderTop: `1px solid ${palette.text}10` }}
                >
                  {services.slice(0, 3).map((s, i) => (
                    <div
                      key={s}
                      className="rounded-lg p-2.5"
                      style={{
                        background: `${palette.text}08`,
                        border: `0.5px solid ${palette.text}14`,
                        marginTop: 12,
                      }}
                    >
                      <div
                        className="w-5 h-5 rounded-md flex items-center justify-center mb-1.5"
                        style={{
                          background: `${palette.accent}22`,
                          color: palette.accent,
                        }}
                      >
                        {i + 1}
                      </div>
                      <p
                        className="text-[10px] font-semibold leading-tight"
                        style={{ color: palette.text }}
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
                  }}
                >
                  <MapPin className="w-3 h-3" />
                  {lead.city}
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
