"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Footprints, Navigation, MapPin } from "lucide-react";

interface WalkRouteStop {
  name: string;
  niche: string;
  walkMinutes: number;
  auditScore: number;
}

interface WalkRouteCardProps {
  /** Header label (e.g. "Camden, NW1"). */
  area?: string;
  stops?: WalkRouteStop[];
}

const DEFAULT_STOPS: WalkRouteStop[] = [
  { name: "Sunny Plumbing & Heating", niche: "Plumber", walkMinutes: 3, auditScore: 38 },
  { name: "Camden Cuts Barbershop", niche: "Barber", walkMinutes: 7, auditScore: 42 },
  { name: "North London Locksmith", niche: "Locksmith", walkMinutes: 12, auditScore: 51 },
  { name: "Hawley HVAC Co.", niche: "HVAC", walkMinutes: 18, auditScore: 47 },
];

/**
 * Apple Maps directions - flavored card. Faint dotted-grid background,
 * numbered stops, walking-distance pills, audit score chips. The first
 * stop animates in with a "current location" pulse on intersection.
 */
export function WalkRouteCard({
  area = "Camden, NW1 - sorted by walking distance",
  stops = DEFAULT_STOPS,
}: WalkRouteCardProps) {
  const reduce = useReducedMotion();
  const [revealed, setRevealed] = useState(reduce ?? false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduce) return;
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setRevealed(true);
        });
      },
      { threshold: 0.4 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [reduce]);

  const totalMinutes = stops.reduce((sum, s) => sum + s.walkMinutes, 0);

  return (
    <div
      ref={ref}
      className="relative h-full w-full p-5 sm:p-6 flex flex-col overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, rgba(20,20,24,1) 0%, rgba(14,14,18,1) 100%)",
      }}
    >
      {/* Faint dotted grid (map vibe) */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.7) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />

      {/* Header */}
      <div className="relative flex items-start justify-between mb-1">
        <div>
          <p className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-(--leadac-300) mb-1">
            Next door
          </p>
          <h3 className="text-[14.5px] sm:text-[16px] font-semibold tracking-tight text-white/95 leading-snug">
            {area}
          </h3>
        </div>
        <div
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[10.5px] font-medium"
          style={{
            background: "hsl(var(--leadac-h) var(--leadac-s) 50% / 0.14)",
            border: "0.5px solid hsl(var(--leadac-h) var(--leadac-s) 50% / 0.3)",
            color: "var(--leadac-300)",
          }}
        >
          <Footprints className="w-3 h-3" />
          {totalMinutes} min total
        </div>
      </div>

      {/* Route line + stops */}
      <div className="relative mt-4 flex-1">
        {/* Vertical route line */}
        <div
          aria-hidden
          className="absolute left-[14px] top-3 bottom-3 w-px"
          style={{
            background:
              "linear-gradient(180deg, hsl(var(--leadac-h) var(--leadac-s) 50% / 0.55), hsl(var(--leadac-h) var(--leadac-s) 50% / 0.1))",
          }}
        />

        <ul className="relative space-y-2.5">
          {stops.map((stop, i) => (
            <motion.li
              key={stop.name}
              initial={reduce ? false : { opacity: 0, x: -8 }}
              animate={
                revealed
                  ? { opacity: 1, x: 0 }
                  : reduce
                    ? { opacity: 1, x: 0 }
                    : undefined
              }
              transition={{
                type: "spring",
                stiffness: 240,
                damping: 26,
                delay: i * 0.1,
              }}
              className="relative flex items-center gap-3 pl-1"
            >
              {/* Stop marker */}
              <div className="relative shrink-0 z-10">
                {i === 0 ? (
                  <div className="relative">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center"
                      style={{
                        background: "linear-gradient(180deg, hsl(var(--leadac-h) var(--leadac-s) 50%), hsl(var(--leadac-h) var(--leadac-s) 42%))",
                        boxShadow:
                          "0 0 0 0.5px hsl(var(--leadac-h) var(--leadac-s) 78% / 0.5), 0 4px 12px hsl(var(--leadac-h) var(--leadac-s) 42% / 0.45)",
                      }}
                    >
                      <Navigation className="w-3.5 h-3.5 text-white -translate-y-px" />
                    </div>
                    {!reduce && (
                      <span
                        aria-hidden
                        className="absolute inset-0 rounded-full animate-ping"
                        style={{
                          background: "hsl(var(--leadac-h) var(--leadac-s) 50% / 0.4)",
                          animationDuration: "2.4s",
                        }}
                      />
                    )}
                  </div>
                ) : (
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold tabular-nums"
                    style={{
                      background: "rgba(28,28,32,0.95)",
                      border: "0.5px solid rgba(255,255,255,0.12)",
                      color: "hsl(var(--leadac-h) var(--leadac-nts) 92% / 0.85)",
                    }}
                  >
                    {i + 1}
                  </div>
                )}
              </div>

              {/* Lead row */}
              <div
                className="flex-1 min-w-0 rounded-xl px-3 py-2.5 flex items-center justify-between gap-3"
                style={{
                  background: "rgba(28,28,32,0.7)",
                  border: "0.5px solid rgba(255,255,255,0.07)",
                }}
              >
                <div className="min-w-0">
                  <p className="text-[12.5px] font-medium text-white/90 truncate">
                    {stop.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5 text-[10.5px] text-white/45">
                    <MapPin className="w-2.5 h-2.5" />
                    {stop.niche}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className="text-[10.5px] font-semibold tabular-nums px-1.5 py-0.5 rounded-md"
                    style={{
                      background: scoreBg(stop.auditScore),
                      color: scoreFg(stop.auditScore),
                      border: `0.5px solid ${scoreBorder(stop.auditScore)}`,
                    }}
                  >
                    {stop.auditScore}
                  </span>
                  <span className="text-[11px] text-white/55 tabular-nums">
                    {stop.walkMinutes} min
                  </span>
                </div>
              </div>
            </motion.li>
          ))}
        </ul>
      </div>

      {/* Footer */}
      <p className="relative text-[10.5px] text-white/40 mt-3">
        GPS sorts by walking distance from your current location.
      </p>
    </div>
  );
}

// Audit score is "points broken" - lower = healthier site, higher = bigger
// opportunity for the crew. We tint by opportunity, not by health.
function scoreBg(s: number): string {
  if (s >= 50) return "rgba(251,113,133,0.14)";
  if (s >= 40) return "hsl(38 70% 60% / 0.14)";
  return "hsl(var(--leadac-h) var(--leadac-s) 50% / 0.14)";
}
function scoreBorder(s: number): string {
  if (s >= 50) return "rgba(251,113,133,0.32)";
  if (s >= 40) return "hsl(38 70% 60% / 0.32)";
  return "hsl(var(--leadac-h) var(--leadac-s) 50% / 0.32)";
}
function scoreFg(s: number): string {
  if (s >= 50) return "hsl(4 42% 72%)";
  if (s >= 40) return "hsl(38 70% 60%)";
  return "var(--leadac-300)";
}
