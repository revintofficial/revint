/**
 * PreCallBrief — single artifact end-to-end, ending in the first 30 seconds of the call.
 *
 * Renamed from `DossierProof` per the F&B BD cold-call pod RFC at
 * `.agents/homepage-strategist/proposals/2026-05-20-homepage-rfc-fnb-bd-cold-call-pod-v0.1.md`.
 * Same single-artifact-card grammar (centered max-w-2xl, score badge, signals
 * list) but the closer block is now a talk track the rep can read off the
 * screen when the GM picks up, not an email opener.
 */
import * as React from "react";
import { Section } from "./section";

interface Signal {
  label: string;
  detail: string;
  tag: "talk-track ready" | "objection cover" | "rapport opener" | "why now";
}

const SIGNALS: Signal[] = [
  {
    label: "Why now",
    detail: "3 of last 30 reviews cite slow Friday service",
    tag: "why now",
  },
  {
    label: "High review volume",
    detail: "1.4k reviews, 4.6 avg",
    tag: "talk-track ready",
  },
  {
    label: "Weak reservation funnel",
    detail: "no online booking widget, phone-only",
    tag: "talk-track ready",
  },
  {
    label: "No response strategy",
    detail: "zero owner replies on negative reviews in 90 days",
    tag: "objection cover",
  },
  {
    label: "High Instagram activity",
    detail: "3.2k followers, 4 posts per week",
    tag: "rapport opener",
  },
];

export function PreCallBrief() {
  return (
    <Section
      eyebrow="The brief"
      headline="One restaurant, one brief, the first 30 seconds."
      sub="This is what lands in your rep's tab before the dial. The talk track at the bottom is what they open the call with."
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
                <span className="flex-1">
                  <span className="text-white">{s.label}</span>
                  <span className="text-white/55">{" "}·{" "}{s.detail}</span>
                </span>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider whitespace-nowrap"
                  style={{
                    background:
                      "hsl(var(--leadac-h) var(--leadac-s) 50% / 0.10)",
                    color: "hsl(var(--leadac-h) var(--leadac-s) 78%)",
                  }}
                >
                  {s.tag}
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
            The talk track leads with the Friday-night gap, not the food
            compliment.
          </p>
        </section>

        <section className="mt-8">
          <p
            className="text-[10.5px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: "hsl(var(--leadac-h) var(--leadac-s) 65%)" }}
          >
            First 30 seconds
          </p>
          <blockquote
            className="mt-3 pl-4 italic text-[14px] text-white/80 leading-relaxed"
            style={{
              borderLeft:
                "2px solid hsl(var(--leadac-h) var(--leadac-s) 50% / 0.45)",
            }}
          >
            Sarah, this is [REP]. Saw 1.4k reviews on Kazu and three Friday
            reviews this month flagging the wait at the door. We help London
            sushi restaurants pull that Friday wait down to ten minutes
            without hiring a host. Do you have ninety seconds?
          </blockquote>
        </section>
      </div>
    </Section>
  );
}
