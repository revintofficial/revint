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
  Globe,
  ShieldCheck,
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
  // Watchdog: guarantees we leave the "running" state even if the page was
  // backgrounded during the setTimeout or the component remounted mid-transition.
  // Without this the production build sometimes sat on "Calling Google Places…"
  // indefinitely because IntersectionObserver fired but the subsequent timer
  // didn't deliver its state update before the sticky ScrollStage re-laid-out.
  const runTokenRef = useRef(0);

  function run() {
    const token = ++runTokenRef.current;
    setPhase("running");
    setVisibleCount(0);
    const delay = reduce ? 0 : autoplayDelayMs;
    setTimeout(() => {
      // Only advance if no other run() was started in the meantime
      if (runTokenRef.current !== token) return;
      setPhase("done");
      let i = 0;
      const tick = () => {
        if (runTokenRef.current !== token) return;
        i += 1;
        setVisibleCount(i);
        if (i < leads.length) {
          setTimeout(tick, reduce ? 0 : 280);
        }
      };
      tick();
    }, delay);

    // Watchdog: if the normal timer didn't move us past "running", force-finish.
    const watchdogDelay = delay + 2000;
    setTimeout(() => {
      if (runTokenRef.current !== token) return;
      setPhase((current) => {
        if (current !== "running") return current;
        setVisibleCount(leads.length);
        return "done";
      });
    }, watchdogDelay);
  }

  // Autoplay once when scrolled into view. Falls back to a plain timer if the
  // IntersectionObserver never fires (which happens in production when the
  // demo mounts inside the sticky ScrollStage with pointer-events:none siblings
  // stacked on top — the element has a layout box but the observer's 40%
  // threshold is never satisfied on short viewports).
  useEffect(() => {
    if (!containerRef.current || startedAutoplay.current) return;
    const el = containerRef.current;

    const trigger = () => {
      if (startedAutoplay.current) return;
      startedAutoplay.current = true;
      run();
    };

    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              trigger();
              io?.disconnect();
            }
          }
        },
        // Looser threshold + rootMargin so tall demos inside a sticky
        // container still trip the observer on smaller viewports.
        { threshold: 0.1, rootMargin: "0px 0px -10% 0px" },
      );
      io.observe(el);
    }

    // Safety fallback: always autoplay within 2.5s of mount.
    const fallback = setTimeout(trigger, 2500);

    return () => {
      io?.disconnect();
      clearTimeout(fallback);
    };
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
            "radial-gradient(ellipse at 50% 0%, rgba(167,139,250,0.28), hsl(var(--leadac-h) var(--leadac-s) 50% / 0.18) 40%, transparent 70%)",
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
            "0 80px 200px hsl(var(--leadac-h) var(--leadac-s) 42% / 0.3)",
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
            app.leadac.ai / discover
          </div>
          <span
            className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md"
            style={{
              background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.45)",
              border: "0.5px solid rgba(255,255,255,0.06)",
            }}
          >
            Discover
          </span>
        </div>

        <div className="p-5 sm:p-6">
          {/* Form */}
          <div
            className="rounded-xl p-4 mb-4 space-y-3.5"
            style={{
              background: "rgba(255,255,255,0.025)",
              border: "0.5px solid rgba(255,255,255,0.07)",
            }}
          >
            {/* Locations row */}
            <div>
              <label className="text-[10.5px] uppercase tracking-[0.12em] font-semibold text-white/45 mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3 h-3" />
                Locations
                <span className="ml-1 inline-flex items-center gap-1 px-1.5 py-px rounded-full text-[9px] font-medium normal-case tracking-normal"
                  style={{
                    background: "hsl(152 48% 50% / 0.1)",
                    border: "0.5px solid hsl(152 48% 50% / 0.28)",
                    color: "hsl(152 48% 60%)",
                  }}
                >
                  <ShieldCheck className="w-2.5 h-2.5" />
                  Verified · Google Places
                </span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {cities.map((c) => {
                  const active = c === city;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setCity(c);
                        setPhase("idle");
                        setVisibleCount(0);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11.5px] font-medium transition-all"
                      style={{
                        background: active
                          ? "hsl(var(--leadac-h) var(--leadac-s) 50% / 0.16)"
                          : "rgba(255,255,255,0.03)",
                        border: active
                          ? "0.5px solid hsl(var(--leadac-h) var(--leadac-s) 50% / 0.45)"
                          : "0.5px solid rgba(255,255,255,0.06)",
                        color: active ? "var(--leadac-300)" : "rgba(255,255,255,0.65)",
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          background: active
                            ? "hsl(152 48% 55%)"
                            : "rgba(255,255,255,0.25)",
                          boxShadow: active
                            ? "0 0 6px hsl(152 48% 55% / 0.7)"
                            : "none",
                        }}
                      />
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Niche pack row */}
            <div>
              <label className="text-[10.5px] uppercase tracking-[0.12em] font-semibold text-white/45 mb-1.5 flex items-center gap-1.5">
                <Search className="w-3 h-3" />
                Niche pack
                <span className="ml-1 text-[9px] font-medium normal-case tracking-normal text-white/35">
                  · audit signals tuned per vertical
                </span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {niches.map((n, i) => {
                  const active = n === niche;
                  // Mark the first niche as a parent pack with sub-niches
                  // (matches the real "fnb" hybrid pack with fan-out).
                  const subNicheCount = i === 0 ? 9 : 0;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        setNiche(n);
                        setPhase("idle");
                        setVisibleCount(0);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11.5px] font-medium transition-all"
                      style={{
                        background: active
                          ? "hsl(var(--leadac-h) var(--leadac-s) 50% / 0.16)"
                          : "rgba(255,255,255,0.03)",
                        border: active
                          ? "0.5px solid hsl(var(--leadac-h) var(--leadac-s) 50% / 0.45)"
                          : "0.5px solid rgba(255,255,255,0.06)",
                        color: active
                          ? "var(--leadac-300)"
                          : "rgba(255,255,255,0.65)",
                      }}
                    >
                      {n}
                      {subNicheCount > 0 && (
                        <span
                          className="px-1.5 py-px rounded-full text-[9.5px] font-semibold tabular-nums"
                          style={{
                            background: active
                              ? "hsl(var(--leadac-h) var(--leadac-s) 50% / 0.22)"
                              : "rgba(255,255,255,0.05)",
                            color: active
                              ? "var(--leadac-200)"
                              : "rgba(255,255,255,0.45)",
                          }}
                        >
                          {subNicheCount} sub
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Run button row */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <p className="text-[11px] text-white/40 leading-snug min-w-0 flex-1">
                <Globe className="w-3 h-3 inline -mt-0.5 mr-1 text-white/30" />
                Searches Google Places live · deduped by Place ID before save
              </p>
              <button
                type="button"
                onClick={run}
                // Intentionally always clickable: re-clicking during "running"
                // starts a fresh run (runTokenRef invalidates stale timers),
                // which is the user's escape hatch if the demo ever gets stuck.
                className="px-3.5 py-2 rounded-lg text-[12.5px] font-semibold text-white inline-flex items-center justify-center gap-1.5 shrink-0"
                style={{
                  background:
                    "linear-gradient(180deg, hsl(var(--leadac-h) var(--leadac-s) 50%), hsl(var(--leadac-h) var(--leadac-s) 42%))",
                  boxShadow:
                    "0 1px 0 rgba(255,255,255,0.15) inset, 0 0 0 0.5px hsl(var(--leadac-h) var(--leadac-s) 42% / 0.7), 0 6px 18px hsl(var(--leadac-h) var(--leadac-s) 42% / 0.4)",
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
                  Fanning out · deduping by Place ID…
                </>
              )}
              {phase === "done" && (
                <>
                  <CheckCircle2 className="w-3 h-3 text-[hsl(152_48%_50%)]" />
                  {visibleCount} of {leads.length} audited
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
                      "linear-gradient(90deg, hsl(var(--leadac-h) var(--leadac-s) 50%), hsl(var(--leadac-h) var(--leadac-s) 78%), hsl(var(--leadac-h) var(--leadac-s) 50%))",
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
                background: "hsl(152 48% 50% / 0.07)",
                border: "0.5px solid hsl(152 48% 50% / 0.2)",
              }}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-[hsl(152_48%_50%)] shrink-0" />
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
