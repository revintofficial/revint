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
  AppWindow,
  Brain,
  RotateCcw,
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
    icon: AppWindow,
    title: "Every account starts from zero.",
    body: "Apollo hands over a name and a phone number. The rest, the rep stitches together by hand. POS detection, review pattern, location count, owner LinkedIn, last menu update. Twenty to forty minutes per account, every account, every morning. None of that work compounds anywhere a teammate can read it tomorrow.",
  },
  {
    index: "02",
    icon: Brain,
    title: "Your best rep is your only memory.",
    body: "After six months, a senior SDR can feel which two-location Italian on Square POS will say yes, and which one will go quiet on the second call. That intuition lives in one person. It does not exist as a field, a tag, or a report. When they take the offer at another company, the company starts over.",
  },
  {
    index: "03",
    icon: RotateCcw,
    title: "Every new niche resets the company.",
    body: "What the team learned about independent restaurants does not transfer to dental practices, or to boutique hotels, or to HVAC. The next batch of SDRs researches the same way the first one did. Three months in, the team starts to feel it again. The infrastructure underneath has not changed.",
  },
];

export function ProblemGrid() {
  return (
    <Section
      eyebrow="Why the stack stalls"
      headline={
        <>
          SDR teams learn.
          <br />
          Systems don&apos;t.
        </>
      }
      sub="A new SDR opens Apollo, Clay, the CRM, LinkedIn, Maps, and ChatGPT before they make the first dial. Six tabs that move data. None of them remember what the last rep figured out the hard way. The learning lives in one human head, and when that head walks out the door it walks out with them."
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <article
              key={item.title}
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
