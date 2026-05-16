/**
 * Single-dossier product proof card.
 *
 * Design intent: show, do not describe. One static dossier — Kazu Sushi
 * in Camden — with score badge, signals list, recommended angle chip,
 * rationale, and the actual suggested opener as a blockquote with a
 * tinted left rule. The dossier sits centered at max-w-2xl so the page
 * focuses on the single artifact, the same way a real reviewer would
 * focus on one tab. No animation, no scroll-stage. Pure server.
 */
import * as React from "react";
import { Section } from "./section";

const SIGNALS: Array<{ label: string; detail: string }> = [
  {
    label: "High review volume",
    detail: "1.4k reviews, 4.6 avg",
  },
  {
    label: "Weak reservation funnel",
    detail: "no online booking widget, phone-only",
  },
  {
    label: "No response strategy",
    detail: "zero owner replies on negative reviews in last 90 days",
  },
  {
    label: "High Instagram activity",
    detail: "3.2k followers, 4 posts per week",
  },
];

export function DossierProof() {
  return (
    <Section
      eyebrow="Product proof"
      headline="One restaurant, one dossier, one angle."
      sub="This is what lands in your tab when LeadAC finishes thinking. The work is done before you write the first email."
    >
      <div
        className="relative mx-auto max-w-2xl rounded-3xl border border-white/[0.07] p-7 md:p-9"
        style={{
          background:
            "linear-gradient(180deg, hsl(var(--leadac-h) var(--leadac-ns) 10%) 0%, hsl(var(--leadac-h) var(--leadac-ns) 7%) 100%)",
          boxShadow:
            "0 1px 0 rgba(255,255,255,0.05) inset, 0 40px 80px -40px rgba(0,0,0,0.7)",
        }}
      >
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3
              className="text-[22px] font-semibold text-white italic tracking-tight leading-tight"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              Kazu Sushi
            </h3>
            <p className="mt-1.5 text-[13px] text-white/50">
              Sushi restaurant · London · Camden
            </p>
          </div>

          <span
            className="shrink-0 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold whitespace-nowrap"
            style={{
              border:
                "1px solid hsl(var(--leadac-h) var(--leadac-s) 50% / 0.40)",
              background: "hsl(var(--leadac-h) var(--leadac-s) 50% / 0.10)",
              color: "hsl(var(--leadac-h) var(--leadac-s) 78%)",
            }}
          >
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: "hsl(var(--leadac-h) var(--leadac-s) 65%)" }}
            />
            Fit score · 84/100
          </span>
        </header>

        <section className="mt-8">
          <p
            className="text-[10.5px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: "hsl(var(--leadac-h) var(--leadac-s) 65%)" }}
          >
            Detected signals
          </p>
          <ul className="mt-3 space-y-2.5">
            {SIGNALS.map((s) => (
              <li
                key={s.label}
                className="flex items-baseline gap-2.5 text-[13.5px] leading-snug"
              >
                <span
                  aria-hidden
                  className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{
                    background: "hsl(var(--leadac-h) var(--leadac-s) 60%)",
                  }}
                />
                <span>
                  <span className="text-white">{s.label}</span>
                  <span className="text-white/55">{" — "}{s.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8">
          <p
            className="text-[10.5px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: "hsl(var(--leadac-h) var(--leadac-s) 65%)" }}
          >
            Recommended angle
          </p>
          <span
            className="mt-3 inline-flex items-center rounded-full px-3 py-1 text-[12.5px] font-medium"
            style={{
              background: "hsl(var(--leadac-h) var(--leadac-s) 50% / 0.12)",
              color: "hsl(var(--leadac-h) var(--leadac-s) 80%)",
              border:
                "1px solid hsl(var(--leadac-h) var(--leadac-s) 50% / 0.28)",
            }}
          >
            Reservation optimization
          </span>
          <p className="mt-3 text-[13.5px] text-white/60 leading-relaxed">
            Strong demand signals. Low operational maturity around bookings.
            The opener leads with the gap, not the compliment.
          </p>
        </section>

        <section className="mt-8">
          <p
            className="text-[10.5px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: "hsl(var(--leadac-h) var(--leadac-s) 65%)" }}
          >
            Suggested opener
          </p>
          <blockquote
            className="mt-3 pl-4 italic text-[14px] text-white/80 leading-relaxed"
            style={{
              borderLeft:
                "2px solid hsl(var(--leadac-h) var(--leadac-s) 50% / 0.45)",
            }}
          >
            Saw 1.4k reviews on Kazu and a 4.6 average. The food is not the
            issue. Curious how you are handling the Friday-night reservation
            rush without an online widget. We help London sushi restaurants
            close that gap in a week.
          </blockquote>
        </section>
      </div>
    </Section>
  );
}
