"use client";

import { useState, useTransition } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

interface FormState {
  email: string;
  company: string;
  /** Honeypot — hidden from real users via off-screen positioning. */
  website: string;
}

const EMPTY: FormState = { email: "", company: "", website: "" };

const FIELD_BASE_CLASS =
  "w-full rounded-xl px-4 py-3 text-[14.5px] text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-offset-0 transition-colors";

const FIELD_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.10)",
  ["--tw-ring-color" as never]:
    "hsl(var(--revint-h) var(--revint-s) 60% / 0.4)",
};

/**
 * Inline waitlist form.
 *
 * Single-purpose: capture an email + optional agency name and post to
 * /api/waitlist. Inline error surface (red helper text under the email
 * field) instead of a global toast — the form lives inside a section
 * card, not a full page, so toasts feel disconnected here. On success
 * the form swaps to a compact receipt card so the user has feedback
 * without waiting for the confirmation email.
 */
export function WaitlistForm() {
  const [state, setState] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
    if (error) setError(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPending) return;

    const email = state.email.trim();
    const company = state.company.trim();
    const website = state.website;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("That email looks off — double-check the address.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/waitlist", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, company, website }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
        };

        if (res.status === 429) {
          setError(
            "Lots of submissions from your network — give it a minute and try again.",
          );
          return;
        }
        if (!res.ok || !data.ok) {
          setError(
            "Something bounced. Email mert@revint.dev directly and I'll add you by hand.",
          );
          return;
        }
        setSubmitted(true);
      } catch {
        setError(
          "Something bounced. Email mert@revint.dev directly and I'll add you by hand.",
        );
      }
    });
  }

  if (submitted) {
    return (
      <div
        className="rounded-2xl p-6 md:p-7 flex items-start gap-4"
        style={{
          background:
            "linear-gradient(135deg, hsl(var(--revint-h) var(--revint-s) 60% / 0.16), hsl(var(--revint-h) var(--revint-s) 50% / 0.04))",
          border: "1px solid hsl(var(--revint-h) var(--revint-s) 60% / 0.32)",
        }}
        role="status"
        aria-live="polite"
      >
        <span
          className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center"
          style={{
            background:
              "linear-gradient(135deg, hsl(var(--revint-h) var(--revint-s) 60%), hsl(var(--revint-h) var(--revint-s) 36%))",
            color: "white",
          }}
          aria-hidden
        >
          <CheckCircle2 className="w-5 h-5" />
        </span>
        <div className="flex-1">
          <h3 className="text-[18px] md:text-[20px] font-semibold text-white tracking-tight">
            You&apos;re on the list.
          </h3>
          <p className="mt-1.5 text-[14px] text-white/65 leading-relaxed">
            Confirmation email is on the way. When we open a slot, this address
            gets the first ping. Want to skip ahead? Reply to that email with
            a postcode + niche and we&apos;ll set up a 15-min audit call.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
      {/* Honeypot */}
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

      <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr] gap-3">
        <input
          required
          type="email"
          autoComplete="email"
          value={state.email}
          onChange={(e) => update("email", e.target.value)}
          className={FIELD_BASE_CLASS}
          style={FIELD_STYLE}
          placeholder="you@agency.com"
          aria-label="Work email"
        />
        <input
          type="text"
          autoComplete="organization"
          value={state.company}
          onChange={(e) => update("company", e.target.value)}
          className={FIELD_BASE_CLASS}
          style={FIELD_STYLE}
          placeholder="Agency (optional)"
          aria-label="Agency or company name"
        />
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          type="submit"
          disabled={isPending}
          className="group inline-flex items-center gap-2 rounded-full px-5 py-3 text-[14px] font-semibold text-black transition-transform hover:-translate-y-px disabled:opacity-70 disabled:cursor-wait"
          style={{
            background:
              "linear-gradient(180deg, hsl(var(--revint-h) var(--revint-s) 72%) 0%, hsl(var(--revint-h) var(--revint-s) 58%) 100%)",
            boxShadow:
              "0 1px 0 rgba(255,255,255,0.4) inset, 0 12px 36px hsl(var(--revint-h) var(--revint-s) 50% / 0.35)",
          }}
        >
          {isPending ? "Adding..." : "Join the waitlist"}
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
          ) : (
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          )}
        </button>

        <p className="text-[12px] text-white/45 leading-snug max-w-[28ch]">
          No spam. One launch email when we open the gates.
        </p>
      </div>

      {error ? (
        <p
          role="alert"
          className="text-[12.5px]"
          style={{ color: "hsl(0 80% 70%)" }}
        >
          {error}
        </p>
      ) : null}
    </form>
  );
}
