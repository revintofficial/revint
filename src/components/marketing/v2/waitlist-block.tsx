/**
 * Waitlist section for the v2 marketing surface.
 *
 * Pricing is intentionally not public during the pre-launch window —
 * we shape plans alongside the first cohort of agencies. This block
 * replaces the homepage pricing section with a calm, single-purpose
 * email capture, framed in the same tone as the rest of the page.
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
      eyebrow="Waitlist"
      headline="Get in early."
      sub="We're shaping plans with the first cohort of agencies before opening pricing publicly. Drop your email and you'll get the first slot when we open the gates."
    >
      <div className="grid gap-10 lg:gap-14 lg:grid-cols-[1.1fr_1fr] lg:items-start max-w-5xl">
        <div
          className="rounded-3xl p-7 md:p-9"
          style={{
            background:
              "linear-gradient(180deg, hsl(var(--leadac-h) var(--leadac-ns) 11%), hsl(var(--leadac-h) var(--leadac-ns) 8%))",
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
              title: "Audit before you commit.",
              body: "Reply to the confirmation with a postcode + niche. We run the audit before a 15-min call so you walk away with a real shortlist either way.",
            },
            {
              title: "First cohort sets the price.",
              body: "Plans, packaging, and limits are being co-designed with the first agencies on the list. Early access locks the cohort rate.",
            },
            {
              title: "Built for restaurants and the F&B vertical.",
              body: "We're tuned for fine dining, cafes, bars, bakeries, and ghost kitchens. If you sell to a different local vertical, the system still works — but the playbook depth is real here.",
            },
          ].map((item) => (
            <li key={item.title} className="flex gap-3">
              <span
                aria-hidden
                className="mt-2 inline-block h-1.5 w-1.5 rounded-full shrink-0"
                style={{
                  background: "hsl(var(--leadac-h) var(--leadac-s) 60%)",
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
