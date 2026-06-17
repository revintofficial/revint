/**
 * PreCallBrief — single artifact end-to-end, ending in the first 30
 * seconds of the call.
 *
 * Same single-artifact-card grammar (centered max-w-2xl, score badge,
 * signals list) but reframed for the new positioning: the prospect is
 * a target account for a vertical SaaS vendor's SDR. Beachhead
 * vertical is restaurant tech, so the example here is a restaurant-
 * tech SaaS vendor's SDR calling an independent multi-location
 * Italian restaurant. Closer block is a talk track the rep can read
 * off the screen when the operator picks up.
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
    detail: "menu-card complaints up 38% in last 30 reviews",
    tag: "why now",
  },
  {
    label: "Detected stack",
    detail: "Square POS · no QR-ordering, no reservation widget",
    tag: "talk-track ready",
  },
  {
    label: "Multi-location signal",
    detail: "2 locations live, third opening flagged on Instagram",
    tag: "talk-track ready",
  },
  {
    label: "High demand",
    detail: "1.5k reviews, 4.5 avg, weekend wait times rising",
    tag: "rapport opener",
  },
  {
    label: "No online ordering",
    detail: "phone-only — direct-channel margin angle open",
    tag: "objection cover",
  },
];

export function PreCallBrief() {
  return (
    <Section
      eyebrow="Execution"
      headline="Evidence where SDRs and AEs work."
      sub="One account. One brief. The first 30 seconds of the call. The same graph your VP of Sales operates on hands the rep the why-now signal, the detected stack, the recommended angle, and the opener, all before the dial. Then it writes back into HubSpot or Salesforce when the call ends."
    >
      <div
        className="relative mx-auto max-w-2xl rounded-3xl border border-white/[0.07] p-7 md:p-9"
        style={{
          background:
            "linear-gradient(180deg, hsl(var(--revint-h) var(--revint-ns) 10%) 0%, hsl(var(--revint-h) var(--revint-ns) 7%) 100%)",
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
              Cucina 47
            </h3>
            <p className="mt-1.5 text-[13px] text-white/50">
              Italian · casual dining · 2 locations · on Square POS
            </p>
          </div>

          <span
            className="shrink-0 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold whitespace-nowrap"
            style={{
              border:
                "1px solid hsl(var(--revint-h) var(--revint-s) 50% / 0.40)",
              background: "hsl(var(--revint-h) var(--revint-s) 50% / 0.10)",
              color: "hsl(var(--revint-h) var(--revint-s) 78%)",
            }}
          >
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: "hsl(var(--revint-h) var(--revint-s) 65%)" }}
            />
            Fit score · 84/100
          </span>
        </header>

        <section className="mt-8">
          <p
            className="text-[10.5px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: "hsl(var(--revint-h) var(--revint-s) 65%)" }}
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
                    background: "hsl(var(--revint-h) var(--revint-s) 60%)",
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
                      "hsl(var(--revint-h) var(--revint-s) 50% / 0.10)",
                    color: "hsl(var(--revint-h) var(--revint-s) 78%)",
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
            style={{ color: "hsl(var(--revint-h) var(--revint-s) 65%)" }}
          >
            Recommended angle
          </p>
          <span
            className="mt-3 inline-flex items-center rounded-full px-3 py-1 text-[12.5px] font-medium"
            style={{
              background: "hsl(var(--revint-h) var(--revint-s) 50% / 0.12)",
              color: "hsl(var(--revint-h) var(--revint-s) 80%)",
              border:
                "1px solid hsl(var(--revint-h) var(--revint-s) 50% / 0.28)",
            }}
          >
            QR ordering · direct-channel margin
          </span>
          <p className="mt-3 text-[13.5px] text-white/60 leading-relaxed">
            Strong demand signals, growing footprint, no QR menu or online
            ordering. The talk track leads with the weekend wait + margin
            angle their reviews surface, not generic discovery.
          </p>
        </section>

        <section className="mt-8">
          <p
            className="text-[10.5px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: "hsl(var(--revint-h) var(--revint-s) 65%)" }}
          >
            First 30 seconds
          </p>
          <blockquote
            className="mt-3 pl-4 italic text-[14px] text-white/80 leading-relaxed"
            style={{
              borderLeft:
                "2px solid hsl(var(--revint-h) var(--revint-s) 50% / 0.45)",
            }}
          >
            Sarah, this is [REP]. Saw Cucina&apos;s second location is hitting
            1.5k reviews and a handful of recent ones flag the wait at the
            door. We help independent restaurants on Square pull weekend
            wait down with QR ordering — and keep the delivery margin on
            your side. Do you have ninety seconds?
          </blockquote>
        </section>
      </div>
    </Section>
  );
}
