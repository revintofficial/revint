/**
 * derive-stage — pure mapping from Lead + WatchlistItem to the
 * 8-stage RETHINK §4.3 vocabulary used by Lead Detail v2.
 *
 * The schema carries three different "stage" surfaces:
 *
 *   1. `Lead.pipelineStatus` — pipeline GATE (OK / BLOCKED_*); not a
 *      sales stage at all. Ignored here.
 *   2. `WatchlistItem.pipelineStage` — 5-bucket kanban
 *      (NEW / REACHED_OUT / IN_TALKS / WON / LOST).
 *   3. `WatchlistItem.dealStage` — 11-bucket SDR-Brain canon
 *      (PROSPECTING / PREPARATION / APPROACH / DISCOVERY /
 *      PRESENTATION / OBJECTION_HANDLING / NEGOTIATION / CLOSING /
 *      WON / LOST / FOLLOWUP).
 *
 * Lead Detail v2 uses 8 buckets (RETHINK §4.3): COLD / CONTACTED /
 * REPLIED / MEETING_BOOKED / PROPOSAL / NEGOTIATING / WON / LOST.
 *
 * Resolution order:
 *
 *   - If `WatchlistItem` is absent (the COLD case for unsaved leads),
 *     return `CONTACTED` when `Lead.lastContactedAt` is set, otherwise
 *     `COLD`.
 *   - If `WatchlistItem.dealStage` is set (default PROSPECTING), map
 *     the 11-bucket value to the 8-bucket vocabulary using the table
 *     below. This is the primary signal because the dealStage is the
 *     finer-grained SDR-Brain canon.
 *   - The 5-bucket `pipelineStage` is consulted only as a tiebreaker
 *     in the noisy default-PROSPECTING case so that legacy data
 *     written before dealStage existed still resolves cleanly.
 *
 * 11-bucket DealStage → 8-bucket LeadDetailV2Stage:
 *   PROSPECTING       → COLD
 *   PREPARATION       → COLD
 *   APPROACH          → CONTACTED
 *   DISCOVERY         → REPLIED
 *   PRESENTATION      → MEETING_BOOKED
 *   OBJECTION_HANDLING → NEGOTIATING
 *   NEGOTIATION       → NEGOTIATING
 *   CLOSING           → PROPOSAL
 *   WON               → WON
 *   LOST              → LOST
 *   FOLLOWUP          → CONTACTED
 *
 * 5-bucket fallback (when dealStage is the default PROSPECTING and
 * pipelineStage carries the real signal):
 *   NEW          → COLD
 *   REACHED_OUT  → CONTACTED
 *   IN_TALKS     → REPLIED
 *   WON          → WON
 *   LOST         → LOST
 *
 * NOTE: this is pure (no Prisma, no fetch). The page wrapper feeds
 * it the lead + watchlistItem already retrieved from
 * `/api/leads/[id]`.
 */

import type { LeadDetailV2Stage } from "./use-pipeline-stage";

export type DealStageInput =
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

export type PipelineStageInput =
  | "NEW"
  | "REACHED_OUT"
  | "IN_TALKS"
  | "WON"
  | "LOST";

export interface DeriveStageLead {
  lastContactedAt?: Date | string | null;
}

export interface DeriveStageWatchlistItem {
  dealStage?: DealStageInput | null;
  pipelineStage?: PipelineStageInput | null;
}

const DEAL_STAGE_TABLE: Record<DealStageInput, LeadDetailV2Stage> = {
  PROSPECTING: "COLD",
  PREPARATION: "COLD",
  APPROACH: "CONTACTED",
  DISCOVERY: "REPLIED",
  PRESENTATION: "MEETING_BOOKED",
  OBJECTION_HANDLING: "NEGOTIATING",
  NEGOTIATION: "NEGOTIATING",
  CLOSING: "PROPOSAL",
  WON: "WON",
  LOST: "LOST",
  FOLLOWUP: "CONTACTED",
};

const PIPELINE_STAGE_TABLE: Record<PipelineStageInput, LeadDetailV2Stage> = {
  NEW: "COLD",
  REACHED_OUT: "CONTACTED",
  IN_TALKS: "REPLIED",
  WON: "WON",
  LOST: "LOST",
};

export function deriveLeadDetailStage(
  lead: DeriveStageLead | null | undefined,
  watchlistItem: DeriveStageWatchlistItem | null | undefined,
): LeadDetailV2Stage {
  if (watchlistItem) {
    const deal = watchlistItem.dealStage;
    const pipeline = watchlistItem.pipelineStage;

    if (deal && deal !== "PROSPECTING") {
      return DEAL_STAGE_TABLE[deal];
    }
    if (pipeline && pipeline !== "NEW") {
      return PIPELINE_STAGE_TABLE[pipeline];
    }
    if (deal === "PROSPECTING") {
      return "COLD";
    }
  }

  if (lead?.lastContactedAt) {
    return "CONTACTED";
  }
  return "COLD";
}
