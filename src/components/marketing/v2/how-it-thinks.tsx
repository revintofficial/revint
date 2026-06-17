/**
 * Platform layer explainer for the v2 marketing surface.
 *
 * Design intent: position Revint as one model with four layers, not a
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
    title: "Account graph",
    copy: "Live account context per vertical. Local businesses, their operational profile, the stack they run, and your sales history with them — refreshed after every interaction. Nothing to migrate.",
    rows: [
      { label: "Accounts in graph", chip: "1,420" },
      { label: "Detected stacks / account", chip: "Square POS +6" },
      { label: "Reviews ingested", chip: "26k / vertical" },
      { label: "Refresh cadence", chip: "Per interaction" },
    ],
  },
  {
    number: "02",
    title: "Patterns",
    copy: "Win and loss reasons that aggregate. Every closed deal feeds the model. Recurring objections, segment-level stalls, and proof points that close surface at the portfolio level — not trapped in one rep's head.",
    rows: [
      { label: "Recurring objections", chip: "12 clustered" },
      { label: "Winning proof points", chip: "4 reinforced" },
      { label: "Segment-level stall", chip: "Detected" },
      { label: "ICP refinement", chip: "Auto" },
    ],
  },
  {
    number: "03",
    title: "Execution",
    copy: "Evidence where SDRs and AEs work. CRM-native account briefs, recommended outreach angles, account scoring, and next-step recommendations all come out of the same model leadership operates on.",
    rows: [
      { label: "Fit score 0–100", chip: "84" },
      { label: "Recommended angle", chip: "Dispatch upgrade" },
      { label: "Next action", chip: "Call · 30s opener" },
      { label: "Writes to", chip: "HubSpot / SF" },
    ],
  },
  {
    number: "04",
    title: "Closed-loop learning",
    copy: "Outcome intelligence that compounds per workspace. The system learns which vertical sub-segments convert, which proof points close, and which accounts to prioritise next. What works gets reinforced. What doesn't gets pruned. The next list gets re-targeted.",
    rows: [
      { label: "Reply rate, vertical", chip: "+14%" },
      { label: "Pipeline created, 30d", chip: "+9" },
      { label: "Pruned segments", chip: "6" },
      { label: "SDR ramp delta", chip: "−38%" },
    ],
  },
];

export function HowItThinks() {
  return (
    <Section
      id="platform"
      eyebrow="Platform"
      headline="Account, vertical, and deal history in one model."
      sub="Revint reads CRM, enrichment, reviews, websites, and detected vertical stacks. The system assembles a graph of accounts, buying signals, and outcomes your SDRs run on and your VP of Sales operates from."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {BLOCKS.map((block) => (
          <article
            key={block.number}
            className="rounded-2xl border border-white/[0.06] bg-[hsl(var(--revint-h)_var(--revint-ns)_8%)] p-6 md:p-7"
          >
            <span
              className="inline-flex items-center justify-center h-7 px-2.5 rounded-md text-[11px] font-mono font-semibold tracking-wider"
              style={{
                background: "hsl(var(--revint-h) var(--revint-s) 50% / 0.10)",
                color: "hsl(var(--revint-h) var(--revint-s) 72%)",
                border:
                  "1px solid hsl(var(--revint-h) var(--revint-s) 50% / 0.22)",
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
                          "hsl(var(--revint-h) var(--revint-s) 50% / 0.10)",
                        color: "hsl(var(--revint-h) var(--revint-s) 78%)",
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
