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

const PRIMARY: Chip = {
  icon: Headset,
  label: "F&B restaurant-tech BD pods",
  body: "The morning queue, the call brief, the disposition mix. The whole shape of a 5 to 10 person BD team that lives on the phone with restaurants, cafes, bars, and hotels.",
};

const SECONDARY: Chip[] = [
  {
    icon: Building2,
    label: "Local agencies calling restaurants",
    body: "For the agency owner who calls local cafes about web work and wants the brief on the screen before the call connects.",
  },
  {
    icon: ChefHat,
    label: "Restaurant-tech in-house BD",
    body: "For the VP Sales hiring their 6th BD rep at a regional POS or QR-menu vendor.",
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
      headline="For BD managers running a calling pod."
      sub="LeadAC was built for the BD manager who runs a 5 to 10 person calling pod selling to restaurants and local businesses."
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
