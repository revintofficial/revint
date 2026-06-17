/**
 * Waitlist section for the v2 marketing surface.
 *
 * Pricing is intentionally not public during the pre-launch window —
 * we shape plans alongside the first cohort of vertical SaaS GTM
 * teams. This block replaces the homepage pricing section with a
 * calm, single-purpose email capture, framed in the same tone as the
 * rest of the page.
 *
 * Server section + client form. The form lives in its own client
 * component (`waitlist-form.tsx`) so this block stays a server tree.
 */
import * as React from "react";
import { Section } from "./section";
import { WaitlistForm } from "./waitlist-form";

export function WaitlistBlock() {
  return (
    <Section
      id="waitlist"
      variant="soft"
      eyebrow="Get in early"
      headline="We are shaping plans with the first ten teams."
      sub="Pricing is not public yet. We are co-designing it with the first cohort of vertical SaaS teams on the list. Drop your email and you get the first slot, plus a sample brief built for your vertical before the call."
    >
      <div className="grid gap-10 lg:gap-14 lg:grid-cols-[1.1fr_1fr] lg:items-start max-w-5xl">
        <div
          className="rounded-3xl p-7 md:p-9"
          style={{
            background:
              "linear-gradient(180deg, hsl(var(--revint-h) var(--revint-ns) 11%), hsl(var(--revint-h) var(--revint-ns) 8%))",
            border: "0.5px solid rgba(255,255,255,0.08)",
            boxShadow:
              "0 1px 0 rgba(255,255,255,0.04) inset, 0 24px 60px rgba(0,0,0,0.4)",
          }}
        >
          <WaitlistForm />
        </div>

        <ul className="flex flex-col gap-5 pt-2">
          {[
            {
              title: "Sample brief before any commitment.",
              body: "Reply to the confirmation with your ICP. We build a sample account graph for your vertical before the call, so you walk away with real account intelligence either way.",
            },
            {
              title: "Cohort pricing for the first ten.",
              body: "Plans and limits are being co-designed with the first ten teams. Early access locks the cohort rate for as long as you stay.",
            },
            {
              title: "Restaurant tech is live. Three more verticals next.",
              body: "We are validating the model with a restaurant-tech SaaS in production. Field service, dental practice software, and legal practice management ship next. Join the list and we will save you the slot.",
            },
          ].map((item) => (
            <li key={item.title} className="flex gap-3">
              <span
                aria-hidden
                className="mt-2 inline-block h-1.5 w-1.5 rounded-full shrink-0"
                style={{
                  background: "hsl(var(--revint-h) var(--revint-s) 60%)",
                }}
              />
              <div>
                <p className="text-[14.5px] font-semibold text-white tracking-tight">
                  {item.title}
                </p>
                <p className="mt-1 text-[13.5px] text-white/55 leading-relaxed">
                  {item.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
