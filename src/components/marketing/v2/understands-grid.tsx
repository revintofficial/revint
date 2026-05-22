/**
 * Who runs on LeadAC — niches grid.
 *
 * Design intent: tell the reader who LeadAC was built for in concrete
 * verticals where niche understanding, outreach execution, and
 * conversion performance determine growth. F&B is the live cohort.
 * Medspa, Home Services, and Fitness ship next — they render with
 * a small "Coming soon" pill so the positioning is honest without
 * hiding the roadmap. Four cards on a 2 / 4 col grid.
 */
import * as React from "react";
import {
  ChevronRight,
  Dumbbell,
  Sparkles,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Section } from "./section";

interface Niche {
  icon: LucideIcon;
  name: string;
  summary: string;
  bullets: [string, string, string];
  status: "live" | "soon";
}

const NICHES: Niche[] = [
  {
    icon: UtensilsCrossed,
    name: "F&B",
    summary:
      "Restaurants, cafes, bakeries, bars, brunch spots, ghost kitchens. The live cohort.",
    bullets: [
      "Reservation and ordering maturity per location",
      "Review velocity and Friday-night service patterns",
      "Sub-niche fit, from fine dining to ghost kitchens",
    ],
    status: "live",
  },
  {
    icon: Sparkles,
    name: "Medspa",
    summary:
      "High-frequency outbound, visible operational gaps, localized acquisition.",
    bullets: [
      "Treatment menu coverage and pricing surfacing",
      "Booking and consult funnel maturity",
      "Local intent and seasonality patterns",
    ],
    status: "soon",
  },
  {
    icon: Wrench,
    name: "Home services",
    summary:
      "Repeatable outreach patterns, service-area targeting, conversion optimization.",
    bullets: [
      "Service-area and territory coverage",
      "Estimate-to-job conversion behavior",
      "Reputation and response-time patterns",
    ],
    status: "soon",
  },
  {
    icon: Dumbbell,
    name: "Fitness",
    summary:
      "Membership-driven acquisition, local intent behavior, operational timing patterns.",
    bullets: [
      "Class schedule and trial-funnel quality",
      "Membership pricing visibility and cohorts",
      "Local intent and peak-hour patterns",
    ],
    status: "soon",
  },
];

export function UnderstandsGrid() {
  return (
    <Section
      eyebrow="Who runs on LeadAC"
      headline="Agencies running local business acquisition."
      sub="Built for outbound teams where niche understanding, outreach execution, and conversion performance determine growth."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {NICHES.map((niche) => {
          const Icon = niche.icon;
          const isLive = niche.status === "live";
          return (
            <article
              key={niche.name}
              className="rounded-2xl border border-white/[0.06] bg-[hsl(var(--leadac-h)_var(--leadac-ns)_9%)] p-6 transition-colors hover:border-white/[0.12]"
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06]"
                  style={{
                    background:
                      "hsl(var(--leadac-h) var(--leadac-s) 50% / 0.08)",
                    color: "hsl(var(--leadac-h) var(--leadac-s) 72%)",
                  }}
                >
                  <Icon className="h-4 w-4" />
                </span>

                {isLive ? (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider"
                    style={{
                      background:
                        "hsl(var(--leadac-h) var(--leadac-s) 50% / 0.12)",
                      color: "hsl(var(--leadac-h) var(--leadac-s) 78%)",
                      border:
                        "1px solid hsl(var(--leadac-h) var(--leadac-s) 50% / 0.30)",
                    }}
                  >
                    <span
                      aria-hidden
                      className="inline-block h-1.5 w-1.5 rounded-full animate-pulse motion-reduce:animate-none"
                      style={{
                        background: "hsl(var(--leadac-h) var(--leadac-s) 70%)",
                      }}
                    />
                    Live
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-white/55 border border-white/15 bg-white/[0.03]"
                  >
                    Coming soon
                  </span>
                )}
              </div>

              <h3 className="mt-4 text-[17px] font-semibold text-white">
                {niche.name}
              </h3>
              <p className="mt-1.5 text-[13.5px] text-white/65 leading-relaxed">
                {niche.summary}
              </p>

              <div className="my-5 h-px bg-white/[0.06]" />

              <ul className="space-y-2">
                {niche.bullets.map((b) => (
                  <li
                    key={b}
                    className="flex items-start gap-2 text-[13px] text-white/70 leading-snug"
                  >
                    <ChevronRight
                      className="h-3.5 w-3.5 mt-0.5 shrink-0"
                      style={{
                        color: "hsl(var(--leadac-h) var(--leadac-s) 60%)",
                      }}
                    />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </Section>
  );
}
