"use client";

/**
 * StakeholderCard — single buying-committee row. Renders name + role
 * + BANT role rosette (champion / blocker / economic-buyer /
 * stakeholder), with click-to-expand source evidence.
 *
 * Color-blind safety (PLAN §5.8 / design-brief §10): every status
 * pairs an icon with the color so the rosette never relies on hue
 * alone.
 */

import { useState, type ReactNode } from "react";
import { Crown, ShieldAlert, Award, User } from "lucide-react";

import {
  EvidenceChip,
  buildStakeholderEvidenceChip,
  type EvidenceChipCopy,
} from "./EvidenceChip";
import {
  StakeholderOnlinePresence,
  type StakeholderOnlinePresenceCopy,
  type StakeholderOnlinePresenceLink,
} from "./StakeholderOnlinePresence";

export type StakeholderBantRole =
  | "champion"
  | "economic-buyer"
  | "blocker"
  | "stakeholder";

export interface StakeholderCardData {
  id: string;
  name: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  championLikelihood: number | null;
  influence: number | null;
  isEconomicBuyer: boolean;
  isBlocker: boolean;
  bantRole: StakeholderBantRole;
  source: string;
  contacted: boolean;
}

export interface StakeholderCardCopy {
  unknownName: string;
  rosette: Record<StakeholderBantRole, string>;
  championLabel: string;
  influenceLabel: string;
  evidence: EvidenceChipCopy;
  // Phase 2.5 — additive copy for the online-presence icon strip.
  onlinePresence?: StakeholderOnlinePresenceCopy;
}

export interface StakeholderCardProps {
  data: StakeholderCardData;
  copy: StakeholderCardCopy;
  // Phase 2.5 — slice of `decision-surface.discoveredLinks.socials`
  // matched to this stakeholder by the parent. May be empty.
  onlineLinks?: ReadonlyArray<StakeholderOnlinePresenceLink>;
}

const ROSETTE_TONE: Record<StakeholderBantRole, string> = {
  champion: "var(--leadac-500)",
  "economic-buyer": "var(--leadac-info)",
  blocker: "var(--leadac-error)",
  stakeholder: "var(--leadac-text-3)",
};

function rosetteIcon(role: StakeholderBantRole): ReactNode {
  if (role === "champion") return <Crown aria-hidden className="h-3.5 w-3.5" />;
  if (role === "economic-buyer")
    return <Award aria-hidden className="h-3.5 w-3.5" />;
  if (role === "blocker")
    return <ShieldAlert aria-hidden className="h-3.5 w-3.5" />;
  return <User aria-hidden className="h-3.5 w-3.5" />;
}

export function StakeholderCard({
  data,
  copy,
  onlineLinks,
}: StakeholderCardProps): ReactNode {
  const [open, setOpen] = useState(false);
  const tone = ROSETTE_TONE[data.bantRole];
  const chip = buildStakeholderEvidenceChip({
    stakeholderId: data.id,
    source: data.source,
    linkedinUrl: data.linkedinUrl,
  });

  return (
    <div
      className="flex flex-col gap-2 rounded-lg border px-3 py-2.5"
      style={{
        borderColor: "var(--leadac-border)",
        background: "var(--leadac-card)",
      }}
      data-testid={`stakeholder-card-${data.id}`}
    >
      <div className="flex items-start gap-2">
        <span
          aria-hidden
          className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full"
          style={{
            color: tone,
            background: "color-mix(in srgb, " + tone + " 18%, transparent)",
          }}
        >
          {rosetteIcon(data.bantRole)}
        </span>
        <div className="flex flex-col gap-0.5">
          <span
            className="text-[13px] font-medium"
            style={{ color: "var(--leadac-text-1)" }}
          >
            {data.name ?? copy.unknownName}
          </span>
          <span className="text-[11px]" style={{ color: "var(--leadac-text-3)" }}>
            {data.role ?? "—"}
          </span>
        </div>
        <span
          className="ml-auto text-[10px] font-medium uppercase tracking-[0.06em]"
          style={{ color: tone }}
        >
          {copy.rosette[data.bantRole]}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 text-[11px]" style={{ color: "var(--leadac-text-3)" }}>
        {data.championLikelihood != null ? (
          <span className="inline-flex items-center gap-1">
            <span>{copy.championLabel}</span>
            <span className="tabular-nums" style={{ color: "var(--leadac-text-2)" }}>
              {data.championLikelihood}
            </span>
          </span>
        ) : null}
        {data.influence != null ? (
          <span className="inline-flex items-center gap-1">
            <span>{copy.influenceLabel}</span>
            <span className="tabular-nums" style={{ color: "var(--leadac-text-2)" }}>
              {data.influence}
            </span>
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-[11px] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--leadac-500)/55"
          style={{ color: "var(--leadac-text-2)" }}
          aria-expanded={open}
        >
          {open ? "−" : "+"}
        </button>
        {open ? (
          <EvidenceChip
            type={chip.type}
            label={chip.label}
            sourceQuote={chip.sourceQuote}
            href={chip.href}
            copy={copy.evidence}
          />
        ) : null}
      </div>
      {onlineLinks && onlineLinks.length > 0 && copy.onlinePresence ? (
        <StakeholderOnlinePresence
          links={onlineLinks}
          copy={copy.onlinePresence}
        />
      ) : null}
    </div>
  );
}
