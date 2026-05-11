"use client";

/**
 * HeaderBar — Lead Detail v2 sticky header.
 *
 * Phase 1 contents (left → right):
 *   [back] [name + sub-niche pill] [TIER badge] [stage chip ▾]
 *   ─────────── flex spacer ───────────
 *   [Dial] [Email] [Voice-note] [⋮]
 *
 * Stage source: caller passes `stage` derived via
 * `deriveLeadDetailStage(lead, watchlistItem)`. The dropdown writes
 * back through `PATCH /api/watchlist/[id]` for the 5-bucket subset
 * (see `PipelineStageChip.tsx` TODO for the rest).
 *
 * Quick actions are simple `tel:` / `mailto:` anchors plus a button
 * whose click is forwarded up through `onVoiceNote` so the parent
 * scrolls to / opens the existing voice-note recorder. The kebab is
 * a Radix dropdown with Edit / Archive / Discard placeholders — they
 * fire `onEdit` / `onArchive` / `onDiscard` if the parent wires them.
 *
 * Phase 2.5 additions:
 *   - "Override sub-niche…" kebab item → controls the
 *     `SubNicheOverrideMenu` popover via controlled `open` state.
 *   - "Re-run pipeline" kebab item → POSTs to
 *     `/api/leads/[id]/pipeline-rerun` (existing route).
 */

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Mic,
  MoreHorizontal,
  Phone,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PipelineStageChip,
  type PipelineStageChipCopy,
} from "./PipelineStageChip";
import {
  SubNicheOverrideMenu,
  type SubNicheOverrideMenuCopy,
} from "./SubNicheOverrideMenu";
import type { LeadDetailV2Stage } from "@/lib/lead-detail/use-pipeline-stage";
import type {
  AccountTierValue,
  SubNicheStateDto,
} from "@/lib/lead-detail/use-decision-surface";

export interface HeaderBarCopy {
  tierLabel: string;
  stageLabel: string;
  changeStage: string;
  dial: string;
  email: string;
  voiceNote: string;
  moreActions: string;
  edit: string;
  archive: string;
  discard: string;
  stages: PipelineStageChipCopy["stages"];
  // Phase 2.5 — additive copy for the kebab additions.
  overrideSubNiche?: string;
  rerunPipeline?: string;
  rerunningPipeline?: string;
  rerunPipelineError?: string;
  subNicheOverride?: SubNicheOverrideMenuCopy;
}

export interface HeaderBarProps {
  businessName: string;
  subNicheLabel?: string | null;
  backHref?: string;
  backLabel: string;
  tier?: AccountTierValue | null;
  stage: LeadDetailV2Stage;
  watchlistItemId: string | null;
  onStageChange?: (next: LeadDetailV2Stage) => void;
  phone?: string | null;
  email?: string | null;
  onVoiceNote?: () => void;
  onEdit?: () => void;
  onArchive?: () => void;
  onDiscard?: () => void;
  // Phase 2.5 — sub-niche state from `decision-surface.subNicheState`
  // and the lead id used by the override popover + pipeline-rerun.
  leadId?: string;
  subNicheState?: SubNicheStateDto | null;
  onSubNicheSaved?: () => void;
  onPipelineRerun?: () => void;
  copy: HeaderBarCopy;
}

const TIER_TONE: Record<AccountTierValue, string> = {
  TIER_1: "var(--leadac-success)",
  TIER_2: "var(--leadac-500)",
  TIER_3: "var(--leadac-info)",
  TIER_4: "var(--leadac-text-3)",
};

function TierBadge({ tier, label }: { tier: AccountTierValue; label: string }) {
  const tone = TIER_TONE[tier];
  const display = tier.replace("_", " ");
  return (
    <span
      className="inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[10px] font-semibold uppercase tracking-[0.06em]"
      style={{
        borderColor: "color-mix(in srgb, " + tone + " 45%, transparent)",
        color: tone,
        background: "color-mix(in srgb, " + tone + " 10%, transparent)",
      }}
      aria-label={`${label}: ${display}`}
    >
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: tone }}
      />
      {display}
    </span>
  );
}

function buildTel(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned ? `tel:${cleaned}` : null;
}

