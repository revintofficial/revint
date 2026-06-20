/**
 * FineDine v1 update — playbook resolver + pure compute helpers.
 *
 * `getPlaybook` reads the workspace's `WorkspacePlaybook` row and parses
 * the JSON columns into the typed `PlaybookShape`. When a workspace has
 * no row yet it falls back to `FINEDINE_PLAYBOOK` so the Action Sheet
 * always has stages/angles/checklist to render (the seed script makes
 * the row authoritative once run).
 *
 * The compute helpers are pure (no IO) so they can be unit-tested and
 * reused by Phase 2 ingestion (stage mapping), Phase 3 UI (badges) and
 * Phase 4 writeback (denormalized `revint_*` properties).
 */
import type { PrismaClient } from "@/generated/prisma/client";
import {
  FINEDINE_PLAYBOOK,
  type NoShowRiskRules,
  type PlaybookShape,
  type RiskLevel,
  type TemperatureRules,
} from "./types";

export type LeadTemperatureValue = "HOT" | "WARM" | "COLD";

/**
 * Resolve the effective playbook for a workspace. Stored row wins;
 * otherwise the FineDine default. We defensively coalesce each JSON
 * column to the default array/object so a partially-populated row never
 * crashes the consumer.
 */
export async function getPlaybook(
  prisma: PrismaClient,
  workspaceId: string,
): Promise<PlaybookShape> {
  const row = await prisma.workspacePlaybook.findUnique({
    where: { workspaceId },
  });
  if (!row) return FINEDINE_PLAYBOOK;

  const stages = row.stages as unknown as PlaybookShape["stages"] | null;
  const angles = row.angles as unknown as PlaybookShape["angles"] | null;
  const checklist =
    row.qualificationChecklist as unknown as PlaybookShape["qualificationChecklist"] | null;

  return {
    stages: stages?.length ? stages : FINEDINE_PLAYBOOK.stages,
    angles: angles?.length ? angles : FINEDINE_PLAYBOOK.angles,
    qualificationChecklist: checklist?.length
      ? checklist
      : FINEDINE_PLAYBOOK.qualificationChecklist,
    temperatureRules:
      (row.temperatureRules as unknown as TemperatureRules | null) ??
      FINEDINE_PLAYBOOK.temperatureRules,
    noShowRiskRules:
      (row.noShowRiskRules as unknown as NoShowRiskRules | null) ??
      FINEDINE_PLAYBOOK.noShowRiskRules,
  };
}

export interface TemperatureSignals {
  /** Hours since the inbound lead arrived (null = unknown / not inbound). */
  hoursSinceInbound?: number | null;
  /** Most recent call disposition (CallDisposition enum value as string). */
  lastDisposition?: string | null;
  /** Whether the lead is in a qualified playbook stage. */
  qualified?: boolean;
}

/**
 * Compute lead temperature from playbook rules. Precedence: HOT → WARM →
 * COLD. A rule matches when ANY of its declared conditions match
 * (disposition in list, within the recency window, or qualified). Falls
 * back to WARM for fresh-but-unmatched leads and COLD otherwise.
 */
export function computeTemperature(
  playbook: PlaybookShape,
  signals: TemperatureSignals,
): LeadTemperatureValue {
  const { temperatureRules: rules } = playbook;
  const { hoursSinceInbound, lastDisposition, qualified } = signals;

  const matches = (rule?: TemperatureRules["hot"]): boolean => {
    if (!rule) return false;
    if (rule.whenQualified && qualified) return true;
    if (
      rule.dispositions &&
      lastDisposition &&
      rule.dispositions.includes(lastDisposition)
    ) {
      return true;
    }
    if (
      typeof rule.maxHoursSinceInbound === "number" &&
      typeof hoursSinceInbound === "number" &&
      hoursSinceInbound <= rule.maxHoursSinceInbound
    ) {
      return true;
    }
    return false;
  };

  if (matches(rules.hot)) return "HOT";
  if (matches(rules.warm)) return "WARM";
  if (matches(rules.cold)) return "COLD";
  // Unmatched: a still-fresh inbound is warm, everything else cold.
  if (typeof hoursSinceInbound === "number" && hoursSinceInbound <= 48) return "WARM";
  return "COLD";
}

const TEMPERATURE_RANK: Record<LeadTemperatureValue, number> = {
  COLD: 0,
  WARM: 1,
  HOT: 2,
};

/**
 * Confidence thresholds that floor the temperature derived during the
 * analysis rollup (where there are usually no call signals yet). Kept
 * deterministic so the leads list, the `revint_lead_temperature` HubSpot
 * property and the App Card all agree.
 */
const SALES_CONFIDENCE_HOT = 75;
const SALES_CONFIDENCE_WARM = 50;

/**
 * Derive the lead temperature at analysis time. Combines the playbook
 * rule engine (`computeTemperature` — disposition / SLA / qualified
 * driven) with the freshly computed `salesConfidence`, returning whichever
 * is hotter. This seeds a sensible temperature for newly-scored leads that
 * have no inbound SLA or disposition yet; the qualification flow later
 * refines it with real call signals via `computeTemperature`.
 */
export function deriveLeadTemperature(
  playbook: PlaybookShape,
  signals: TemperatureSignals & { salesConfidence?: number | null },
): LeadTemperatureValue {
  const base = computeTemperature(playbook, signals);

  let fromScore: LeadTemperatureValue = "COLD";
  if (typeof signals.salesConfidence === "number") {
    if (signals.salesConfidence >= SALES_CONFIDENCE_HOT) fromScore = "HOT";
    else if (signals.salesConfidence >= SALES_CONFIDENCE_WARM) fromScore = "WARM";
  }

  return TEMPERATURE_RANK[fromScore] >= TEMPERATURE_RANK[base] ? fromScore : base;
}

export interface QualificationResult {
  qualified: boolean;
  status: string;
  /** Keys of required items still unanswered / false. */
  missing: string[];
}

/**
 * Compute qualified state from checklist answers. `answers` maps each
 * checklist key → boolean. A lead is qualified when every
 * `requiredForQualified` item is truthy. The `info_only` disqualifier
 * (when present and true) forces unqualified.
 */
export function computeQualification(
  playbook: PlaybookShape,
  answers: Record<string, boolean | undefined>,
): QualificationResult {
  const required = playbook.qualificationChecklist.filter(
    (i) => i.requiredForQualified,
  );
  const missing = required.filter((i) => !answers[i.key]).map((i) => i.key);

  const infoOnly = answers["info_only"] === true;
  const qualified = !infoOnly && missing.length === 0;

  let status: string;
  if (infoOnly) status = "info_only";
  else if (qualified) status = "qualified";
  else if (required.length - missing.length === 0) status = "not_started";
  else status = "in_progress";

  return { qualified, status, missing };
}

/**
 * Compute no-show risk level from weighted factors. `presentFactors` is
 * the set of factor keys that currently apply to the lead. The weighted
 * sum is bucketed against the playbook thresholds.
 */
export function computeNoShowRisk(
  playbook: PlaybookShape,
  presentFactors: string[],
): RiskLevel {
  const rules = playbook.noShowRiskRules;
  const factors = rules.factors ?? [];
  const score = factors
    .filter((f) => presentFactors.includes(f.key))
    .reduce((sum, f) => sum + f.weight, 0);
  const thresholds = rules.thresholds ?? { medium: 30, high: 60 };
  if (score >= thresholds.high) return "high";
  if (score >= thresholds.medium) return "medium";
  return "low";
}
