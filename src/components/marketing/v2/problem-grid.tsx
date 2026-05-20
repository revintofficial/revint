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
  Clock,
  Layers,
  MessagesSquare,
  Phone,
  RefreshCw,
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
    icon: Clock,
    title: "Eighty percent of the morning goes to research.",
    body: "Each rep manually scans new restaurants for hours, then dials with five minutes of context. The math caps the pod at 30 to 40 prospects a rep a day.",
  },
  {
    icon: MessagesSquare,
    title: "Generic call openers.",
    body: "Without a fresh signal from the restaurant's own site or reviews, the first 30 seconds sound like every other vendor that called this week. The GM hangs up.",
  },
  {
    icon: Layers,
    title: "No shared call dispositions across the pod.",
    body: "Voicemail, no-answer, wrong-number, interested. Without one shared chip-set, the pod's activity does not aggregate into a single weekly view.",
  },
  {
    icon: RefreshCw,
    title: "Repeat-call risk.",
    body: "Two reps dial the same restaurant a week apart because the activity feed lives in HubSpot and no one opens it before the morning queue.",
  },
  {
    icon: Phone,
    title: "A dialer that knows the number, not the restaurant.",
    body: "Aircall dials fine. It does not know that the restaurant in front of the rep has 1.4k reviews and no online booking. The rep does, but only if they did the research.",
  },
];

export function ProblemGrid() {
  return (
    <Section
      eyebrow="The problem"
      headline="Most BD pod mornings die in research."
      sub="The dial works. The dialer does not know who it is calling."
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
