/**
 * Niche economics grid for the v2 marketing surface.
 *
 * Design intent: prove the product understands F&B as a real category,
 * not as a generic "local business" abstraction. Five cards, one per
 * sub-niche, each with a small icon, niche name, one-line economic
 * frame, a thin separator, and three bullet markers for the specific
 * signals LeadAC reasons about. Five cards on a 3-col grid means the
 * fifth sits naturally on the bottom row.
 */
import * as React from "react";
import {
  Bike,
  ChevronRight,
  Coffee,
  Croissant,
  UtensilsCrossed,
  Wine,
  type LucideIcon,
} from "lucide-react";
import { Section } from "./section";

interface Niche {
  icon: LucideIcon;
  name: string;
  summary: string;
  bullets: [string, string, string];
}

const NICHES: Niche[] = [
  {
    icon: UtensilsCrossed,
    name: "Fine dining",
    summary: "Prestige and reservation flow drive the unit economics.",
    bullets: [
      "Reservation systems",
      "Prestige and review sensitivity",
      "Average ticket size",
    ],
  },
  {
    icon: Coffee,
    name: "Cafes",
    summary: "Local discovery and repeat foot traffic carry the business.",
    bullets: [
      "Local SEO and Google Maps",
      "Repeat customer behavior",
      "Mobile conversion paths",
    ],
  },
  {
    icon: Wine,
    name: "Bars",
    summary: "Late-night traffic and event nights swing the week.",
    bullets: [
      "Late-night foot traffic",
      "Event programming",
      "Social proof and Instagram",
    ],
  },
  {
    icon: Croissant,
    name: "Bakeries",
    summary: "Walk-ins and morning windows define the day.",
    bullets: [
      "Local SEO and listings",
      "Walk-in conversion",
      "Morning peak optimization",
    ],
  },
  {
    icon: Bike,
    name: "Ghost kitchens",
    summary: "Delivery platforms own the conversion funnel.",
    bullets: [
      "Delivery platform mix",
      "Conversion funnel design",
      "Average order value",
    ],
  },
];

export function UnderstandsGrid() {
  return (
    <Section
      eyebrow="What the AI understands"
      headline="Built for real local business economics."
      sub="Fine dining and a ghost kitchen do not earn money the same way. LeadAC reasons about each one with the right operational frame."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {NICHES.map((niche) => {
          const Icon = niche.icon;
          return (
            <article
              key={niche.name}
              className="rounded-2xl border border-white/[0.06] bg-[hsl(var(--leadac-h)_var(--leadac-ns)_9%)] p-6 transition-colors hover:border-white/[0.12]"
            >
              <span
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06]"
                style={{
                  background: "hsl(var(--leadac-h) var(--leadac-s) 50% / 0.08)",
                  color: "hsl(var(--leadac-h) var(--leadac-s) 72%)",
                }}
              >
                <Icon className="h-4 w-4" />
              </span>

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
