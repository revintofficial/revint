"use client";

import { useState, useTransition } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CheckCircle2, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

const FIELD_BASE_CLASS =
  "w-full rounded-xl px-4 py-3 text-[14.5px] text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-offset-0 transition-colors";

const FIELD_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.10)",
  // The ring color is set via CSS variable so it tracks brand hue.
  // Tailwind's focus:ring color falls back to currentColor if unset
  // — explicit color prevents that surprise.
  ["--tw-ring-color" as never]:
    "hsl(var(--leadac-h) var(--leadac-s) 60% / 0.4)",
};

const LABEL_CLASS =
  "text-[12px] uppercase tracking-[0.12em] font-semibold text-white/60";

interface FormState {
  name: string;
  email: string;
  company: string;
  postcodeNiche: string;
  monthlyVolume: string;
  notes: string;
  /** Honeypot field — hidden from real users via CSS. Bots autofill it. */
  website: string;
}

const EMPTY: FormState = {
  name: "",
  email: "",
  company: "",
  postcodeNiche: "",
  monthlyVolume: "",
  notes: "",
  website: "",
};

const VOLUME_OPTIONS = [
  { value: "", label: "Pick one" },
  { value: "<500", label: "Under 500 / month" },
  { value: "500-2000", label: "500 - 2,000 / month" },
  { value: "2000-10000", label: "2,000 - 10,000 / month" },
  { value: "10000+", label: "10,000+ / month" },
  { value: "not-yet", label: "We haven't started yet" },
];

/**
 * Demo request form — homepage CTA destination.
 *
 * Shape: short, qualifying, audit-first. The killer field is
 * "Postcode + niche to audit live on the call" — it filters tire-
 * kickers (a real prospect knows their ICP geography) and lets the
 * founder show up to the call with a fresh audit already loaded
 * instead of a slide deck.
 *
 * Submission goes to /api/demo/request which IP-rate-limits via
 * LIMITS.demoRequest, sends a notify email to the founder inbox,
 * and best-effort sends a confirmation back to the prospect.
 *
 * Errors surface via sonner toast. Successful submissions flip the
 * whole component to a "got it" success card so the user has a
 * clear receipt without having to wait for the email.
 */
