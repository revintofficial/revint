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

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  ContradictionRecord,
  ReasoningGraph,
} from "@/lib/sdr-brain/reasoning-graph";
import type { BantBars } from "@/lib/lead-detail/derive-bant";
import type { ObjectionDiff } from "@/lib/lead-detail/derive-objection-diff";
import type { IcpDimensionsResult } from "@/lib/icp-fit/dimensions";
import { mark as perfMark, measure as perfMeasure, flush as perfFlush } from "@/lib/lead-detail/perf-marks";

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
  // Phase 2.5 — coordinates for the AccountBlock map mini.
  sourceLat: number | null;
  sourceLng: number | null;
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

export interface ClosestWinDto {
  insightId: string;
  insightPerformanceId: string;
  triggerType: string | null;
  framework: string | null;
  score: number;
  won: number;
  applied: number;
  sisterLeadId: string | null;
}

export interface QueuePositionDto {
  current: number;
  totalToday: number;
}

// ===== Phase 2.5 — V1 richness summary DTOs =====

export interface IntelligenceBriefDto {
  runId: string;
  generatedAt: string;
  salesConfidence: number | null;
  headline: string | null;
  painPoints: string[];
  whyGoodTarget: string | null;
}

export interface RecommendedPackageDto {
  id: string;
  name: string;
  priceLabel: string;
  features: string[];
  reason: string | null;
}

export interface ReviewIntelSummaryDto {
  leadScore: number;
  summary: string | null;
  sentimentBreakdown: {
    positive: number | null;
    neutral: number | null;
    negative: number | null;
  };
  weaknessKpisTop3: Array<{ label: string; count: number | null; percent: number | null }>;
  strengthKpisTop3: Array<{ label: string; count: number | null; percent: number | null }>;
  switchSignalsTop3: string[];
  reviewsAnalyzedCount: number;
  lastAnalyzedAt: string | null;
}

export interface WebsiteIntelSummaryDto {
  hasBookingSystem: boolean;
  bookingProvider: string | null;
  loadTimeMs: number | null;
  https: boolean;
  mobileFriendlyGuess: boolean;
  hasContactForm: boolean;
  hasWhatsappLink: boolean;
  hasEcommerce: boolean;
  servicesDetectedTop5: string[];
  title: string | null;
  metaDescription: string | null;
  crawlStatus: "ok" | "blocked" | "error" | "never" | null;
  lastAuditedAt: string | null;
}

export interface ReviewVelocityDto {
  recentCount30d: number;
  priorCount30d: number;
  deltaPct: number;
  recent30dAvgRating: number | null;
  prior30dAvgRating: number | null;
  ratingDelta: number | null;
}

export interface DiscoveredLinksDto {
  socials: Array<{ platform: string; url: string }>;
  directories: Array<{ name: string; url: string }>;
}

export interface SubNicheStateDto {
  current: { slug: string | null; label: string | null };
  override: {
    source:
      | "AUTO"
      | "MANUAL"
      | "REP_OVERRIDE"
      | "DISCOVERY_QUERY"
      | "RULE"
      | null;
    confidence: number | null;
    version: number;
  };
  alternatives: Array<{
    slug: string;
    confidence: number | null;
    reason: string | null;
  }>;
}

export interface DossierStubDto {
  hasDossier: boolean;
  lastGeneratedAt: string | null;
  summarySnippet: string | null;
}

