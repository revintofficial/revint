"use client";

/**
 * PipelineStageChip — header chip + Radix dropdown for the eight
 * RETHINK §4.3 stages (COLD, CONTACTED, REPLIED, MEETING_BOOKED,
 * PROPOSAL, NEGOTIATING, WON, LOST). The caller passes the derived
 * stage in (computed via `deriveLeadDetailStage`); the chip renders
 * the localized label and lets the rep pick a different stage from
 * the dropdown.
 *
 * Dropdown selection wires through to the existing
 * `PATCH /api/watchlist/[id]` endpoint, which today only accepts the
 * 5-bucket `pipelineStage` (NEW / REACHED_OUT / IN_TALKS / WON /
 * LOST). Stage values that don't map cleanly onto that vocabulary
 * (MEETING_BOOKED / PROPOSAL / NEGOTIATING) are stubbed with a TODO
 * comment + soft-warning toast. Phase 2's `decision-surface` route
 * will extend the patch shape to write `dealStage` directly.
 */

import { useCallback } from "react";

import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LeadDetailV2Stage } from "@/lib/lead-detail/use-pipeline-stage";

export interface PipelineStageChipCopy {
  changeStage: string;
  stages: Record<LeadDetailV2Stage, string>;
}

export interface PipelineStageChipProps {
  stage: LeadDetailV2Stage;
  watchlistItemId: string | null;
  onStageChange?: (next: LeadDetailV2Stage) => void;
  copy: PipelineStageChipCopy;
}

const ORDER: ReadonlyArray<LeadDetailV2Stage> = [
  "COLD",
  "CONTACTED",
  "REPLIED",
  "MEETING_BOOKED",
  "PROPOSAL",
  "NEGOTIATING",
  "WON",
  "LOST",
];

const TONE: Record<LeadDetailV2Stage, string> = {
  COLD: "var(--leadac-text-3)",
  CONTACTED: "var(--leadac-info)",
  REPLIED: "var(--leadac-500)",
  MEETING_BOOKED: "var(--leadac-warning)",
  PROPOSAL: "var(--leadac-warning)",
  NEGOTIATING: "var(--leadac-warning)",
  WON: "var(--leadac-success)",
  LOST: "var(--leadac-error)",
};

const PATCH_PIPELINE_STAGE_FOR: Partial<
  Record<LeadDetailV2Stage, "NEW" | "REACHED_OUT" | "IN_TALKS" | "WON" | "LOST">
> = {
  COLD: "NEW",
  CONTACTED: "REACHED_OUT",
  REPLIED: "IN_TALKS",
  MEETING_BOOKED: "IN_TALKS",
  PROPOSAL: "IN_TALKS",
  NEGOTIATING: "IN_TALKS",
  WON: "WON",
  LOST: "LOST",
};

type DealStageEnum =
  | "PROSPECTING"
  | "PREPARATION"
  | "APPROACH"
  | "DISCOVERY"
  | "PRESENTATION"
  | "OBJECTION_HANDLING"
  | "NEGOTIATION"
  | "CLOSING"
  | "WON"
  | "LOST"
  | "FOLLOWUP";

const PATCH_DEAL_STAGE_FOR: Partial<Record<LeadDetailV2Stage, DealStageEnum>> = {
  COLD: "PROSPECTING",
  CONTACTED: "APPROACH",
  REPLIED: "DISCOVERY",
  MEETING_BOOKED: "PRESENTATION",
  PROPOSAL: "PRESENTATION",
  NEGOTIATING: "NEGOTIATION",
  WON: "WON",
  LOST: "LOST",
};

export function PipelineStageChip({
  stage,
  watchlistItemId,
  onStageChange,
  copy,
}: PipelineStageChipProps) {
  const tone = TONE[stage];
  const label = copy.stages[stage];

  const handleSelect = useCallback(
    async (next: LeadDetailV2Stage) => {
      if (next === stage) return;
      onStageChange?.(next);
      if (!watchlistItemId) return;
      const pipelineValue = PATCH_PIPELINE_STAGE_FOR[next];
      const dealValue = PATCH_DEAL_STAGE_FOR[next];
      const body: Record<string, string> = {};
      if (pipelineValue) body.pipelineStage = pipelineValue;
      if (dealValue) body.dealStage = dealValue;
      if (Object.keys(body).length === 0) return;
      try {
        const res = await fetch(`/api/watchlist/${watchlistItemId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(String(res.status));
      } catch {
        toast.error("Stage change couldn't be saved.");
      }
    },
    [stage, watchlistItemId, onStageChange],
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={copy.changeStage}
          className="inline-flex h-7 items-center gap-1 rounded-full border px-2 text-[11px] font-medium uppercase tracking-[0.06em] transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--leadac-500)/55"
          style={{
            borderColor: "color-mix(in srgb, " + tone + " 45%, transparent)",
            color: tone,
            background: "color-mix(in srgb, " + tone + " 10%, transparent)",
          }}
        >
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: tone }}
          />
          <span className="truncate">{label}</span>
          <ChevronDown className="h-3 w-3" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.08em]">
          {copy.changeStage}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ORDER.map((s) => (
          <DropdownMenuItem
            key={s}
            onSelect={() => void handleSelect(s)}
            data-current={s === stage}
            className="text-[12px]"
          >
            <span
              aria-hidden
              className="mr-2 inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: TONE[s] }}
            />
            {copy.stages[s]}
            {s === stage ? (
              <Loader2
                className="ml-auto h-3 w-3 opacity-0"
                aria-hidden
              />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
