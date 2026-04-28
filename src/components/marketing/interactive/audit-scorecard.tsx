"use client";

import { motion } from "framer-motion";
import {
  CircleCheck,
  CircleX,
  AlertTriangle,
  Star,
  MapPin,
  Phone,
  Globe,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { scoreColor, type DemoLead, DEFAULT_SIGNALS } from "./types";

interface AuditScorecardProps {
  lead: DemoLead;
}

const STATUS_ICON = {
  good: CircleCheck,
  bad: CircleX,
  warning: AlertTriangle,
} as const;

const STATUS_COLOR = {
  good: "hsl(152 48% 50%)",
  bad: "hsl(4 62% 70%)",
  warning: "hsl(38 70% 52%)",
} as const;

const STATUS_BG = {
  good: "hsl(152 48% 50% / 0.08)",
  bad: "hsl(4 62% 54% / 0.08)",
  warning: "hsl(38 70% 52% / 0.08)",
} as const;

/**
 * Polished audit visual for the home tour's "Audit & score" scene.
 *
 * Mirrors the lead-detail page in the actual app: a circular score
 * gauge with grade letter, the lead header (name, niche, location,
 * rating, review count), and a structured signal list with quantified
 * detail strings — the kind of thing the marketing page should show
 * if it wants to read like a real product surface.
 */
export function AuditScorecard({ lead }: AuditScorecardProps) {
  const signals = lead.signals ?? DEFAULT_SIGNALS;
  const color = scoreColor(lead.score);
  const grade =
    lead.score >= 90
      ? "A+"
      : lead.score >= 85
        ? "A"
        : lead.score >= 75
          ? "B"
          : lead.score >= 65
            ? "C"
            : "D";

  const counts = signals.reduce(
    (acc, s) => {
      acc[s.status] += 1;
      return acc;
    },
    { good: 0, warning: 0, bad: 0 },
  );

  const size = 116;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (lead.score / 100) * circumference;

  return (
    <div className="relative" style={{ perspective: "2400px" }}>
      <div
        aria-hidden
        className="absolute left-1/2 -translate-x-1/2 -top-16 w-[110%] h-[300px] -z-10 pointer-events-none blur-3xl opacity-50"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(167,139,250,0.22), hsl(var(--leadac-h) var(--leadac-s) 50% / 0.16) 40%, transparent 70%)",
        }}
      />

      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          background:
            "linear-gradient(180deg, rgba(32,32,36,0.94) 0%, rgba(22,22,26,0.97) 50%, rgba(16,16,20,0.98) 100%)",
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
            app.leadac.ai / leads / {lead.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}
          </div>
          <span
            className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md"
            style={{
              background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.45)",
              border: "0.5px solid rgba(255,255,255,0.06)",
            }}
          >
            Audit
          </span>
        </div>

        {/* Header: business + score gauge */}
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-5">
            {/* Score gauge */}
            <div className="relative shrink-0">
              <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                className="-rotate-90"
              >
                <defs>
                  <linearGradient id="audit-score-gradient" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.95" />
                    <stop offset="100%" stopColor={color} stopOpacity="0.55" />
                  </linearGradient>
                </defs>
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth={strokeWidth}
                />
                <motion.circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke="url(#audit-score-gradient)"
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset: offset }}
                  transition={{ duration: 1.1, ease: "easeOut", delay: 0.1 }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                  className="text-[28px] font-bold leading-none tabular-nums"
                  style={{ color }}
                >
                  {lead.score}
                </span>
                <span className="text-[9px] uppercase tracking-[0.14em] font-semibold mt-1 text-white/45">
                  Opportunity
                </span>
              </div>
              <div
                className="absolute -top-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold tabular-nums"
                style={{
                  background: "rgba(16,16,20,0.96)",
                  border: `1px solid ${color}80`,
                  color,
                  boxShadow: `0 4px 12px ${color}33`,
                }}
              >
                {grade}
              </div>
            </div>

            {/* Lead identity */}
            <div className="flex-1 min-w-0">
              {lead.niche && (
                <p className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-(--leadac-300) mb-1.5">
                  {lead.niche}
                </p>
              )}
              <h4 className="text-[18px] sm:text-[19px] font-semibold tracking-tight text-white leading-tight mb-2">
                {lead.name}
              </h4>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11.5px] text-white/55 mb-3">
                <span className="flex items-center gap-1.5">
                  <Star className="w-3 h-3 text-[hsl(38_70%_52%)] fill-[hsl(38_70%_52%)]" />
                  <span className="tabular-nums font-medium text-white/85">
                    {lead.rating.toFixed(1)}
                  </span>
                  <span className="tabular-nums text-white/45">
                    ({lead.reviewCount})
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {lead.city}
                </span>
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {lead.phone}
                </span>
                <span className="flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  {lead.website ?? <span className="italic">no website</span>}
                </span>
              </div>

              {/* Counts */}
              <div className="flex flex-wrap gap-1.5">
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-medium tabular-nums"
                  style={{
                    background: STATUS_BG.bad,
                    color: STATUS_COLOR.bad,
                    border: `0.5px solid ${STATUS_COLOR.bad}33`,
                  }}
                >
                  <CircleX className="w-2.5 h-2.5" />
                  {counts.bad} failing
                </span>
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-medium tabular-nums"
                  style={{
                    background: STATUS_BG.warning,
                    color: STATUS_COLOR.warning,
                    border: `0.5px solid ${STATUS_COLOR.warning}33`,
                  }}
                >
                  <AlertTriangle className="w-2.5 h-2.5" />
                  {counts.warning} warning
                </span>
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-medium tabular-nums"
                  style={{
                    background: STATUS_BG.good,
                    color: STATUS_COLOR.good,
                    border: `0.5px solid ${STATUS_COLOR.good}33`,
                  }}
                >
                  <CircleCheck className="w-2.5 h-2.5" />
                  {counts.good} passing
                </span>
              </div>
            </div>
          </div>

          {/* Signals list */}
          <div
            className="mt-5 rounded-xl p-4"
            style={{
              background: "rgba(255,255,255,0.018)",
              border: "0.5px solid rgba(255,255,255,0.06)",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-(--leadac-300)">
                Audit signals · {signals.length}
              </p>
              <p className="text-[10.5px] text-white/35 font-mono">
                Gemini 2.5 Flash · {(0.4 + signals.length * 0.06).toFixed(1)}s
              </p>
            </div>
            <ul className="space-y-2">
              {signals.map((s, i) => {
                const Icon = STATUS_ICON[s.status];
                const c = STATUS_COLOR[s.status];
                return (
                  <motion.li
                    key={s.label}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      delay: 0.2 + i * 0.06,
                      duration: 0.3,
                      ease: "easeOut",
                    }}
                    className="flex items-start gap-3 text-[12px] leading-snug"
                  >
                    <div
                      className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-px"
                      style={{
                        background: STATUS_BG[s.status],
                        border: `0.5px solid ${c}33`,
                      }}
                    >
                      <Icon className="w-3 h-3" style={{ color: c }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white/85">{s.label}</p>
                      <p className="text-white/45 mt-0.5">{s.detail}</p>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          </div>

          {/* Pitch / next-step */}
          <div
            className="mt-3 px-3.5 py-2.5 rounded-xl flex items-start gap-2.5"
            style={{
              background:
                "linear-gradient(180deg, hsl(var(--leadac-h) var(--leadac-s) 50% / 0.08), hsl(var(--leadac-h) var(--leadac-s) 50% / 0.04))",
              border: "0.5px solid hsl(var(--leadac-h) var(--leadac-s) 50% / 0.22)",
            }}
          >
            <Sparkles
              className="w-3.5 h-3.5 mt-0.5 shrink-0"
              style={{ color: "var(--leadac-300)" }}
            />
            <p className="text-[11.5px] text-white/75 leading-snug flex-1">
              <span className="font-semibold text-white">Best angle:</span>{" "}
              {lead.pitch}
            </p>
            <span
              className="text-[10.5px] font-semibold inline-flex items-center gap-1 self-end whitespace-nowrap"
              style={{ color: "var(--leadac-300)" }}
            >
              Generate mockup
              <ArrowRight className="w-3 h-3" />
            </span>
          </div>
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