export interface PipelineStateDto {
  crawl: "PENDING" | "CRAWLING" | "CRAWLED" | "FAILED" | "NO_WEBSITE";
  analyze: "PENDING" | "ANALYZING" | "ANALYZED" | "FAILED";
  reviews: "PENDING" | "ANALYZING" | "ANALYZED" | "FAILED" | "NO_REVIEWS";
  outreach: PipelineStageValue | null;
  dnc: boolean;
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
  closestWin: ClosestWinDto | null;
  queuePosition: QueuePositionDto | null;
  recentDialAt: string | null;
  // Phase 2.5 — V1 richness absorption (always defined; absent
  // signals come back as null so consumers can render empty state
  // without an extra null-guard).
  intelligenceBrief: IntelligenceBriefDto | null;
  recommendedPackage: RecommendedPackageDto | null;
  personalizedFirstMessage: string | null;
  reviewIntelSummary: ReviewIntelSummaryDto | null;
  websiteIntelSummary: WebsiteIntelSummaryDto | null;
  reviewVelocity: ReviewVelocityDto | null;
  discoveredLinks: DiscoveredLinksDto;
  subNicheState: SubNicheStateDto | null;
  dossierStub: DossierStubDto;
  pipelineState: PipelineStateDto | null;
  loading: boolean;
  error: string | null;
  preliminaryShippable: boolean;
  finalLatencyMs: number | null;
  /** Phase 2.5 — manual revalidation for parents that mutate
   * server-side state (e.g. sub-niche override, pipeline re-run)
   * and need the surface to refetch immediately. No-op while a
   * fetch is in-flight. */
  refresh: () => void;
}

const POLL_INTERVAL_DESKTOP_MS = 6_000;
const POLL_INTERVAL_MOBILE_MS = 4_000;
export const PRELIMINARY_SHIPPABLE_THRESHOLD_MS = 25_000;

/**
 * Phase 5: pick the polling interval based on viewport. Mobile reps
 * tap dial faster so we shave 2s off the round-trip — but the page
 * still pauses entirely while the tab is hidden (see fetchOnce loop).
 *
 * Server-side and JSDOM (no `matchMedia`) fall back to desktop cadence.
 */
function pickPollIntervalMs(): number {
  if (typeof window === "undefined") return POLL_INTERVAL_DESKTOP_MS;
  if (typeof window.matchMedia !== "function") return POLL_INTERVAL_DESKTOP_MS;
  return window.matchMedia("(max-width: 640px)").matches
    ? POLL_INTERVAL_MOBILE_MS
    : POLL_INTERVAL_DESKTOP_MS;
}

function isDocumentHidden(): boolean {
  if (typeof document === "undefined") return false;
  return document.visibilityState === "hidden";
}

