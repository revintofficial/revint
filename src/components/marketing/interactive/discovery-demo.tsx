"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Search,
  MapPin,
  Sparkles,
  Loader2,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { LeadCardLive } from "./lead-card-live";
import type { DemoLead } from "./types";

interface DiscoveryDemoProps {
  cities: string[];
  niches: string[];
  leads: DemoLead[];
  defaultCity?: string;
  defaultNiche?: string;
  caption?: string;
  autoplayDelayMs?: number;
}

export function DiscoveryDemo({
  cities,
  niches,
  leads,
  defaultCity,
  defaultNiche,
  caption,
  autoplayDelayMs = 1400,
}: DiscoveryDemoProps) {
  const [city, setCity] = useState(defaultCity ?? cities[0]);
  const [niche, setNiche] = useState(defaultNiche ?? niches[0]);
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [visibleCount, setVisibleCount] = useState(0);
  const reduce = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const startedAutoplay = useRef(false);

  function run() {
    setPhase("running");
    setVisibleCount(0);
    setTimeout(() => {
      setPhase("done");
      let i = 0;
      const tick = () => {
        i += 1;
        setVisibleCount(i);
        if (i < leads.length) {
          setTimeout(tick, reduce ? 0 : 280);
        }
      };
      tick();
    }, reduce ? 0 : autoplayDelayMs);
  }

  // Autoplay once when scrolled into view
  useEffect(() => {
    if (!containerRef.current || startedAutoplay.current) return;
    const el = containerRef.current;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !startedAutoplay.current) {
            startedAutoplay.current = true;
            run();
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

  const visibleLeads = leads.slice(0, visibleCount);

  return (
    <div ref={containerRef} className="relative" style={{ perspective: "2400px" }}>
      <div
        aria-hidden
        className="absolute left-1/2 -translate-x-1/2 -top-20 w-[110%] h-[320px] -z-10 pointer-events-none blur-3xl opacity-60"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(167,139,250,0.28), rgba(94,106,210,0.18) 40%, transparent 70%)",
        }}
      />

      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          background:
            "linear-gradient(180deg, rgba(32,32,36,0.92) 0%, rgba(22,22,26,0.96) 50%, rgba(16,16,20,0.98) 100%)",
          border: "0.5px solid rgba(255,255,255,0.09)",
          boxShadow: [
            "0 1px 0 rgba(255,255,255,0.08) inset",
            "0 24px 60px rgba(0,0,0,0.55)",
            "0 60px 140px rgba(0,0,0,0.55)",
            "0 80px 200px rgba(49,46,129,0.3)",
          ].join(", "),
        }}
      >
        {/* Window chrome */}
        <div
          className="relative px-4 py-2.5 flex items-center gap-2"
          style={{
            borderBottom: "0.5px solid rgba(255,255,255,0.07)",
            background:
              "linear-gradient(180deg, rgba(44,44,48,0.75), rgba(30,30,34,0.55))",
          }}
        >
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
          </div>
          <div
            className="ml-3 flex-1 max-w-md mx-auto px-3 py-1 rounded text-[11px] text-white/40 truncate"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            app.leadengine.io / discover
          </div>
        </div>

        <div className="p-5 sm:p-6">
          {/* Form */}
          <div
            className="rounded-xl p-4 mb-4"
            style={{
              background: "rgba(255,255,255,0.025)",
              border: "0.5px solid rgba(255,255,255,0.07)",
            }}
          >
            <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
              <div>
                <label className="text-[10.5px] uppercase tracking-[0.12em] font-semibold text-white/45 mb-1.5 block">
                  <MapPin className="w-3 h-3 inline -mt-0.5 mr-1" />
                  City / postcode
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {cities.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setCity(c);
                        setPhase("idle");
                        setVisibleCount(0);
                      }}
                      className="px-2.5 py-1 rounded-md text-[11.5px] font-medium transition-all"
                      style={{
                        background:
                          c === city
                            ? "rgba(94,106,210,0.16)"
                            : "rgba(255,255,255,0.03)",
                        border:
                          c === city
                            ? "0.5px solid rgba(94,106,210,0.45)"
                            : "0.5px solid rgba(255,255,255,0.06)",
                        color: c === city ? "#C7CCFF" : "rgba(255,255,255,0.65)",
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10.5px] uppercase tracking-[0.12em] font-semibold text-white/45 mb-1.5 block">
                  <Search className="w-3 h-3 inline -mt-0.5 mr-1" />
                  Niche
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {niches.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        setNiche(n);
                        setPhase("idle");
                        setVisibleCount(0);
                      }}
                      className="px-2.5 py-1 rounded-md text-[11.5px] font-medium transition-all"
                      style={{
                        background:
                          n === niche
                            ? "rgba(94,106,210,0.16)"
                            : "rgba(255,255,255,0.03)",
                        border:
                          n === niche
                            ? "0.5px solid rgba(94,106,210,0.45)"
                            : "0.5px solid rgba(255,255,255,0.06)",
                        color: n === niche ? "#C7CCFF" : "rgba(255,255,255,0.65)",
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={run}
                disabled={phase === "running"}
                className="px-3.5 py-2 rounded-lg text-[12.5px] font-semibold text-white inline-flex items-center justify-center gap-1.5 disabled:opacity-70 disabled:cursor-not-allowed"
                style={{
                  background: "linear-gradient(180deg, #4F5BD6, #3730A3)",
                  boxShadow:
                    "0 1px 0 rgba(255,255,255,0.15) inset, 0 0 0 0.5px rgba(67,56,202,0.7), 0 6px 18px rgba(49,46,129,0.4)",
                }}
              >
                {phase === "running" ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Searching…
                  </>
                ) : (
                  <>
                    Run discovery
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Status row */}
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="text-[12px] text-white/55">
              <span className="text-white font-medium">{niche}</span>{" "}
              <span className="text-white/35">in</span>{" "}
              <span className="text-white font-medium">{city}</span>
            </div>
            <div className="text-[11.5px] text-white/40 tabular-nums flex items-center gap-1.5">
              {phase === "running" && (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Calling Google Places…
                </>
              )}
              {phase === "done" && (
                <>
                  <CheckCircle2 className="w-3 h-3 text-[#34D399]" />
                  {visibleCount} of {leads.length} loaded
                </>
              )}
              {phase === "idle" && (
                <span className="text-white/30">Press Run discovery</span>
              )}
            </div>
          </div>

          {/* Loading bar */}
          <AnimatePresence>
            {phase === "running" && !reduce && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-0.5 mb-3 rounded-full overflow-hidden"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background:
                      "linear-gradient(90deg, #5E6AD2, #8B5CF6, #5E6AD2)",
                    backgroundSize: "200% 100%",
                  }}
                  initial={{ width: "0%", backgroundPosition: "0% 0%" }}
                  animate={{
                    width: "100%",
                    backgroundPosition: "200% 0%",
                  }}
                  transition={{
                    duration: autoplayDelayMs / 1000,
                    ease: "linear",
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Leads list */}
          <div className="space-y-2 min-h-[280px]">
            {phase === "idle" && (
              <div
                className="rounded-xl p-8 text-center text-[12px] text-white/35"
                style={{
                  background: "rgba(255,255,255,0.015)",
                  border: "0.5px dashed rgba(255,255,255,0.08)",
                }}
              >
                <Sparkles className="w-5 h-5 mx-auto mb-2 text-white/25" />
                Pick a city and a niche, hit Run discovery.
                <br />
                Live leads from Google Maps in seconds.
              </div>
            )}
            <AnimatePresence>
              {visibleLeads.map((lead, i) => (
                <motion.div
                  key={lead.name}
                  initial={reduce ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 240,
                    damping: 28,
                    delay: i === visibleCount - 1 ? 0 : 0,
                  }}
                >
                  <LeadCardLive
                    lead={lead}
                    defaultExpanded={i === 0 && phase === "done" && visibleCount === leads.length}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {phase === "done" && visibleCount === leads.length && (
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-4 px-3 py-2.5 rounded-xl flex items-center gap-2"
              style={{
                background: "rgba(52, 211, 153, 0.07)",
                border: "0.5px solid rgba(52, 211, 153, 0.2)",
              }}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-[#34D399] shrink-0" />
              <p className="text-[11.5px] text-white/75">
                <span className="font-semibold text-white">Next step:</span>{" "}
                {caption ??
                  "Click any lead to see the full audit, then generate a custom mockup."}
              </p>
            </motion.div>
          )}
        </div>
      </div>

      {/* Floor reflection */}
      <div
        aria-hidden
        className="absolute left-1/2 -translate-x-1/2 -bottom-8 w-[88%] h-20 pointer-events-none -z-10 blur-2xl opacity-60"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(0,0,0,0.55), transparent 70%)",
        }}
      />
    </div>
  );
}
