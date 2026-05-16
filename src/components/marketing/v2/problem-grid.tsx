/**
 * Problem grid for the v2 marketing surface.
 *
 * Design intent: name the five recurring failures of local agency outbound
 * up front, before the product gets introduced. Five subtle bordered
 * cards on a responsive grid (1 / 2 / 5 cols). Each card is icon, title,
 * one short paragraph. No animation, no decoration beyond a small icon
 * chip. Sets up the resolution that the rest of the page provides.
 */
import * as React from "react";
import {
  Activity,
  ListOrdered,
  MessagesSquare,
  RefreshCw,
  Target,
  type LucideIcon,
} from "lucide-react";
import { Section } from "./section";

interface Item {
  icon: LucideIcon;
  title: string;
  body: string;
}

const ITEMS: Item[] = [
  {
    icon: Target,
    title: "Bad targeting",
    body: "Lists scraped from generic databases, recycled across hundreds of agencies. The same restaurants are pitched ten times a month.",
  },
  {
    icon: MessagesSquare,
    title: "Generic outreach",
    body: '"I noticed your website..." templates that every inbox already knows. Reply rates collapsed when AI personalization stopped sounding personal.',
  },
  {
    icon: Activity,
    title: "No buying-signal intelligence",
    body: "Most lists tell you a business exists. They do not tell you whether it is hiring, growing, struggling with reservations, or losing reviews.",
  },
  {
    icon: ListOrdered,
    title: "No prioritization",
    body: "100 leads in a spreadsheet, all the same shade of grey. The high-intent ones get the same generic email as the cold ones.",
  },
  {
    icon: RefreshCw,
    title: "No learning loop",
    body: "Last month's failed outreach teaches nothing. The next campaign repeats the same angle, the same opener, the same silence.",
  },
];

export function ProblemGrid() {
  return (
    <Section
      eyebrow="The problem"
      headline="Most local outbound fails before the first email."
      sub="Local agencies waste time pitching businesses that were never likely to buy."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <article
              key={item.title}
              className="rounded-2xl border border-white/[0.06] bg-[hsl(var(--leadac-h)_var(--leadac-ns)_9%)] p-5 transition-colors hover:border-white/[0.12]"
            >
              <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] mb-4"
                style={{
                  background: "hsl(var(--leadac-h) var(--leadac-s) 50% / 0.08)",
                  color: "hsl(var(--leadac-h) var(--leadac-s) 72%)",
                }}
              >
                <Icon className="h-4 w-4" />
              </span>
              <h3 className="text-[15px] font-semibold text-white leading-snug">
                {item.title}
              </h3>
              <p className="mt-2 text-[13px] text-white/55 leading-relaxed">
                {item.body}
              </p>
            </article>
          );
        })}
      </div>
    </Section>
  );
}
