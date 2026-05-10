/**
 * Pipeline-stage hook for Lead Detail v2 — Phase 0.
 *
 * Returns `{ stage, isStaleWhyNow, expandRules }` from the lead's
 * sales-pipeline stage and an optional WHY_NOW timestamp.
 *
 * The expand-rules table comes from RETHINK §4.3 — which blocks are
 * expanded vs collapsed-to-stub for each stage. Phase 1 will consume
 * this when wiring real blocks; Phase 0 only needs the table to exist
 * so consumers can be tested.
 *
 * NOTE on naming: `Lead.pipelineStatus` in the schema is OK / BLOCKED_*,
 * not the SDR stage. The actual sales stage lives on `WatchlistItem`
 * (`pipelineStage` 5-bucket and `dealStage` 11-bucket). Phase 1 decides
 * which one to derive from. This hook is intentionally agnostic:
 * callers pass the stage in. The hook embeds the expand-rules table
 * and the stale-WHY_NOW heuristic, nothing else.
 */

"use client";

import { useMemo, useState } from "react";

export type LeadDetailV2Stage =
  | "COLD"
  | "CONTACTED"
  | "REPLIED"
  | "MEETING_BOOKED"
  | "PROPOSAL"
  | "NEGOTIATING"
  | "WON"
  | "LOST";

export type LeadDetailV2BlockKey =
  | "WHY_NOW"
  | "NEXT_GESTURE"
  | "WHO"
  | "DISCOVERY"
  | "QUALIFICATION"
  | "HISTORY"
  | "ACCOUNT";

export type BlockExpansion = "expanded" | "stub";

/**
 * Stage-driven expand-rules table.
 *
 * DEV OVERRIDE: every block is forced to `"expanded"` for every stage
 * while we're still building out the surface. This makes empty-state
 * copy and partially-populated blocks visible at a glance during dev,
 * and avoids hiding work-in-progress behind stage-driven collapses.
 *
 * To restore the production rules, swap `LEAD_DETAIL_V2_EXPAND_RULES`
 * back to `LEAD_DETAIL_V2_EXPAND_RULES_PROD` below — that constant is
 * the canonical RETHINK §4.3 table (WHY_NOW + NEXT_GESTURE always in
 * layout; WON / LOST collapse everything except HISTORY).
 */

const ALL_EXPANDED: Readonly<Record<LeadDetailV2BlockKey, BlockExpansion>> = {
  WHY_NOW: "expanded",
  NEXT_GESTURE: "expanded",
  WHO: "expanded",
  DISCOVERY: "expanded",
  QUALIFICATION: "expanded",
  HISTORY: "expanded",
  ACCOUNT: "expanded",
};

export const LEAD_DETAIL_V2_EXPAND_RULES: Readonly<
  Record<LeadDetailV2Stage, Readonly<Record<LeadDetailV2BlockKey, BlockExpansion>>>
> = {
  COLD: ALL_EXPANDED,
  CONTACTED: ALL_EXPANDED,
  REPLIED: ALL_EXPANDED,
  MEETING_BOOKED: ALL_EXPANDED,
  PROPOSAL: ALL_EXPANDED,
  NEGOTIATING: ALL_EXPANDED,
  WON: ALL_EXPANDED,
  LOST: ALL_EXPANDED,
};

/**
 * Canonical production expand-rules from RETHINK §4.3. Kept here so
 * we can restore stage-driven collapsing in one assignment when the
 * surface is feature-complete.
 */
export const LEAD_DETAIL_V2_EXPAND_RULES_PROD: Readonly<
  Record<LeadDetailV2Stage, Readonly<Record<LeadDetailV2BlockKey, BlockExpansion>>>
