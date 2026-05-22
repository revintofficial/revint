/**
 * Platform layer explainer for the v2 marketing surface.
 *
 * Design intent: position LeadAC as one model with four layers, not a
 * list of features. Four blocks (Graph / Patterns / Execution /
 * Learning) on a 2x2 grid at lg+, each with a numbered chip, a
 * sentence-case heading, a short paragraph, and a small static
 * "internal labels" card that hints at the actual signals each layer
 * works with. The card uses tinted chips so the visual reads as data
 * without leaning on a real screenshot. Pure server, no animation.
 */
import * as React from "react";
import { Section } from "./section";

interface Block {
  number: string;
  title: string;
  copy: string;
  rows: Array<{ label: string; chip: string }>;
}

const BLOCKS: Block[] = [
  {
    number: "01",
    title: "Graph",
    copy: "Live niche context. Businesses, outreach history, and conversion patterns refreshed after every interaction. Nothing to migrate.",
    rows: [
      { label: "Businesses in graph", chip: "1,420" },
      { label: "Outreach threads", chip: "Live sync" },
      { label: "Reviews ingested", chip: "26k / niche" },
      { label: "Refresh cadence", chip: "Per interaction" },
    ],
  },
  {
    number: "02",
    title: "Patterns",
    copy: "Reply and conversion patterns that aggregate. Every outbound interaction feeds the model. Recurring objections, winning messaging, and timing behavior surface at the portfolio level.",
    rows: [
      { label: "Recurring objections", chip: "12 clustered" },
      { label: "Winning angles", chip: "4 reinforced" },
      { label: "Best-send window", chip: "Tue 10:40" },
      { label: "Segment-level stall", chip: "Detected" },
    ],
  },
  {
    number: "03",
    title: "Execution",
    copy: "Evidence where SDRs work. Messaging recommendations, outreach angles, scoring, and follow-up timing generated from the same model campaigns operate on.",
    rows: [
      { label: "Fit score 0–100", chip: "84" },
      { label: "Recommended angle", chip: "Friday gap" },
      { label: "Next action", chip: "Call · 30s opener" },
      { label: "Follow-up timing", chip: "+3 days" },
    ],
  },
  {
    number: "04",
    title: "Learning",
    copy: "Outcome intelligence that compounds. The system learns which niches convert, which offers perform, and which outreach patterns create meetings. Reinforced. Pruned.",
    rows: [
      { label: "Reply rate, niche", chip: "+14%" },
      { label: "Meetings, 30d", chip: "+9" },
      { label: "Pruned patterns", chip: "6" },
      { label: "Ramp delta", chip: "−38%" },
    ],
  },
];

export function HowItThinks() {
  return (
    <Section
      id="platform"
      eyebrow="Platform"
      headline="Outreach, enrichment, and revenue intelligence in one model."
      sub="LeadAC reads reviews, websites, social activity, outreach outcomes, and operational behavior. The system assembles a graph of niches, messaging patterns, buying behavior, and conversion outcomes agencies operate from."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {BLOCKS.map((block) => (
          <article
            key={block.number}
            className="rounded-2xl border border-white/[0.06] bg-[hsl(var(--leadac-h)_var(--leadac-ns)_8%)] p-6 md:p-7"
          >
            <span
              className="inline-flex items-center justify-center h-7 px-2.5 rounded-md text-[11px] font-mono font-semibold tracking-wider"
              style={{
                background: "hsl(var(--leadac-h) var(--leadac-s) 50% / 0.10)",
                color: "hsl(var(--leadac-h) var(--leadac-s) 72%)",
                border:
                  "1px solid hsl(var(--leadac-h) var(--leadac-s) 50% / 0.22)",
              }}
            >
              {block.number}
            </span>

            <h3 className="mt-5 text-[24px] font-semibold text-white tracking-tight">
              {block.title}
            </h3>
            <p className="mt-3 text-[14.5px] text-white/65 leading-relaxed">
              {block.copy}
            </p>

            <div className="mt-6 rounded-xl border border-white/[0.05] bg-black/30 p-4">
              <ul className="divide-y divide-white/[0.04]">
                {block.rows.map((row) => (
                  <li
                    key={row.label}
                    className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
                  >
                    <span className="text-[12.5px] text-white/55">
                      {row.label}
                    </span>
                    <span
                      className="rounded-md px-2 py-0.5 text-[11.5px] font-medium"
                      style={{
                        background:
                          "hsl(var(--leadac-h) var(--leadac-s) 50% / 0.10)",
                        color: "hsl(var(--leadac-h) var(--leadac-s) 78%)",
                      }}
                    >
                      {row.chip}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </Section>
  );
}
