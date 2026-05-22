/**
 * Verticals LeadAC speaks — the local-business segments our customers
 * sell into.
 *
 * Design intent: tell the reader which local-business verticals
 * LeadAC's account intelligence is calibrated for. Restaurant tech is
 * the live beachhead cohort — we are validating the model alongside a
 * first design-partner SaaS vendor in that segment. Field service /
 * HVAC, dental practice software, and legal practice management ship
 * next, each rendered with a small "Coming soon" pill so the
 * positioning stays honest without hiding the roadmap. Four cards on a
 * 2 / 4 col grid.
 */
import * as React from "react";
import {
  ChevronRight,
  Scale,
  Stethoscope,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Section } from "./section";

interface Vertical {
  icon: LucideIcon;
  name: string;
  summary: string;
  bullets: [string, string, string];
  status: "live" | "soon";
}

const VERTICALS: Vertical[] = [
  {
    icon: UtensilsCrossed,
    name: "Restaurant tech",
    summary:
      "For SaaS vendors selling POS, QR ordering, reservations, loyalty, and back-of-house systems to independent and small-chain restaurants. The live beachhead.",
    bullets: [
      "Cuisine, service model, single vs multi-location fit",
      "Detected POS / ordering / reservation / payments provider",
      "Review velocity, ordering-maturity, and digital-channel signals",
    ],
    status: "live",
  },
  {
    icon: Wrench,
    name: "Field service & HVAC",
    summary:
      "For SaaS vendors selling dispatch, CRM, billing, and ops to HVAC, plumbing, electrical, and field-service operators.",
    bullets: [
      "Technician headcount, service-area coverage, multi-location flags",
      "Detected dispatch / FSM stack (ServiceTitan, Housecall Pro, Jobber)",
      "Review velocity, response-time patterns, hiring signals",
    ],
    status: "soon",
  },
  {
    icon: Stethoscope,
    name: "Dental & healthcare",
    summary:
      "For SaaS vendors selling practice management, scheduling, billing, and patient acquisition into dental, vet, and allied health practices.",
    bullets: [
      "Practice size, multi-location and DSO signals",
      "Detected PMS / scheduling stack",
      "Patient-acquisition funnel and review patterns",
    ],
    status: "soon",
  },
  {
    icon: Scale,
    name: "Legal & professional services",
    summary:
      "For SaaS vendors selling case management, billing, and intake software into small-firm legal, accounting, and adjacent professional services.",
    bullets: [
      "Firm size, practice areas, geography fit",
      "Detected case-management or PM stack",
      "Intake funnel and online-presence patterns",
    ],
    status: "soon",
  },
];

export function UnderstandsGrid() {
  return (
    <Section
      eyebrow="Verticals we speak"
      headline="Calibrated for the local-business segments you sell into."
      sub="LeadAC's account intelligence is tuned per vertical — so a two-location independent restaurant and a regional HVAC chain are reasoned about with the right operational context, not generic firmographic noise."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {VERTICALS.map((vertical) => {
          const Icon = vertical.icon;
          const isLive = vertical.status === "live";
          return (
            <article
              key={vertical.name}
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
                {vertical.name}
              </h3>
              <p className="mt-1.5 text-[13.5px] text-white/65 leading-relaxed">
                {vertical.summary}
              </p>

              <div className="my-5 h-px bg-white/[0.06]" />

              <ul className="space-y-2">
                {vertical.bullets.map((b) => (
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
