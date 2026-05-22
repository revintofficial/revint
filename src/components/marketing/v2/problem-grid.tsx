/**
 * Problem grid for the v2 marketing surface.
 *
 * Design intent: name the three structural failures of selling into
 * local-business verticals as a SaaS vendor — before the platform is
 * introduced. Three bordered cards on a responsive grid (1 / 3 cols).
 * Each card is icon, title, one short paragraph. Sets up the platform
 * layers that the rest of the page resolves. No animation, no
 * decoration beyond a small icon chip.
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
    title: "Apollo doesn't speak vertical.",
    body: "Firmographic filters don't know if an independent restaurant runs two locations, which POS it uses, whether it has QR ordering live, or how its review velocity is trending. So SDRs rebuild that context account by account, and it costs them 20 to 40 minutes per prospect.",
  },
  {
    index: "02",
    icon: Layers,
    title: "Win and loss reasons never aggregate.",
    body: "Closed-won and closed-lost reasons stay locked inside individual deals. Recurring objections, segment-level stalls, and proof points that close show up nowhere outside top reps' heads. Leadership cannot see which patterns to fix.",
  },
  {
    index: "03",
    icon: Unplug,
    title: "Account intelligence sits outside the CRM.",
    body: "Enrichment, signal, and outbound research live in scattered tabs and spreadsheets. The CRM has the deal, the team has the context, and the two never meet. By the time a VP sees the gap, the quarter has already compressed on price.",
  },
];

export function ProblemGrid() {
  return (
    <Section
      eyebrow="Why local-vertical deals slip"
      headline="Activity is captured. Execution gaps are not."
      sub="Apollo gives you a list. Gong gives you transcripts. CRMs log activity. The signals that actually decide whether a local-business account closes are vertical context, account-level evidence, and what changed since the last touch, and they stay trapped in SDR research and top-rep intuition."
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
