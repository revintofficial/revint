/**
 * Three-audience chip cards for the v2 marketing surface.
 *
 * Design intent: tell the reader who LeadAC was built for in three
 * concrete operator types. Small icon, label, one-line description.
 * No bullets, no decoration. Pure server.
 */
import * as React from "react";
import { Building2, ChefHat, Headset, type LucideIcon } from "lucide-react";
import { Section } from "./section";

interface Chip {
  icon: LucideIcon;
  label: string;
  body: string;
}

const CHIPS: Chip[] = [
  {
    icon: Building2,
    label: "Local growth agencies",
    body: "Selling SEO, web, and review work to restaurants and local services.",
  },
  {
    icon: Headset,
    label: "SDR teams",
    body: "Running outbound for vertical SaaS like reservations, POS, and reviews.",
  },
  {
    icon: ChefHat,
    label: "Restaurant marketing operators",
    body: "In-house marketing leads at multi-location F&B brands.",
  },
];

export function BuiltFor() {
  return (
    <Section
      eyebrow="Built for"
      headline="Three teams, one system."
      sub="LeadAC was built for the operators who pitch local businesses every day."
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {CHIPS.map((chip) => {
          const Icon = chip.icon;
          return (
            <article
              key={chip.label}
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
              <h3 className="mt-4 text-[16px] font-semibold text-white">
                {chip.label}
              </h3>
              <p className="mt-1.5 text-[13.5px] text-white/55 leading-relaxed">
                {chip.body}
              </p>
            </article>
          );
        })}
      </div>
    </Section>
  );
}
