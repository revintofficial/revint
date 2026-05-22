/**
 * Operator chip cards for the v2 marketing surface.
 *
 * Design intent: tell the reader who operates LeadAC every day, in
 * three concrete operator types. Small icon, label, one-line
 * description. No bullets, no decoration. Pure server.
 *
 * Frames the audience as vertical SaaS GTM teams selling into
 * local-business verticals. Primary card aimed at the SDR / AE team;
 * secondary cards at VP Sales / RevOps. Everyone operates on the same
 * model.
 */
import * as React from "react";
import { Building2, Headset, LineChart, type LucideIcon } from "lucide-react";
import { Section } from "./section";

interface Chip {
  icon: LucideIcon;
  label: string;
  body: string;
}

const PRIMARY: Chip = {
  icon: Headset,
  label: "SDR & AE teams selling into local-business verticals",
  body: "The morning account queue, the CRM-native brief, the recommended angle, the reply mix. The whole shape of a 5 to 30 person GTM team where vertical context, account intelligence, and pipeline quality determine the number.",
};

const SECONDARY: Chip[] = [
  {
    icon: LineChart,
    label: "VPs of Sales and RevOps leads",
    body: "For the leader operating on portfolio-level conversion: which vertical sub-segments win, which proof points close, what changed since the last quarter.",
  },
  {
    icon: Building2,
    label: "Founders running vertical-SaaS GTM",
    body: "For the founder who wants one model behind discovery, account research, and CRM enrichment, instead of an Apollo seat plus a Clay workflow plus a manual SDR playbook stapled together.",
  },
];

function ChipCard({
  chip,
  size,
}: {
  chip: Chip;
  size: "primary" | "secondary";
}) {
  const Icon = chip.icon;
  return (
    <article
      className="rounded-2xl border border-white/[0.06] bg-[hsl(var(--leadac-h)_var(--leadac-ns)_9%)] p-6 transition-colors hover:border-white/[0.12] h-full"
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
      <h3
        className={
          size === "primary"
            ? "mt-4 text-[20px] md:text-[22px] font-semibold text-white tracking-tight leading-snug"
            : "mt-4 text-[15px] font-semibold text-white leading-snug"
        }
      >
        {chip.label}
      </h3>
      <p
        className={
          size === "primary"
            ? "mt-2 text-[14.5px] text-white/65 leading-relaxed"
            : "mt-1.5 text-[13px] text-white/55 leading-relaxed"
        }
      >
        {chip.body}
      </p>
    </article>
  );
}

export function BuiltFor() {
  return (
    <Section
      eyebrow="Built for"
      headline="Vertical SaaS GTM teams selling to local business."
      sub="Built for vertical and SMB SaaS revenue teams where account context, buying signals, and pipeline quality determine the number. Reps, managers, and revenue leaders operate on the same model."
    >
      <div
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
        data-section="built-for"
      >
        <div className="md:col-span-2">
          <ChipCard chip={PRIMARY} size="primary" />
        </div>
        <div className="md:col-span-1 flex flex-col gap-4">
          {SECONDARY.map((chip) => (
            <ChipCard key={chip.label} chip={chip} size="secondary" />
          ))}
        </div>
      </div>
    </Section>
  );
}