interface AggregatorRawResponse {
  leadCore: DecisionSurfaceLeadCore;
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
  closestWin: ClosestWinDto | null;
  queuePosition: QueuePositionDto | null;
  recentDialAt: string | null;
  // Phase 2.5 — V1 richness absorption.
  intelligenceBrief: IntelligenceBriefDto | null;
  recommendedPackage: RecommendedPackageDto | null;
  personalizedFirstMessage: string | null;
  reviewIntelSummary: ReviewIntelSummaryDto | null;
  websiteIntelSummary: WebsiteIntelSummaryDto | null;
  reviewVelocity: ReviewVelocityDto;
  discoveredLinks: DiscoveredLinksDto;
  subNicheState: SubNicheStateDto;
  dossierStub: DossierStubDto;
  pipelineState: PipelineStateDto;
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
  // Phase 2.5 — bumping `revalidateTick` re-runs the fetch effect.
  const [revalidateTick, setRevalidateTick] = useState(0);
  const refresh = useCallback(() => {
    setRevalidateTick((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingResume = false;
    mountedAtRef.current = Date.now();
    finalSeenRef.current = false;
    // Phase 7: anchor mark so every perf event for this lead has a
    // shared origin. The PostHog event fires from `perfMeasure` so
    // dashboards see the same `mount → preliminary → final` story.
    perfMark(leadId, "mount");

    const clearPoll = () => {
      if (pollTimer) {
        clearTimeout(pollTimer);
        pollTimer = null;
      }
    };

    const schedulePoll = () => {
      clearPoll();
      // Phase 5: don't burn API quota while the tab is hidden. We
      // resume on the next `visibilitychange → visible` event.
      if (isDocumentHidden()) {
        pendingResume = true;
        return;
      }
      pollTimer = setTimeout(fetchOnce, pickPollIntervalMs());
    };

    async function fetchOnce() {
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

        // Phase 7 perf: first decision-surface response settles the
        // page chrome; the perf event lets us catch DB slow-downs
        // before they regress the felt-latency budget (PLAN §5.6).
        perfMark(leadId, "first_decision_surface");
        perfMeasure(
          leadId,
          "first_decision_surface",
          "mount",
          "first_decision_surface",
        );

        const preliminary = json.nba?.preliminary ?? null;
        if (preliminary) {
          perfMark(leadId, "preliminary");
          perfMeasure(leadId, "preliminary_to_paint", "mount", "preliminary");
        }

        const final = json.nba?.final ?? null;
        if (final && !finalSeenRef.current) {
          finalSeenRef.current = true;
          setFinalLatencyMs(Date.now() - mountedAtRef.current);
          perfMark(leadId, "final");
          perfMeasure(leadId, "final_to_paint", "mount", "final");
        }

        if (!final) {
          schedulePoll();
        }
      } catch {
        if (!cancelled) {
          setError((prev) => prev ?? "decision_surface_failed");
          setLoading(false);
        }
      }
    }

    const onVisibilityChange = () => {
      if (cancelled) return;
      if (isDocumentHidden()) {
        // Tab was hidden — drop the in-flight timer, mark a resume.
        if (pollTimer) {
          clearPoll();
          pendingResume = true;
        }
      } else if (pendingResume && !finalSeenRef.current) {
        pendingResume = false;
        // Re-fetch immediately on resume so the rep sees fresh data.
        void fetchOnce();
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    void fetchOnce();
    return () => {
      cancelled = true;
      clearPoll();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
      // Phase 7: drop perf marks/measures for this lead so a long
      // SPA session doesn't accumulate stale entries on the
      // performance timeline.
      perfFlush(leadId);
    };
  }, [leadId, revalidateTick]);

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
      closestWin: null,
      queuePosition: null,
      recentDialAt: null,
      // Phase 2.5 — pre-payload defaults so consumers can render
      // skeletons / empty states without hitting an undefined slot.
      intelligenceBrief: null,
      recommendedPackage: null,
      personalizedFirstMessage: null,
      reviewIntelSummary: null,
      websiteIntelSummary: null,
      reviewVelocity: null,
      discoveredLinks: EMPTY_DISCOVERED_LINKS,
      subNicheState: null,
      dossierStub: EMPTY_DOSSIER_STUB,
      pipelineState: null,
      loading,
      error,
      preliminaryShippable,
      finalLatencyMs,
      refresh,
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
    closestWin: payload.closestWin ?? null,
    queuePosition: payload.queuePosition ?? null,
    recentDialAt: payload.recentDialAt ?? null,
    // Phase 2.5 — V1 richness absorption.
    intelligenceBrief: payload.intelligenceBrief ?? null,
    recommendedPackage: payload.recommendedPackage ?? null,
    personalizedFirstMessage: payload.personalizedFirstMessage ?? null,
    reviewIntelSummary: payload.reviewIntelSummary ?? null,
    websiteIntelSummary: payload.websiteIntelSummary ?? null,
    reviewVelocity: payload.reviewVelocity ?? null,
    discoveredLinks: payload.discoveredLinks ?? EMPTY_DISCOVERED_LINKS,
    subNicheState: payload.subNicheState ?? null,
    dossierStub: payload.dossierStub ?? EMPTY_DOSSIER_STUB,
    pipelineState: payload.pipelineState ?? null,
    loading,
    error,
    preliminaryShippable,
    finalLatencyMs,
    refresh,
  };
}

const EMPTY_DISCOVERED_LINKS: DiscoveredLinksDto = {
  socials: [],
  directories: [],
};

const EMPTY_DOSSIER_STUB: DossierStubDto = {
  hasDossier: false,
  lastGeneratedAt: null,
  summarySnippet: null,
};
