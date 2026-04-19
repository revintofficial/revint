"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Send, Sparkles, RotateCcw, Check } from "lucide-react";
import type { DemoLead } from "./types";

interface OpenerComposerProps {
  lead: DemoLead;
  recipient?: string;
  cps?: number;
}

export function OpenerComposer({
  lead,
  recipient,
  cps = 60,
}: OpenerComposerProps) {
  const reduce = useReducedMotion();
  const [typed, setTyped] = useState("");
  const [done, setDone] = useState(false);
  const [sent, setSent] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  const recipientName =
    recipient ?? lead.name.split(" ")[0]; // first word as a friendly name

  const subject = `Quick mockup for ${lead.name}`;
  const body = buildOpener(lead);

  function start() {
    if (startedRef.current) return;
    startedRef.current = true;
    setTyped("");
    setDone(false);
    setSent(false);

    if (reduce) {
      setTyped(body);
      setDone(true);
      return;
    }

    let i = 0;
    const interval = 1000 / cps;
    const tick = () => {
      i += 1;
      setTyped(body.slice(0, i));
      if (i < body.length) {
        setTimeout(tick, interval);
      } else {
        setDone(true);
      }
    };
    setTimeout(tick, 600);
  }

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            start();
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

  function reset() {
    startedRef.current = false;
    setSent(false);
    start();
  }

  return (
    <div
      ref={containerRef}
      className="rounded-2xl overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, rgba(32,32,36,0.92) 0%, rgba(22,22,26,0.96) 100%)",
        border: "0.5px solid rgba(255,255,255,0.09)",
        boxShadow:
          "0 24px 60px rgba(0,0,0,0.5), 0 80px 200px rgba(49,46,129,0.25)",
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-2.5 flex items-center justify-between gap-2"
        style={{
          borderBottom: "0.5px solid rgba(255,255,255,0.07)",
          background:
            "linear-gradient(180deg, rgba(44,44,48,0.75), rgba(30,30,34,0.55))",
        }}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[#A5B4FC]" />
          <p className="text-[11.5px] font-medium text-white">
            AI-drafted opener
          </p>
        </div>
        <span className="text-[10.5px] text-white/40">
          Grounded in audit signals
        </span>
      </div>

      {/* Email-like header */}
      <div className="px-5 pt-4 pb-3 space-y-1 text-[11.5px]">
        <div className="flex items-baseline gap-2">
          <span className="text-white/40 w-12 shrink-0">To</span>
          <span className="text-white/85">
            {recipientName.toLowerCase()}@{(lead.website ?? "example.com").replace(/^https?:\/\//, "")}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-white/40 w-12 shrink-0">Subject</span>
          <span className="text-white/85 font-medium">{subject}</span>
        </div>
      </div>

      <div
        className="mx-5 mb-4 p-4 rounded-xl text-[12.5px] leading-relaxed text-white/80 font-mono whitespace-pre-wrap min-h-[180px]"
        style={{
          background: "rgba(0,0,0,0.35)",
          border: "0.5px solid rgba(255,255,255,0.05)",
        }}
      >
        {typed}
        {!done && !reduce && (
          <motion.span
            className="inline-block w-[7px] h-[14px] ml-0.5 -mb-0.5 bg-[#A5B4FC] align-middle"
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 0.9, repeat: Infinity }}
          />
        )}
      </div>

      <div className="px-5 pb-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={reset}
          className="px-2.5 py-1 rounded-md text-[11px] font-medium inline-flex items-center gap-1 text-white/65 hover:text-white"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "0.5px solid rgba(255,255,255,0.07)",
          }}
        >
          <RotateCcw className="w-3 h-3" />
          Re-draft
        </button>

        <AnimatePresence mode="wait">
          {sent ? (
            <motion.div
              key="sent"
              initial={reduce ? false : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="px-3 py-1.5 rounded-lg text-[11.5px] font-semibold inline-flex items-center gap-1.5"
              style={{
                background: "rgba(52,211,153,0.14)",
                border: "0.5px solid rgba(52,211,153,0.32)",
                color: "#34D399",
              }}
            >
              <Check className="w-3.5 h-3.5" />
              Pushed to Smartlead
            </motion.div>
          ) : (
            <motion.button
              key="send"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              type="button"
              disabled={!done}
              onClick={() => setSent(true)}
              className="px-3 py-1.5 rounded-lg text-[11.5px] font-semibold text-white inline-flex items-center gap-1.5 disabled:opacity-50"
              style={{
                background: "linear-gradient(180deg, #4F5BD6, #3730A3)",
                boxShadow:
                  "0 1px 0 rgba(255,255,255,0.15) inset, 0 0 0 0.5px rgba(67,56,202,0.6)",
              }}
            >
              <Send className="w-3 h-3" />
              Push to Smartlead
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function buildOpener(lead: DemoLead): string {
  const issue =
    lead.issues[0]?.toLowerCase() ?? "a quick fix on the booking flow";
  const second = lead.issues[1]?.toLowerCase() ?? "the page weight";
  const websiteLine = lead.website
    ? `Took a look at ${lead.website} this morning.`
    : `Noticed ${lead.name} doesn't have a site listed on Google.`;
  return `Hey ${lead.name.split(" ")[0]} team —

${websiteLine}

Two things stood out: ${issue}, and ${second}. Both are losing you customers from the ${lead.rating.toFixed(
    1
  )}★ traffic you already have.

I sketched a one-page mockup with the fixes baked in. Your reviews pulled in, your real services, ${lead.city} on the map. Link below if you want to glance at it before our call.

Worth 15 minutes this week?

— Mert`;
}
