/**
 * Problem grid for the v2 marketing surface.
 *
 * Design intent: name the three structural failures of agency outbound
 * up front, before the platform is introduced. Three bordered cards on
 * a responsive grid (1 / 3 cols). Each card is icon, title, one short
 * paragraph. Sets up the platform layers that the rest of the page
 * resolves. No animation, no decoration beyond a small icon chip.
 */
import * as React from "react";
import {
  History,
  Layers,
  Unplug,
  type LucideIcon,
} from "lucide-react";
import { Section } from "./section";

interface Item {
  index: string;
  icon: LucideIcon;
  title: string;
  body: string;
}

const ITEMS: Item[] = [
  {
    index: "01",
    icon: History,
    title: "Ramp time resets every hire.",
    body: "The playbook lives in outreach threads, CRM notes, and top SDR intuition. New reps rebuild the motion campaign by campaign. Time to first booked meeting stretches.",
  },
  {
    index: "02",
    icon: Layers,
    title: "Win patterns never aggregate.",
    body: "Replies, objections, timing patterns, and conversion behavior stay trapped in individual sequences. Teams cannot see which outreach patterns actually move revenue.",
  },
  {
    index: "03",
    icon: Unplug,
    title: "Outreach execution breaks across systems.",
    body: "Enrichment, scoring, messaging, and sequencing operate separately. The system never learns which workflows create pipeline. By the time a team sees the gap, the niche already stopped converting.",
  },
];

export function ProblemGrid() {
  return (
    <Section
      eyebrow="Why outbound stalls"
      headline="Activity is captured. Learning is not."
      sub="Outbound tools send sequences. CRMs log activity. Enrichment tools collect data. The patterns that determine conversion stay trapped in SDR habits, disconnected campaigns, and lost outreach threads."
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <article
              key={item.title}
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
                  {item.index}
                </span>
              </div>
              <h3 className="text-[16px] font-semibold text-white leading-snug">
                {item.title}
              </h3>
              <p className="mt-2.5 text-[13.5px] text-white/60 leading-relaxed">
                {item.body}
              </p>
            </article>
          );
        })}
      </div>
    </Section>
  );
}
