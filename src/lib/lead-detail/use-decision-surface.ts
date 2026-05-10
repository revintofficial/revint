"use client";

/**
 * use-decision-surface — Phase 2 client hook.
 *
 * Phase 1 was a thin wrapper over `/api/leads/[id]` and
 * `/api/leads/[id]/next-action`. Phase 2 swaps the underlying fetch
 * to a single round-trip against the new aggregator route at
 * `/api/leads/[id]/decision-surface`. The hook return shape is
 * forward-compatible: existing consumers (`leadCore`, `nba`,
 * `preliminaryShippable`, `finalLatencyMs`, `loading`, `error`) keep
 * working unchanged. The Phase 1 stub fields (`bant`, `icpDimensions`,
 * `stakeholders`) become typed payloads, plus newly added fields
 * (`dealQualification`, `latestDiscovery`, `recentObjections`,
 * `accountSummary`, `activities`, `planGate`).
 *
 * Polling cadence preserved: while `nba.final` is null, the hook
 * polls every 6s — same as the legacy `next-action` cadence — so the
 * "preliminary morphs to final" pattern still works for the NBA
 * fields the aggregator embeds.
 */

import { useEffect, useRef, useState } from "react";

import type {
  ContradictionRecord,
  ReasoningGraph,
} from "@/lib/sdr-brain/reasoning-graph";
import type { BantBars } from "@/lib/lead-detail/derive-bant";
import type { ObjectionDiff } from "@/lib/lead-detail/derive-objection-diff";
import type { IcpDimensionsResult } from "@/lib/icp-fit/dimensions";

export interface DecisionSurfaceLeadCore {
  id: string;
  businessName: string;
  subNicheSlug: string | null;
  subNicheLabel: string | null;
  primaryType: string | null;
  phone: string | null;
  websiteUrl: string | null;
  formattedAddress: string | null;
  accountTier: AccountTierValue | null;
  accountId: string | null;
  lastContactedAt: string | null;
  whyNow: string | null;
  urgencyWindowDays: number | null;
  icpFitScore: number | null;
  watchlist: {
    id: string;
    pipelineStage: PipelineStageValue;
    dealStage: DealStageValue;
  } | null;
}

export type AccountTierValue = "TIER_1" | "TIER_2" | "TIER_3" | "TIER_4";
export type PipelineStageValue =
  | "NEW"
  | "REACHED_OUT"
  | "IN_TALKS"
  | "WON"
  | "LOST";
export type DealStageValue =
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

export interface LeadNextActionDto {
  id: string;
  version: number;
  isPreliminary: boolean;
  actionKind: string;
  channel: string | null;
  primaryAngleId: string | null;
  triggerIds: string[];
  openingHook: string | null;
  whatNotToPitch: string[];
  predictedObjections: string[];
  recommendedFramework: string | null;
  confidence: number;
  reasoning: string;
  reasoningGraph: ReasoningGraph | null;
  arbitrationRecords: ContradictionRecord[] | null;
  timingWindowEnd: string | null;
  createdAt: string;
}

export interface LeadTriggerDto {
  id: string;
  type: string;
  severity: number;
  confidence: number;
  detectedAt: string;
  urgencyWindowDays: number | null;
  evidence: unknown;
  impactPrediction?: string | null;
}

export interface InsightDto {
  id: string;
  industryMyth: string;
  reframe: string;
  economicImpact: string | null;
}

export interface DecisionSurfaceNba {
  preliminary: LeadNextActionDto | null;
  final: LeadNextActionDto | null;
  triggers: LeadTriggerDto[];
  insight: InsightDto | null;
  reasoningGraph: ReasoningGraph | null;
  arbitrationRecords: ContradictionRecord[];
}

export interface StakeholderDto {
  id: string;
  name: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  influence: number | null;
  championLikelihood: number | null;
  isEconomicBuyer: boolean;
  isBlocker: boolean;
  bantRole: "champion" | "economic-buyer" | "blocker" | "stakeholder";
  source: string;
  contacted: boolean;
}

export interface DealQualificationDto {
  watchlistItemId: string;
  fillCompletePct: number;
  metrics: MeddpiccCellDto;
  economicBuyer: MeddpiccCellDto;
  decisionCriteria: MeddpiccCellDto;
  decisionProcess: MeddpiccCellDto;
  identifyPain: MeddpiccCellDto;
  champion: MeddpiccCellDto;
  competition: MeddpiccCellDto;
}

export interface MeddpiccCellDto {
  status: "present" | "partial" | "missing";
  evidence: Array<{
    type:
      | "linkedin"
      | "review"
      | "audit"
      | "voice-note"
      | "prior-nba"
      | "contradiction";
    sourceQuote: string | null;
    refType: string | null;
    refId: string | null;
  }>;
  stakeholderId?: string | null;
}

export interface DiscoveryItemDto {
  id: string;
  spinKind: "SITUATION" | "PROBLEM" | "IMPLICATION" | "NEED_PAYOFF";
  text: string;
  evidence: string | null;
  confidence: number;
  createdAt: string;
}

export interface LatestDiscoveryDto {
  sessionId: string;
  source: string;
  conductedAt: string;
  items: {
    SITUATION: DiscoveryItemDto[];
    PROBLEM: DiscoveryItemDto[];
    IMPLICATION: DiscoveryItemDto[];
    NEED_PAYOFF: DiscoveryItemDto[];
  };
}

export interface AccountSummaryDto {
  id: string;
  name: string;
  tier: AccountTierValue | null;
  locationsCount: number | null;
}

export interface ActivityDto {
  id: string;
  kind: string;
  payload: unknown;
  createdAt: string;
}

