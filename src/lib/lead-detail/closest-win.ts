/**
 * findClosestWin — Phase 3 helper.
 *
 * Pure function that picks the single most relevant winning insight
 * for a lead, given:
 *   - the lead (its sub-niche slug, account tier, active triggers)
 *   - the workspace's `InsightPerformance` rows (already filtered to
 *     this workspace by the caller — but the function takes
 *     `workspaceId` as a non-optional first arg AND defensively drops
 *     any row whose `workspaceId` doesn't match, per PLAN §6 risk #13:
 *     "Compare-to-similar-wins false positives because
 *     `InsightPerformance` shares trigger×framework×tier across
 *     workspaces").
 *   - sister leads from the same account (used to prefer wins on a
 *     sister branch when present).
 *
 * Returns null when no candidate clears the floor, or when MEDDPICC
 * isn't yet at 4/7 ✓ — but the MEDDPICC gate lives in the aggregator
 * caller (the helper is intentionally agnostic so unit tests stay
 * focused on the matching logic).
 *
 * The aggregator gates this whole feature to PRO+ before calling.
 */

import type { LeadTriggerType, AccountTier } from "@/generated/prisma/client";

export interface ClosestWinLeadInput {
  id: string;
  workspaceId: string;
  nicheSlug: string | null;
  subNicheSlug: string | null;
  accountTier: AccountTier | null;
  triggerTypes: LeadTriggerType[];
}

export interface ClosestWinInsightPerformanceInput {
  id: string;
  workspaceId: string;
  insightId: string;
  nicheSlug: string | null;
  triggerType: LeadTriggerType | null;
  segmentTier: AccountTier | null;
  framework: string | null;
  applied: number;
  won: number;
  meetingBooked: number;
}

export interface ClosestWinSisterLeadInput {
  id: string;
  workspaceId: string;
  borough: string | null;
  formattedAddress: string | null;
}

export interface ClosestWinSummary {
  insightId: string;
  insightPerformanceId: string;
  triggerType: LeadTriggerType | null;
  framework: string | null;
  /** Wilson lower bound × 100, rounded — useful for tie-breaks in tests. */
  score: number;
  /** Wins observed for this bucket inside the workspace. */
  won: number;
  /** Total applied for this bucket inside the workspace. */
  applied: number;
  /** When a sister lead matched, surface its id so the UI can deep-link. */
  sisterLeadId: string | null;
}

const MIN_WON = 1;
const Z = 1.96;

/**
 * Wilson lower bound on a binomial proportion. Stable across small
 * sample sizes (the "47/200" vs "0/0" example from
 * `prisma/schema.prisma` line 2063). Only used as a relative score —
 * we never claim absolute probabilities downstream.
 */
function wilsonLowerBound(wins: number, applied: number): number {
  if (applied <= 0 || wins <= 0) return 0;
  const phat = wins / applied;
  const z2 = Z * Z;
  const denom = 1 + z2 / applied;
  const center = phat + z2 / (2 * applied);
  const margin = Z * Math.sqrt((phat * (1 - phat) + z2 / (4 * applied)) / applied);
  return Math.max(0, (center - margin) / denom);
}

export function findClosestWin(
  workspaceId: string,
  lead: ClosestWinLeadInput,
  insightPerformance: ClosestWinInsightPerformanceInput[],
  sisterLeads: ClosestWinSisterLeadInput[],
): ClosestWinSummary | null {
  if (!workspaceId) return null;
  if (lead.workspaceId !== workspaceId) return null;

  const sisterIds = new Set(
    sisterLeads
      .filter((s) => s.workspaceId === workspaceId && s.id !== lead.id)
      .map((s) => s.id),
  );

  const candidates = insightPerformance
    .filter((p) => p.workspaceId === workspaceId)
    .filter((p) => p.won >= MIN_WON)
    .filter((p) => {
      if (lead.triggerTypes.length === 0) return p.triggerType == null;
      return p.triggerType == null || lead.triggerTypes.includes(p.triggerType);
    })
    .filter((p) => {
      if (p.segmentTier == null) return true;
      if (lead.accountTier == null) return false;
      return p.segmentTier === lead.accountTier;
    })
    .filter((p) => {
      if (p.nicheSlug == null) return true;
      const slugs = [lead.subNicheSlug, lead.nicheSlug].filter(
        (s): s is string => typeof s === "string" && s.length > 0,
      );
      if (slugs.length === 0) return false;
      return slugs.includes(p.nicheSlug);
    });

  if (candidates.length === 0) return null;

  const scored = candidates
    .map((p) => {
      const score = Math.round(wilsonLowerBound(p.won, Math.max(p.applied, p.won)) * 1000);
      const sisterMatch = sisterIds.size > 0 ? Array.from(sisterIds)[0] ?? null : null;
      const triggerSpecificity = p.triggerType ? 2 : 0;
      const tierSpecificity = p.segmentTier ? 1 : 0;
      const slugSpecificity = p.nicheSlug ? 1 : 0;
      const specificity = triggerSpecificity + tierSpecificity + slugSpecificity;
      return { p, score, sisterMatch, specificity };
    })
    .sort((a, b) => {
      if (b.specificity !== a.specificity) return b.specificity - a.specificity;
      if (b.score !== a.score) return b.score - a.score;
      if (b.p.won !== a.p.won) return b.p.won - a.p.won;
      return a.p.id.localeCompare(b.p.id);
    });

  const winner = scored[0];
  if (!winner) return null;

  return {
    insightId: winner.p.insightId,
    insightPerformanceId: winner.p.id,
    triggerType: winner.p.triggerType,
    framework: winner.p.framework,
    score: winner.score,
    won: winner.p.won,
    applied: winner.p.applied,
    sisterLeadId: winner.sisterMatch,
  };
}
