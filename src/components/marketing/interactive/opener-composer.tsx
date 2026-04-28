"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Send,
  Sparkles,
  RotateCcw,
  Check,
  Mail,
  Link as LinkIcon,
  Copy,
  ExternalLink,
} from "lucide-react";
import type { DemoLead } from "./types";

interface OpenerComposerProps {
  lead: DemoLead;
  recipient?: string;
  cps?: number;
  /**
   * Strip the outer rounded card chrome (border, shadow, background gradient).
   * Useful when this composer is nested inside a device frame that already
   * provides the surface (e.g. PhoneFrame on the walk-in landing page).
   */
  chromeless?: boolean;
}

export function OpenerComposer({
  lead,
  recipient,
  cps = 60,
  chromeless = false,
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
      className={chromeless ? "" : "rounded-2xl overflow-hidden"}
      style={
        chromeless
          ? undefined
          : {
              background:
                "linear-gradient(180deg, rgba(32,32,36,0.92) 0%, rgba(22,22,26,0.96) 100%)",
              border: "0.5px solid rgba(255,255,255,0.09)",
              boxShadow:
                "0 24px 60px rgba(0,0,0,0.5), 0 80px 200px hsl(var(--leadac-h) var(--leadac-s) 42% / 0.25)",
            }
      }
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
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
            style={{
              background: "rgba(167,139,250,0.18)",
              border: "0.5px solid rgba(167,139,250,0.35)",
            }}
            aria-hidden
          >
            <Sparkles className="w-3 h-3 text-[hsl(var(--leadac-h) var(--leadac-s) 78%)]" />
          </div>
          <div className="min-w-0">
            <p className="text-[11.5px] font-medium text-white truncate">
              AI-drafted opener
            </p>
            <p className="text-[10px] text-white/40 truncate font-mono">
              grounded in audit · pushes to gmail / outlook / smartlead
            </p>
          </div>
        </div>
        <span
          className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono whitespace-nowrap"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "0.5px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.55)",
          }}
        >
          <Mail className="w-2.5 h-2.5" />
          Auto-send · off
        </span>
      </div>

      {/* Email-like header */}
      <div
        className="px-5 pt-4 pb-3 space-y-1.5 text-[11.5px]"
        style={{ borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-white/40 w-14 shrink-0">From</span>
          <span className="text-white/85 inline-flex items-center gap-1.5">
            mert@leadac.ai
            <span
              className="text-[9.5px] font-medium px-1.5 py-px rounded"
              style={{
                background: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.45)",
                border: "0.5px solid rgba(255,255,255,0.06)",
              }}
            >
              via Gmail
            </span>
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-white/40 w-14 shrink-0">To</span>
          <span className="text-white/85 truncate">
            {recipientName.toLowerCase()}@
            {(lead.website ?? "example.com").replace(/^https?:\/\//, "")}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-white/40 w-14 shrink-0">Subject</span>
          <span className="text-white/90 font-medium truncate">{subject}</span>
        </div>
      </div>

      {/* Body */}
      <div
        className="mx-5 my-4 p-4 rounded-xl text-[12.5px] leading-relaxed text-white/85 whitespace-pre-wrap min-h-[180px]"
        style={{
          background: "rgba(255,255,255,0.018)",
          border: "0.5px solid rgba(255,255,255,0.05)",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
        }}
      >
        {typed}
        {!done && !reduce && (
          <motion.span
            className="inline-block w-[2px] h-[14px] ml-0.5 -mb-0.5 align-middle"
            style={{ background: "var(--leadac-300)" }}
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 0.9, repeat: Infinity }}
          />
        )}
      </div>

      {/* Mockup link chip — the message stops being 'hi can I help' */}
      {done && (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="mx-5 mb-4 p-3 rounded-xl flex items-center gap-3"
          style={{
            background:
              "linear-gradient(180deg, hsl(var(--leadac-h) var(--leadac-s) 50% / 0.08), hsl(var(--leadac-h) var(--leadac-s) 50% / 0.04))",
            border:
              "0.5px solid hsl(var(--leadac-h) var(--leadac-s) 50% / 0.22)",
          }}
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{
              background:
                "linear-gradient(135deg, hsl(var(--leadac-h) var(--leadac-s) 78% / 0.25), hsl(var(--leadac-h) var(--leadac-s) 50% / 0.15))",
              border:
                "0.5px solid hsl(var(--leadac-h) var(--leadac-s) 60% / 0.35)",
              color: "var(--leadac-300)",
            }}
            aria-hidden
          >
            <LinkIcon className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11.5px] font-semibold text-white truncate">
              One-page mockup for {lead.name}
            </p>
            <p className="text-[10.5px] text-white/55 truncate font-mono">
              leadac.ai/m/
              {lead.name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .slice(0, 24)}
            </p>
          </div>
          <span
            className="text-[10.5px] font-semibold inline-flex items-center gap-1 shrink-0"
            style={{ color: "var(--leadac-300)" }}
          >
            Preview
            <ExternalLink className="w-3 h-3" />
          </span>
        </motion.div>
      )}

      {/* Action row */}
      <div
        className="px-5 py-3 flex items-center justify-between gap-2 flex-wrap"
        style={{
          borderTop: "0.5px solid rgba(255,255,255,0.05)",
          background: "rgba(255,255,255,0.012)",
        }}
      >
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={reset}
            className="px-2.5 py-1.5 rounded-md text-[11px] font-medium inline-flex items-center gap-1.5 text-white/65 hover:text-white transition-colors"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "0.5px solid rgba(255,255,255,0.07)",
            }}
          >
            <RotateCcw className="w-3 h-3" />
            Re-draft
          </button>
          <button
            type="button"
            disabled={!done}
            className="px-2.5 py-1.5 rounded-md text-[11px] font-medium inline-flex items-center gap-1.5 text-white/65 hover:text-white transition-colors disabled:opacity-40"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "0.5px solid rgba(255,255,255,0.07)",
            }}
          >
            <Copy className="w-3 h-3" />
            Copy
          </button>
        </div>

        <AnimatePresence mode="wait">
          {sent ? (
            <motion.div
              key="sent"
              initial={reduce ? false : { opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="px-3 py-1.5 rounded-lg text-[11.5px] font-semibold inline-flex items-center gap-1.5"
              style={{
                background: "hsl(152 48% 50% / 0.14)",
                border: "0.5px solid hsl(152 48% 50% / 0.32)",
                color: "hsl(152 48% 50%)",
              }}
            >
              <Check className="w-3.5 h-3.5" />
              Sent from Gmail
            </motion.div>
          ) : (
            <motion.button
              key="send"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              type="button"
              disabled={!done}
              onClick={() => setSent(true)}
              className="px-3.5 py-1.5 rounded-lg text-[11.5px] font-semibold text-white inline-flex items-center gap-1.5 disabled:opacity-50"
              style={{
                background:
                  "linear-gradient(180deg, hsl(var(--leadac-h) var(--leadac-s) 50%), hsl(var(--leadac-h) var(--leadac-s) 42%))",
                boxShadow:
                  "0 1px 0 rgba(255,255,255,0.15) inset, 0 0 0 0.5px hsl(var(--leadac-h) var(--leadac-s) 42% / 0.6), 0 6px 18px hsl(var(--leadac-h) var(--leadac-s) 42% / 0.35)",
              }}
            >
              <Send className="w-3 h-3" />
              Send via Gmail
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
