/**
 * Three-layer architecture explainer for the v2 marketing surface.
 *
 * Design intent: position the product as a loop, not a list of features.
 * Three large blocks (Detect / Reason / Execute) each with a numbered
 * chip, a sentence-case heading, a short paragraph, and a small static
 * "internal labels" card that hints at the actual signals the system
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
    title: "Detect",
    copy: "LeadAC scans restaurants, cafes, bars, and local businesses for real buying signals.",
    rows: [
      { label: "Maps coverage", chip: "412 places" },
      { label: "Review velocity", chip: "+38 / 30d" },
      { label: "Weak SEO", chip: "Detected" },
      { label: "Booking gaps", chip: "Phone only" },
      { label: "Social inactivity", chip: "14 days dark" },
    ],
  },
  {
    number: "02",
    title: "Reason",
    copy: "The system evaluates which businesses are most likely to respond based on operational and market signals.",
    rows: [
      { label: "Score 0-100", chip: "84" },
      { label: "Reasoning trace", chip: "6 steps" },
      { label: "Sub-niche fit", chip: "Sushi · LDN" },
      { label: "Opportunity surface", chip: "Reservations" },
    ],
  },
  {
    number: "03",
    title: "Execute",
    copy: "Hand the rep a fresh dossier and a talk track before they pick up the phone. Email is the booking layer for the next call.",
    rows: [
      { label: "Talk track", chip: "First 30 seconds ready" },
      { label: "Dossier", chip: "1 page" },
      { label: "Next action", chip: "Call" },
      { label: "Disposition", chip: "4 chips" },
    ],
  },
];

export function HowItThinks() {
  return (
    <Section
      id="how-it-thinks"
      eyebrow="How LeadAC thinks"
      headline="Three layers between a postcode and a reply."
      sub="The system runs detection, reasoning, and execution as a continuous loop, not three disconnected steps."
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