export interface PlanGateDto {
  plan: "FREE" | "PRO" | "PRO_TEAM" | "AGENCY";
  meddpiccUnlocked: boolean;
  spinUnlocked: boolean;
}

export interface UseDecisionSurfaceResult {
  leadCore: DecisionSurfaceLeadCore | null;
  nba: DecisionSurfaceNba | null;
  bant: BantBars | null;
  icpDimensions: IcpDimensionsResult | null;
  stakeholders: StakeholderDto[];
  dealQualification: DealQualificationDto | null;
  latestDiscovery: LatestDiscoveryDto | null;
  recentObjections: ObjectionDiff;
  accountSummary: AccountSummaryDto | null;
  activities: ActivityDto[];
  planGate: PlanGateDto | null;
  loading: boolean;
  error: string | null;
  preliminaryShippable: boolean;
  finalLatencyMs: number | null;
}

const POLL_INTERVAL_MS = 6_000;
export const PRELIMINARY_SHIPPABLE_THRESHOLD_MS = 25_000;

interface AggregatorRawResponse {
  leadCore: {
    id: string;
    businessName: string;
    subNicheSlug: string | null;
    subNicheLabel: string | null;
    primaryType: string | null;
    phone: string | null;
    websiteUrl: string | null;
    formattedAddress: string | null;
    accountTier: AccountTierValue | null;
    accountId: string | null;
    lastContactedAt: string | null;
    whyNow: string | null;
    urgencyWindowDays: number | null;
    icpFitScore: number | null;
    watchlist: {
      id: string;
      pipelineStage: PipelineStageValue;
      dealStage: DealStageValue;
    } | null;
  };
  nba: DecisionSurfaceNba | null;
  bant: BantBars | null;
  icpDimensions: IcpDimensionsResult | null;
  stakeholders: StakeholderDto[];
  dealQualification: DealQualificationDto | null;
  latestDiscovery: LatestDiscoveryDto | null;
  recentObjections: ObjectionDiff;
  accountSummary: AccountSummaryDto | null;
  activities: ActivityDto[];
  planGate: PlanGateDto;
}

const EMPTY_OBJECTION_DIFF: ObjectionDiff = {
  predictedAndReal: [],
  predictedNotReal: [],
  realOnly: [],
};

export function useDecisionSurface(leadId: string): UseDecisionSurfaceResult {
  const [payload, setPayload] = useState<AggregatorRawResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preliminaryShippable, setPreliminaryShippable] = useState(false);
  const [finalLatencyMs, setFinalLatencyMs] = useState<number | null>(null);

  const mountedAtRef = useRef<number>(0);
  const finalSeenRef = useRef(false);
  const elapsedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    mountedAtRef.current = Date.now();
    finalSeenRef.current = false;

    const fetchOnce = async () => {
      try {
        const res = await fetch(`/api/leads/${leadId}/decision-surface`, {
          cache: "no-store",
        });
        if (cancelled) return;
        if (!res.ok) {
          setError(`decision_surface_${res.status}`);
          setLoading(false);
          return;
        }
        const json = (await res.json()) as AggregatorRawResponse;
        if (cancelled) return;
        setPayload(json);
        setLoading(false);

        const final = json.nba?.final ?? null;
        if (final && !finalSeenRef.current) {
          finalSeenRef.current = true;
          setFinalLatencyMs(Date.now() - mountedAtRef.current);
        }

        if (!final) {
          pollTimer = setTimeout(fetchOnce, POLL_INTERVAL_MS);
        }
      } catch {
        if (!cancelled) {
          setError((prev) => prev ?? "decision_surface_failed");
          setLoading(false);
        }
      }
    };

    void fetchOnce();
    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [leadId]);

  useEffect(() => {
    const preliminary = payload?.nba?.preliminary ?? null;
    const final = payload?.nba?.final ?? null;
    if (!preliminary || final) return;
    const elapsed = Date.now() - mountedAtRef.current;
    const remaining = Math.max(0, PRELIMINARY_SHIPPABLE_THRESHOLD_MS - elapsed);
    elapsedTimerRef.current = setTimeout(() => {
      setPreliminaryShippable(true);
    }, remaining);
    return () => {
      if (elapsedTimerRef.current) clearTimeout(elapsedTimerRef.current);
    };
  }, [payload?.nba?.preliminary, payload?.nba?.final]);

  useEffect(() => {
    const final = payload?.nba?.final ?? null;
    if (final && preliminaryShippable) {
      const id = setTimeout(() => setPreliminaryShippable(false), 0);
      return () => clearTimeout(id);
    }
  }, [payload?.nba?.final, preliminaryShippable]);

  if (!payload) {
    return {
      leadCore: null,
      nba: null,
      bant: null,
      icpDimensions: null,
      stakeholders: [],
      dealQualification: null,
      latestDiscovery: null,
      recentObjections: EMPTY_OBJECTION_DIFF,
      accountSummary: null,
      activities: [],
      planGate: null,
      loading,
      error,
      preliminaryShippable,
      finalLatencyMs,
    };
  }

  return {
    leadCore: payload.leadCore,
    nba: payload.nba,
    bant: payload.bant,
    icpDimensions: payload.icpDimensions,
    stakeholders: payload.stakeholders,
    dealQualification: payload.dealQualification,
    latestDiscovery: payload.latestDiscovery,
    recentObjections: payload.recentObjections,
    accountSummary: payload.accountSummary,
    activities: payload.activities,
    planGate: payload.planGate,
    loading,
    error,
    preliminaryShippable,
    finalLatencyMs,
  };
}