export function DemoRequestForm() {
  const reduce = useReducedMotion();
  const [state, setState] = useState<FormState>(EMPTY);
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPending) return;

    const trimmed: FormState = {
      name: state.name.trim(),
      email: state.email.trim(),
      company: state.company.trim(),
      postcodeNiche: state.postcodeNiche.trim(),
      monthlyVolume: state.monthlyVolume.trim(),
      notes: state.notes.trim(),
      website: state.website,
    };

    if (!trimmed.name) {
      toast.error("Add your name so I know who to reply to.");
      return;
    }
    if (!trimmed.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed.email)) {
      toast.error("That email looks off — double-check the address.");
      return;
    }
    if (!trimmed.company) {
      toast.error("Add your agency / company name.");
      return;
    }
    if (!trimmed.postcodeNiche) {
      toast.error("Tell me what postcode + niche to audit on the call.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/demo/request", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(trimmed),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
        };

        if (res.status === 429) {
          toast.error(
            "A few requests came through quickly from your network — give it a minute and try again.",
          );
          return;
        }
        if (!res.ok || !data.ok) {
          toast.error(
            "The form bounced. Email mert@leadacai.com directly and I'll set up the call by hand.",
          );
          return;
        }
        setSubmitted(true);
      } catch {
        toast.error(
          "The form bounced. Email mert@leadacai.com directly and I'll set up the call by hand.",
        );
      }
    });
  }

  if (submitted) {
    return (
      <motion.div
        initial={reduce ? { opacity: 1 } : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="rounded-2xl p-7 md:p-9 flex flex-col gap-4"
        style={{
          background:
            "linear-gradient(135deg, hsl(var(--leadac-h) var(--leadac-s) 60% / 0.16), hsl(var(--leadac-h) var(--leadac-s) 50% / 0.04))",
          border:
            "1px solid hsl(var(--leadac-h) var(--leadac-s) 60% / 0.32)",
        }}
        role="status"
        aria-live="polite"
      >
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{
            background:
              "linear-gradient(135deg, hsl(var(--leadac-h) var(--leadac-s) 60%), hsl(var(--leadac-h) var(--leadac-s) 36%))",
            color: "white",
          }}
          aria-hidden
        >
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <h3 className="text-[22px] md:text-[26px] leading-tight tracking-[-0.02em] font-semibold text-white">
          Got it. I&apos;ll be in touch shortly.
        </h3>
        <p className="text-[14.5px] text-white/70 leading-relaxed">
          A confirmation just landed in your inbox. Before the call I&apos;ll run the audit on the postcode + niche you flagged so we can open the audited shortlist on screen instead of a deck. You&apos;ll walk away with prospects either way — no signup required.
        </p>
        <p className="text-[13px] text-white/50 leading-relaxed">
          Don&apos;t see the email in 5 minutes? Check the spam folder, or reply directly to mert@leadacai.com.
        </p>
      </motion.div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5"
      noValidate
    >
      {/* Honeypot — hidden from humans, irresistible to dumb form-fill
          bots. CSS positions it off-screen rather than `display:none`
          because some bot scripts skip display:none nodes. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: "-9999px",
          width: 1,
          height: 1,
          overflow: "hidden",
        }}
      >
        <label>
          Website
          <input
            tabIndex={-1}
            autoComplete="off"
            type="text"
            value={state.website}
            onChange={(e) => update("website", e.target.value)}
          />
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={LABEL_CLASS}>Your name</span>
          <input
            required
            type="text"
            autoComplete="name"
            value={state.name}
            onChange={(e) => update("name", e.target.value)}
            className={FIELD_BASE_CLASS}
            style={FIELD_STYLE}
            placeholder="Mert Avci"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={LABEL_CLASS}>Work email</span>
          <input
            required
            type="email"
            autoComplete="email"
            value={state.email}
            onChange={(e) => update("email", e.target.value)}
            className={FIELD_BASE_CLASS}
            style={FIELD_STYLE}
            placeholder="you@agency.com"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={LABEL_CLASS}>Agency / company</span>
        <input
          required
          type="text"
          autoComplete="organization"
          value={state.company}
          onChange={(e) => update("company", e.target.value)}
          className={FIELD_BASE_CLASS}
          style={FIELD_STYLE}
          placeholder="Acme Outbound"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={LABEL_CLASS}>
          Postcode + niche to audit live on the call
        </span>
        <input
          required
          type="text"
          value={state.postcodeNiche}
          onChange={(e) => update("postcodeNiche", e.target.value)}
          className={FIELD_BASE_CLASS}
          style={FIELD_STYLE}
          placeholder='e.g. "NW1 dentists" or "Camden cafes"'
        />
        <span className="text-[12px] text-white/45 leading-snug pl-1">
          The killer detail. I&apos;ll run the audit on this list before the call so we open a real audited shortlist on screen, not a slide deck.
        </span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={LABEL_CLASS}>Monthly outbound volume (optional)</span>
        <select
          value={state.monthlyVolume}
          onChange={(e) => update("monthlyVolume", e.target.value)}
          className={FIELD_BASE_CLASS}
          style={FIELD_STYLE}
        >
          {VOLUME_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value} className="text-black">
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={LABEL_CLASS}>Anything else worth flagging? (optional)</span>
        <textarea
          rows={3}
          value={state.notes}
          onChange={(e) => update("notes", e.target.value)}
          className={`${FIELD_BASE_CLASS} resize-none`}
          style={FIELD_STYLE}
          placeholder="Stack you're already running, what's broken, who you sell to, anything to skip on the call."
        />
      </label>

      <div className="flex items-center justify-between gap-4 flex-wrap mt-2">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-5 py-3 rounded-xl text-[14.5px] font-semibold text-white transition-transform hover:-translate-y-px disabled:opacity-70 disabled:cursor-wait"
          style={{
            background:
              "linear-gradient(180deg, hsl(var(--leadac-h) var(--leadac-s) 50%), hsl(var(--leadac-h) var(--leadac-s) 34%))",
            boxShadow:
              "0 1px 0 rgba(255,255,255,0.15) inset, 0 0 0 0.5px hsl(var(--leadac-h) var(--leadac-s) 50% / 0.7), 0 8px 24px hsl(var(--leadac-h) var(--leadac-s) 34% / 0.35)",
          }}
        >
          {isPending ? "Sending..." : "Book the walkthrough"}
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ArrowRight className="w-4 h-4" />
          )}
        </button>

        <p className="text-[12px] text-white/45 leading-snug max-w-xs flex items-center gap-2">
          <Send className="w-3.5 h-3.5 shrink-0" aria-hidden />
          Goes straight to the founder inbox. Reply turnaround is a few hours during UK working time.
        </p>
      </div>
    </form>
  );
}