export function HeaderBar({
  businessName,
  subNicheLabel,
  backHref = "/app/leads",
  backLabel,
  tier,
  stage,
  watchlistItemId,
  onStageChange,
  phone,
  email,
  onVoiceNote,
  onEdit,
  onArchive,
  onDiscard,
  leadId,
  subNicheState,
  onSubNicheSaved,
  onPipelineRerun,
  copy,
}: HeaderBarProps) {
  const tel = buildTel(phone);
  const mail = email ? `mailto:${email}` : null;
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [rerunError, setRerunError] = useState<string | null>(null);

  const handleRerunPipeline = useCallback(async () => {
    if (!leadId || rerunning) return;
    setRerunning(true);
    setRerunError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/pipeline-rerun`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      if (!res.ok) throw new Error(`status_${res.status}`);
      onPipelineRerun?.();
    } catch {
      setRerunError(copy.rerunPipelineError ?? "Failed to re-run pipeline");
    } finally {
      setRerunning(false);
    }
  }, [leadId, rerunning, onPipelineRerun, copy.rerunPipelineError]);

  return (
    <div className="flex w-full items-center gap-2 px-3 sm:gap-3 sm:px-6">
      <Link
        href={backHref}
        aria-label={backLabel}
        className="-ml-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--leadac-500)/55"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
      </Link>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <p className="truncate text-[14px] font-medium text-white sm:text-[15px]">
          {businessName}
        </p>
        {subNicheLabel ? (
          <span
            className="hidden truncate rounded-full border px-2 py-0.5 text-[11px] sm:inline-flex"
            style={{
              borderColor: "hsl(0 0% 100% / 0.12)",
              color: "var(--leadac-text-2)",
              background: "hsl(0 0% 100% / 0.04)",
            }}
          >
            {subNicheLabel}
          </span>
        ) : null}
        {tier ? <TierBadge tier={tier} label={copy.tierLabel} /> : null}
        <PipelineStageChip
          stage={stage}
          watchlistItemId={watchlistItemId}
          onStageChange={onStageChange}
          copy={{ changeStage: copy.changeStage, stages: copy.stages }}
        />
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <QuickActionAnchor
          href={tel}
          icon={<Phone className="h-4 w-4" />}
          label={copy.dial}
        />
        <QuickActionAnchor
          href={mail}
          icon={<Mail className="h-4 w-4" />}
          label={copy.email}
        />
        <button
          type="button"
          aria-label={copy.voiceNote}
          onClick={onVoiceNote}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--leadac-500)/55"
        >
          <Mic className="h-4 w-4" aria-hidden />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={copy.moreActions}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--leadac-500)/55"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onEdit?.()}>{copy.edit}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onArchive?.()}>
              {copy.archive}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onDiscard?.()}>
              {copy.discard}
            </DropdownMenuItem>
            {/*
             * Phase 2.5 — sub-niche override + pipeline re-run kebab
             * items (PLAN §5.9 rows 6 & 14). Hidden when the parent
             * doesn't pass the necessary copy / leadId.
             */}
            {leadId && copy.subNicheOverride && copy.overrideSubNiche ? (
              <DropdownMenuItem
                data-testid="header-kebab-override-sub-niche"
                onSelect={(e) => {
                  // Keep the dropdown closed but defer the popover
                  // open so Radix doesn't fight focus management.
                  e.preventDefault();
                  setTimeout(() => setOverrideOpen(true), 0);
                }}
              >
                {copy.overrideSubNiche}
              </DropdownMenuItem>
            ) : null}
            {leadId && copy.rerunPipeline ? (
              <DropdownMenuItem
                data-testid="header-kebab-rerun-pipeline"
                disabled={rerunning}
                onSelect={(e) => {
                  e.preventDefault();
                  void handleRerunPipeline();
                }}
              >
                {rerunning && copy.rerunningPipeline
                  ? copy.rerunningPipeline
                  : copy.rerunPipeline}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
        {/*
         * SubNicheOverrideMenu in controlled mode — the kebab item
         * above flips `overrideOpen` and Radix anchors the popover to
         * a 0-size sibling sitting at this position in the DOM.
         */}
        {leadId && copy.subNicheOverride ? (
          <SubNicheOverrideMenu
            leadId={leadId}
            state={subNicheState ?? null}
            open={overrideOpen}
            onOpenChange={setOverrideOpen}
            onSaved={() => {
              setOverrideOpen(false);
              onSubNicheSaved?.();
            }}
            copy={copy.subNicheOverride}
          />
        ) : null}
        {rerunError ? (
          <span
            role="status"
            className="absolute right-3 top-12 rounded-md border border-white/10 bg-white/3 px-2 py-1 text-[11px]"
            style={{ color: "var(--leadac-error)" }}
          >
            {rerunError}
          </span>
        ) : null}
      </div>
    </div>
  );
}

interface QuickActionAnchorProps {
  href: string | null;
  icon: React.ReactNode;
  label: string;
}

function QuickActionAnchor({ href, icon, label }: QuickActionAnchorProps) {
  const className =
    "inline-flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--leadac-500)/55";
  if (!href) {
    return (
      <button type="button" disabled aria-label={label} className={`${className} opacity-40`}>
        {icon}
      </button>
    );
  }
  return (
    <a href={href} aria-label={label} className={className}>
      {icon}
    </a>
  );
}
