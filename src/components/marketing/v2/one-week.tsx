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
    body: "HubSpot, Salesforce, Pipedrive, Close. We read closed-won, closed-lost, and open pipeline in place. Nothing to migrate.",
  },
  {
    number: "02",
    icon: Network,
    title: "Build the account graph.",
    body: "Per-vertical local-business accounts, detected stacks, review signals, hiring signals, and your sales history. One model, refreshed after every CRM sync.",
  },
  {
    number: "03",
    icon: Sparkles,
    title: "Operate on intelligence.",
    body: "Vertical-aware account lists, CRM-native account briefs, and a closed loop where every won and lost deal sharpens the next target list.",
  },
];

export function OneWeek() {
  return (
    <Section
      id="one-week"
      eyebrow="One week to evidence"
      headline="Connect the stack. Run revenue on the model."
      sub="Connect what you already use. Inside a week, LeadAC reads your CRM and turns your deals into revenue intelligence your team can operate on. Generic agents draft. LeadAC knows how the account buys, what stack it runs, and what changed since the last touch."
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {STEPS.map((step) => {
          const Icon = step.icon;
          return (
            <article
              key={step.number}
              className="rounded-2xl border border-white/[0.06] bg-[hsl(var(--leadac-h)_var(--leadac-ns)_9%)] p-6 transition-colors hover:border-white/[0.12]"
            >
              <div className="flex items-center gap-3 mb-5">
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06]"
                  style={{
                    background:
                      "hsl(var(--leadac-h) var(--leadac-s) 50% / 0.08)",
                    color: "hsl(var(--leadac-h) var(--leadac-s) 72%)",
                  }}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span
                  className="text-[11px] font-mono font-semibold tracking-wider"
                  style={{ color: "hsl(var(--leadac-h) var(--leadac-s) 70%)" }}
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
