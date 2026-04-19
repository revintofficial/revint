"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Star,
  MapPin,
  Phone,
  Globe,
  Sparkles,
  ChevronDown,
  CircleCheck,
  CircleX,
  AlertTriangle,
} from "lucide-react";
import { scoreColor, type DemoLead, DEFAULT_SIGNALS } from "./types";

interface LeadCardLiveProps {
  lead: DemoLead;
  defaultExpanded?: boolean;
  compact?: boolean;
}

const STATUS_ICON = {
  good: CircleCheck,
  bad: CircleX,
  warning: AlertTriangle,
} as const;

const STATUS_COLOR = {
  good: "#34D399",
  bad: "#F87171",
  warning: "#F59E0B",
} as const;

export function LeadCardLive({
  lead,
  defaultExpanded = false,
  compact = false,
}: LeadCardLiveProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const reduce = useReducedMotion();
  const signals = lead.signals ?? DEFAULT_SIGNALS;
  const color = scoreColor(lead.score);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "0.5px solid rgba(255,255,255,0.07)",
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full p-3 flex flex-col sm:flex-row sm:items-center gap-3 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div
          className="w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0"
          style={{
            background: `${color}1f`,
            border: `0.5px solid ${color}40`,
          }}
        >
          <span
            className="text-[15px] font-bold leading-none tabular-nums"
            style={{ color }}
          >
            {lead.score}
          </span>
          <span
            className="text-[8.5px] uppercase tracking-wider mt-0.5"
            style={{ color }}
          >
            Score
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h4 className="text-[13.5px] font-semibold truncate">{lead.name}</h4>
            <div className="flex items-center gap-0.5 text-[11px] text-white/55">
              <Star className="w-3 h-3 text-[#FFD60A] fill-[#FFD60A]" />
              <span className="tabular-nums">{lead.rating.toFixed(1)}</span>
              <span className="text-white/30">·</span>
              <span className="tabular-nums">{lead.reviewCount}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/50 mb-1.5">
            <span className="flex items-center gap-1">
              <MapPin className="w-2.5 h-2.5" /> {lead.city}
            </span>
            <span className="flex items-center gap-1">
              <Phone className="w-2.5 h-2.5" /> {lead.phone}
            </span>
            <span className="flex items-center gap-1">
              <Globe className="w-2.5 h-2.5" /> {lead.website || "no website"}
            </span>
          </div>
          {!compact && (
            <div className="flex flex-wrap gap-1 mb-1.5">
              {lead.issues.map((i) => (
                <span
                  key={i}
                  className="px-1.5 py-0.5 rounded text-[10px]"
                  style={{
                    background: "rgba(255, 69, 58, 0.1)",
                    color: "rgba(255, 100, 92, 0.95)",
                    border: "0.5px solid rgba(255, 69, 58, 0.18)",
                  }}
                >
                  {i}
                </span>
              ))}
            </div>
          )}
          {!compact && (
            <p
              className="text-[11.5px] italic leading-snug"
              style={{ color: "rgba(235, 235, 245, 0.6)" }}
            >
              <Sparkles
                className="w-2.5 h-2.5 inline -mt-0.5 mr-1"
                style={{ color: "#A5B4FC" }}
              />
              {lead.pitch}
            </p>
          )}
        </div>

        <ChevronDown
          className="w-4 h-4 text-white/40 transition-transform shrink-0"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 240,
              damping: 30,
            }}
            style={{ overflow: "hidden" }}
          >
            <div
              className="px-4 pb-4 pt-1"
              style={{
                borderTop: "0.5px solid rgba(255,255,255,0.05)",
              }}
            >
              <p className="text-[10.5px] uppercase tracking-[0.12em] font-semibold text-[#A5B4FC] mt-3 mb-2">
                Audit signals
              </p>
              <ul className="space-y-1.5">
                {signals.map((s) => {
                  const Icon = STATUS_ICON[s.status];
                  const c = STATUS_COLOR[s.status];
                  return (
                    <li
                      key={s.label}
                      className="flex items-start gap-2.5 text-[12px]"
                    >
                      <Icon
                        className="w-3.5 h-3.5 mt-0.5 shrink-0"
                        style={{ color: c }}
                      />
                      <div className="flex-1 min-w-0 flex items-baseline gap-2 flex-wrap">
                        <span className="font-medium text-white/85">
                          {s.label}
                        </span>
                        <span className="text-white/45 leading-snug">
                          {s.detail}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
