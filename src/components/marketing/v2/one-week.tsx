/**
 * One week to execution — 3-step onboarding strip.
 *
 * Design intent: collapse the time-to-value question into a calm
 * three-card track. Connect the stack, build the graph, operate on
 * intelligence. Numbered chip + sentence-case heading + short body,
 * matching the chip grammar used elsewhere on the page. Pure server,
 * no animation, mirrors the "Why outbound stalls" three-column grid.
 */
import * as React from "react";
import {
  Cable,
  Network,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Section } from "./section";

interface Step {
  number: string;
  icon: LucideIcon;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    number: "01",
    icon: Cable,
    title: "Connect your CRM.",
    body: "OAuth into HubSpot, Salesforce, Pipedrive, or Close. Read-only first if your security team needs it. About 90 seconds.",
  },
  {
    number: "02",
    icon: Network,
    title: "Write your ICP in plain English.",
    body: 'Vertical, geography, size, signals you care about. "8-location Italian restaurants on Square, no online ordering, growing footprint." Five minutes.',
  },
  {
    number: "03",
    icon: Sparkles,
    title: "Get the first 200 accounts.",
    body: "Inside an hour they land in your CRM, enriched with local context your reps usually research by hand. Closed-loop kicks in after the first ten deals you log.",
  },
];

export function OneWeek() {
  return (
    <Section
      id="one-week"
      eyebrow="From signature to first list"
      headline="Connect your CRM. Get a usable list inside an hour."
      sub="We are not asking your team to migrate, learn a new app, or change their cadence. Revint reads what is already in your CRM and writes the enriched accounts back into the same records your team opens every morning."
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {STEPS.map((step) => {
          const Icon = step.icon;
          return (
            <article
              key={step.number}
              className="rounded-2xl border border-white/[0.06] bg-[hsl(var(--revint-h)_var(--revint-ns)_9%)] p-6 transition-colors hover:border-white/[0.12]"
            >
              <div className="flex items-center gap-3 mb-5">
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06]"
                  style={{
                    background:
                      "hsl(var(--revint-h) var(--revint-s) 50% / 0.08)",
                    color: "hsl(var(--revint-h) var(--revint-s) 72%)",
                  }}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span
                  className="text-[11px] font-mono font-semibold tracking-wider"
                  style={{ color: "hsl(var(--revint-h) var(--revint-s) 70%)" }}
                >
                  {step.number}
                </span>
              </div>
              <h3 className="text-[16px] font-semibold text-white leading-snug">
                {step.title}
              </h3>
              <p className="mt-2.5 text-[13.5px] text-white/60 leading-relaxed">
                {step.body}
              </p>
            </article>
          );
        })}
      </div>
    </Section>
  );
}
