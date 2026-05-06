"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, AlertOctagon, Sparkles } from "lucide-react";
import { LeadCardLive } from "./lead-card-live";
import type { DemoLead } from "./types";

interface BeforeAfterSplitProps {
  beforeLabel: string;
  afterLabel: string;
  staleContacts?: StaleRow[];
  freshLead: DemoLead;
}

interface StaleRow {
  email: string;
  company: string;
  pitchedBy: number;
}

const DEFAULT_STALE: StaleRow[] = [
  { email: "j.morgan@apexsupply.com", company: "Apex Supply Co.", pitchedBy: 11 },
  { email: "casey@northwind-ops.io", company: "Northwind Ops", pitchedBy: 9 },
  { email: "info@acme-roofing.net", company: "Acme Roofing", pitchedBy: 14 },
  { email: "hello@brightside-cpa.com", company: "Brightside CPA", pitchedBy: 7 },
  { email: "sales@meridian-hvac.co", company: "Meridian HVAC", pitchedBy: 12 },
];

export function BeforeAfterSplit({
  beforeLabel,
  afterLabel,
  staleContacts = DEFAULT_STALE,
  freshLead,
}: BeforeAfterSplitProps) {
  const reduce = useReducedMotion();

  return (
    <div className="grid md:grid-cols-[1fr_auto_1fr] items-center gap-4">
      {/* Before: stale spreadsheet */}
      <motion.div
        initial={reduce ? false : { opacity: 0, x: -12 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ type: "spring", stiffness: 220, damping: 28 }}
      >
        <div className="flex items-center gap-2 mb-2.5">
          <AlertOctagon className="w-4 h-4 text-[hsl(4_62%_70%)]" />
          <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-[hsl(4_62%_70%)]">
            {beforeLabel}
          </p>
        </div>
        <div
          className="rounded-xl overflow-hidden"
          style={{
            background:
              "linear-gradient(180deg, rgba(40,28,30,0.5), rgba(28,18,22,0.55))",
            border: "0.5px solid rgba(251,113,133,0.18)",
          }}
        >
          <div
            className="px-3 py-2 grid grid-cols-[1fr_70px] text-[10px] uppercase tracking-wider text-white/40 font-semibold"
            style={{ borderBottom: "0.5px solid rgba(255,255,255,0.05)" }}
          >
            <span>Apollo / Clay export</span>
            <span className="text-right">Pitched by</span>
          </div>
          {staleContacts.map((row, i) => (
            <div
              key={row.email}
              className="px-3 py-2 grid grid-cols-[1fr_70px] items-center gap-3 text-[11px] font-mono"
              style={{
                background:
                  i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
                borderTop:
                  i === 0 ? "none" : "0.5px solid rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.45)",
                textDecoration: row.pitchedBy >= 10 ? "line-through" : "none",
              }}
            >
              <div className="min-w-0">
                <div className="truncate">{row.email}</div>
                <div className="text-[9.5px] text-white/30 truncate">
                  {row.company}
                </div>
              </div>
              <div className="text-right">
                <span
                  className="inline-block px-1.5 py-0.5 rounded text-[10px]"
                  style={{
                    background:
                      row.pitchedBy >= 10
                        ? "rgba(251,113,133,0.14)"
                        : "hsl(38 70% 52% / 0.14)",
                    color: row.pitchedBy >= 10 ? "hsl(4 62% 70%)" : "hsl(38 70% 52%)",
                  }}
                >
                  {row.pitchedBy}×
                </span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-white/40 mt-2 leading-snug">
          Same 50M contacts, hit by every agency this month.
        </p>
      </motion.div>

      {/* Arrow */}
      <div className="hidden md:flex items-center justify-center">
        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.5 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, type: "spring", stiffness: 220, damping: 22 }}
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{
            background: "hsl(var(--leadac-h) var(--leadac-s) 50% / 0.16)",
            border: "0.5px solid hsl(var(--leadac-h) var(--leadac-s) 50% / 0.4)",
          }}
        >
          <ArrowRight className="w-4 h-4 text-(--leadac-300)" />
        </motion.div>
      </div>

      {/* After: fresh lead */}
      <motion.div
        initial={reduce ? false : { opacity: 0, x: 12 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ type: "spring", stiffness: 220, damping: 28, delay: 0.1 }}
      >
        <div className="flex items-center gap-2 mb-2.5">
          <Sparkles className="w-4 h-4 text-[hsl(152_48%_50%)]" />
          <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-[hsl(152_48%_50%)]">
            {afterLabel}
          </p>
        </div>
        <LeadCardLive lead={freshLead} defaultExpanded />
        <p className="text-[11px] text-white/40 mt-2 leading-snug">
          Live from our local-business index. No one else has this list.
        </p>
      </motion.div>
    </div>
  );
}