> = {
  COLD: {
    WHY_NOW: "expanded",
    NEXT_GESTURE: "expanded",
    WHO: "expanded",
    DISCOVERY: "stub",
    QUALIFICATION: "stub",
    HISTORY: "stub",
    ACCOUNT: "stub",
  },
  CONTACTED: {
    WHY_NOW: "expanded",
    NEXT_GESTURE: "expanded",
    WHO: "stub",
    DISCOVERY: "stub",
    QUALIFICATION: "stub",
    HISTORY: "expanded",
    ACCOUNT: "stub",
  },
  REPLIED: {
    WHY_NOW: "stub",
    NEXT_GESTURE: "expanded",
    WHO: "expanded",
    DISCOVERY: "expanded",
    QUALIFICATION: "expanded",
    HISTORY: "stub",
    ACCOUNT: "stub",
  },
  MEETING_BOOKED: {
    WHY_NOW: "stub",
    NEXT_GESTURE: "expanded",
    WHO: "stub",
    DISCOVERY: "expanded",
    QUALIFICATION: "expanded",
    HISTORY: "stub",
    ACCOUNT: "stub",
  },
  PROPOSAL: {
    WHY_NOW: "stub",
    NEXT_GESTURE: "expanded",
    WHO: "stub",
    DISCOVERY: "stub",
    QUALIFICATION: "expanded",
    HISTORY: "expanded",
    ACCOUNT: "stub",
  },
  NEGOTIATING: {
    WHY_NOW: "stub",
    NEXT_GESTURE: "expanded",
    WHO: "stub",
    DISCOVERY: "stub",
    QUALIFICATION: "expanded",
    HISTORY: "expanded",
    ACCOUNT: "stub",
  },
  WON: {
    WHY_NOW: "stub",
    NEXT_GESTURE: "stub",
    WHO: "stub",
    DISCOVERY: "stub",
    QUALIFICATION: "stub",
    HISTORY: "expanded",
    ACCOUNT: "stub",
  },
  LOST: {
    WHY_NOW: "stub",
    NEXT_GESTURE: "stub",
    WHO: "stub",
    DISCOVERY: "stub",
    QUALIFICATION: "stub",
    HISTORY: "expanded",
    ACCOUNT: "stub",
  },
};

/**
 * Stale-WHY_NOW threshold. RETHINK §3.10b argues a WHY_NOW trigger
 * older than two weeks should visually demote (never delete — audit
 * trail), and re-promote if a fresh trigger fires.
 */
export const STALE_WHY_NOW_DAYS = 14;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface UsePipelineStageResult {
  stage: LeadDetailV2Stage;
  isStaleWhyNow: boolean;
  expandRules: Readonly<Record<LeadDetailV2BlockKey, BlockExpansion>>;
}

export interface UsePipelineStageInput {
  stage: LeadDetailV2Stage;
  whyNowAt?: Date | string | number | null;
  /** Override "now" for tests. Defaults to `Date.now()` at call time. */
  now?: Date | number;
}

function toMs(value: Date | string | number | null | undefined): number | null {
  if (value == null) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function resolveNow(now: Date | number | undefined): number {
  if (now == null) return Date.now();
  if (now instanceof Date) return now.getTime();
  return now;
}

export function usePipelineStage(input: UsePipelineStageInput): UsePipelineStageResult {
  const { stage, whyNowAt, now } = input;
  // Pin "now" to mount so the hook stays pure on re-render. The 14-day
  // staleness threshold does not need sub-hour precision; long-lived
  // sessions can re-evaluate by remounting (Phase 1's polling loop).
  const [nowMs] = useState<number>(() => resolveNow(now));
  return useMemo(() => {
    const whyNowMs = toMs(whyNowAt);
    const isStaleWhyNow =
      whyNowMs == null
        ? false
        : nowMs - whyNowMs > STALE_WHY_NOW_DAYS * MS_PER_DAY;
    return {
      stage,
      isStaleWhyNow,
      expandRules: LEAD_DETAIL_V2_EXPAND_RULES[stage],
    };
  }, [stage, whyNowAt, nowMs]);
}
