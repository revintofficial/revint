/**
 * GET /api/leads/[id]/decision-surface
 *
 * Single aggregator for the v2 lead-detail page. Replaces the legacy
 * client-side fan-out (lead.findUnique + nba + reviews + audit ...)
 * with a single round-trip whose response shape is the union of every
 * v2 block consumer. Phases 3/4 add fields here; they never add new
 * endpoints. The hook `useDecisionSurface` is the only consumer.
 *
 * MULTI-TENANT SCOPE AUDIT (per `multi-tenant-scope.mdc`):
 * - requireUser() called first; workspaceId resolved from session.
 * - Every Prisma where clause MUST include workspaceId either directly
 *   or through a parent relation (e.g. `lead: { workspaceId }`).
 * - Tables touched: Lead, Account, LeadTrigger, Stakeholder,
 *   WatchlistItem, DealQualification, DealQualificationFact,
 *   DiscoverySession, DiscoveryItem, Objection, LeadNextAction,
 *   IdealCustomerProfile, LeadActivity, WebsiteAudit.
 * - Cross-tenant return = 404. Never 200 with an empty result.
 *
 * AUTO-WATCHLIST SIDE-EFFECT (per RETHINK §9 Q9 / PLAN §4 line 206):
 * - When `dealQualification = null` for a non-COLD lead AND there is
 *   at least one `DealQualificationFact` already (e.g. the planner
 *   wrote one but the kanban row is missing), we auto-create a
 *   `WatchlistItem`. Idempotent: `WatchlistItem.leadId @unique` so a
 *   parallel race lands the same row.
 * - GATED BY PLAN (PLAN §6 risk #7): FREE workspaces never get the
 *   silent watchlist consumption — they see the locked MEDDPICC stub
 *   instead. The gate uses `session.workspace.plan === "FREE"`.
 *
 * PERF: budget ≤ 250ms p95 hot DB. The fan-out is one
 * `Prisma.$transaction([...])` of read promises; auto-watchlist (if
 * triggered) is a single follow-up upsert. Round-trip count in the
 * integration test = 8 (1 lead pre-check + 1 transaction of 7 reads).
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { internalError } from "@/lib/api-errors";
import {
  computeIcpDimensions,
  type IcpDimensionsResult,
} from "@/lib/icp-fit/dimensions";
import {
  deriveBantBars,
  type BantBars,
  type BantFactInput,
} from "@/lib/lead-detail/derive-bant";
import {
  deriveObjectionDiff,
  type ObjectionDiff,
} from "@/lib/lead-detail/derive-objection-diff";
import { deriveBuyingReadiness } from "@/lib/sdr-brain/buying-readiness";
import { deriveLeadDetailStage } from "@/lib/lead-detail/derive-stage";
import {
  findClosestWin,
  type ClosestWinSummary,
} from "@/lib/lead-detail/closest-win";
import {
  resolveRecommendedPackage,
  type RecommendedPackage,
} from "@/lib/lead-detail/recommended-package";
import {
  computeReviewVelocity,
  type ReviewVelocity,
} from "@/lib/lead-detail/review-velocity";
import {
  extractDiscoveredLinks,
  type AgentRunForLinks,
} from "@/lib/discovered-links";
import type {
  ContradictionRecord,
  ReasoningGraph,
} from "@/lib/sdr-brain/reasoning-graph";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface EvidenceRef {
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
}

interface LeadCoreShape {
  id: string;
  workspaceId: string;
  businessName: string;
  formattedAddress: string | null;
  borough: string | null;
  phone: string | null;
  websiteUrl: string | null;
  primaryType: string | null;
  subNicheSlug: string | null;
  subNicheLabel: string | null;
  accountId: string | null;
  accountTier: "TIER_1" | "TIER_2" | "TIER_3" | "TIER_4" | null;
  watchlist: {
    id: string;
    pipelineStage: "NEW" | "REACHED_OUT" | "IN_TALKS" | "WON" | "LOST";
    dealStage:
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
  } | null;
  lastContactedAt: string | null;
  whyNow: string | null;
  urgencyWindowDays: number | null;
  icpFitScore: number | null;
  // Phase 2.5 — coordinates for the AccountBlock map mini.
  sourceLat: number | null;
  sourceLng: number | null;
}

// =====================================================================
// Phase 2.5 — V1 richness absorption types.
// Every field below is a SUMMARY (not a full V1 row). The full payloads
// stay lazy under the companion endpoints `/review-intel`, `/website-intel`,
// `/explain`, `/dossier-sources` so the aggregator stays under the
// 400ms p95 ceiling. Per PLAN §4 Phase 2.5.
// =====================================================================

interface IntelligenceBriefShape {
  runId: string;
  generatedAt: string;
  salesConfidence: number | null;
  headline: string | null;
  painPoints: string[];
  whyGoodTarget: string | null;
}

interface ReviewIntelSummaryShape {
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

interface WebsiteIntelSummaryShape {
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
  /** Crawl status — null when no audit attempted, "ok" when reachable. */
  crawlStatus: "ok" | "blocked" | "error" | "never" | null;
  lastAuditedAt: string | null;
}

interface DiscoveredLinksShape {
  socials: Array<{ platform: string; url: string }>;
  directories: Array<{ name: string; url: string }>;
}

interface SubNicheStateShape {
  current: { slug: string | null; label: string | null };
  override: {
    /**
     * Mirrors `SubNicheSource` in `prisma/schema.prisma` (currently
     * `AUTO | MANUAL`). PLAN §4 Phase 2.5 anticipated future values
     * (`REP_OVERRIDE`, `DISCOVERY_QUERY`, `RULE`); keep this widened
     * so a follow-up schema bump doesn't break clients reading the
     * field. UI must treat unknown values as "AUTO".
     */
    source: "AUTO" | "MANUAL" | "REP_OVERRIDE" | "DISCOVERY_QUERY" | "RULE" | null;
    confidence: number | null;
    version: number;
  };
  alternatives: Array<{
    slug: string;
    confidence: number | null;
    reason: string | null;
  }>;
}

interface DossierStubShape {
  hasDossier: boolean;
  lastGeneratedAt: string | null;
  summarySnippet: string | null;
}

interface PipelineStateShape {
  crawl: "PENDING" | "CRAWLING" | "CRAWLED" | "FAILED" | "NO_WEBSITE";
  analyze: "PENDING" | "ANALYZING" | "ANALYZED" | "FAILED";
  reviews: "PENDING" | "ANALYZING" | "ANALYZED" | "FAILED" | "NO_REVIEWS";
  outreach: "NEW" | "REACHED_OUT" | "IN_TALKS" | "WON" | "LOST" | null;
  /** Set when the lead has been marked Do-Not-Contact (writes to DiscardedAt or a flag). */
  dnc: boolean;
}

interface NbaShape {
  preliminary: unknown | null;
  final: unknown | null;
  triggers: unknown[];
  insight: unknown | null;
  reasoningGraph: ReasoningGraph | null;
  arbitrationRecords: ContradictionRecord[];
}

interface StakeholderShape {
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

interface MeddpiccCellShape {
  status: "present" | "partial" | "missing";
  evidence: EvidenceRef[];
  /** `champion` and `economicBuyer` carry an attached stakeholderId. */
  stakeholderId?: string | null;
}

interface DealQualificationShape {
  watchlistItemId: string;
  fillCompletePct: number;
  metrics: MeddpiccCellShape;
  economicBuyer: MeddpiccCellShape;
  decisionCriteria: MeddpiccCellShape;
  decisionProcess: MeddpiccCellShape;
  identifyPain: MeddpiccCellShape;
  champion: MeddpiccCellShape;
  competition: MeddpiccCellShape;
}

interface DiscoveryItemShape {
  id: string;
  spinKind: "SITUATION" | "PROBLEM" | "IMPLICATION" | "NEED_PAYOFF";
  text: string;
  evidence: string | null;
  confidence: number;
  createdAt: string;
}

interface DiscoveryShape {
  sessionId: string;
  source: string;
  conductedAt: string;
  items: {
    SITUATION: DiscoveryItemShape[];
    PROBLEM: DiscoveryItemShape[];
    IMPLICATION: DiscoveryItemShape[];
    NEED_PAYOFF: DiscoveryItemShape[];
  };
}

interface AccountSummaryShape {
  id: string;
  name: string;
  tier: "TIER_1" | "TIER_2" | "TIER_3" | "TIER_4" | null;
  locationsCount: number | null;
}

interface ActivityShape {
  id: string;
  kind: string;
  payload: unknown;
  createdAt: string;
}

interface PlanGateShape {
  plan: "FREE" | "PRO" | "PRO_TEAM" | "AGENCY";
  meddpiccUnlocked: boolean;
  spinUnlocked: boolean;
}

export interface DecisionSurfaceResponse {
  leadCore: LeadCoreShape;
  nba: NbaShape | null;
  bant: BantBars | null;
  icpDimensions: IcpDimensionsResult | null;
  stakeholders: StakeholderShape[];
  dealQualification: DealQualificationShape | null;
  latestDiscovery: DiscoveryShape | null;
  recentObjections: ObjectionDiff;
  accountSummary: AccountSummaryShape | null;
  activities: ActivityShape[];
  planGate: PlanGateShape;
  // Phase 3 additive fields. PRO+ only for `closestWin` (per
  // PLAN §5.3); the other two are FREE-friendly.
  closestWin: ClosestWinSummary | null;
  queuePosition: { current: number; totalToday: number } | null;
  recentDialAt: string | null;
  // ===== Phase 2.5 — V1 richness absorption summary fields =====
  // (PLAN §4 Phase 2.5; PLAN §5.9 V1 richness parity checklist).
  // FREE-friendly: intelligenceBrief.headline, recommendedPackage.id,
  //                websiteIntelSummary chip-level data,
  //                reviewIntelSummary leadScore + sentiment, reviewVelocity,
  //                discoveredLinks, subNicheState, dossierStub, pipelineState.
  // PRO+:         personalizedFirstMessage, intelligenceBrief.whyGoodTarget
  //               (full prose), reviewIntelSummary KPI arrays, full
  //               website panel deep-dive (lazy via /website-intel).
  intelligenceBrief: IntelligenceBriefShape | null;
  recommendedPackage: RecommendedPackage | null;
  personalizedFirstMessage: string | null;
  reviewIntelSummary: ReviewIntelSummaryShape | null;
  websiteIntelSummary: WebsiteIntelSummaryShape | null;
  reviewVelocity: ReviewVelocity;
  discoveredLinks: DiscoveredLinksShape;
  subNicheState: SubNicheStateShape;
  dossierStub: DossierStubShape;
  pipelineState: PipelineStateShape;
}

const MEDDPICC_GATE_FILLED = 4;

const COLD_STAGES = new Set(["COLD"]);

function buildEvidenceRefs(
  fact: {
    sourceQuote: string | null;
    sourceRefType: string | null;
    sourceRefId: string | null;
  },
): EvidenceRef[] {
  if (!fact.sourceQuote && !fact.sourceRefType && !fact.sourceRefId) return [];
  const type = chooseEvidenceType(fact.sourceRefType);
  return [
    {
      type,
      sourceQuote: fact.sourceQuote ?? null,
      refType: fact.sourceRefType ?? null,
      refId: fact.sourceRefId ?? null,
    },
  ];
}

function chooseEvidenceType(
  refType: string | null,
): EvidenceRef["type"] {
  if (!refType) return "audit";
  const lower = refType.toLowerCase();
  if (lower.includes("voice")) return "voice-note";
  if (lower.includes("review")) return "review";
  if (lower.includes("linkedin") || lower.includes("stakeholder"))
    return "linkedin";
  if (lower.includes("nba") || lower.includes("action") || lower.includes("plan"))
    return "prior-nba";
  if (lower.includes("contradiction")) return "contradiction";
  return "audit";
}

function rollupMeddpiccFacts(
  facts: Array<{
    id: string;
    fieldPath: string;
    confidence: number;
    sourceQuote: string | null;
    sourceRefType: string | null;
    sourceRefId: string | null;
    supersededAt: Date | null;
  }>,
  qualification: {
    championStakeholderId: string | null;
    economicBuyerStakeholderId: string | null;
  } | null,
): Omit<DealQualificationShape, "watchlistItemId" | "fillCompletePct"> {
  const live = facts.filter((f) => f.supersededAt == null);
  const groupBy = (prefix: string) =>
    live.filter((f) => f.fieldPath.toLowerCase().startsWith(prefix));

  const buckets: Record<keyof Omit<DealQualificationShape, "watchlistItemId" | "fillCompletePct">, typeof live> = {
    metrics: groupBy("metric"),
    economicBuyer: groupBy("economicbuyer"),
    decisionCriteria: groupBy("decisioncriteria"),
    decisionProcess: groupBy("decisionprocess"),
    identifyPain: groupBy("identifypain"),
    champion: groupBy("champion"),
    competition: groupBy("competition"),
  };

  const cell = (group: typeof live): MeddpiccCellShape => {
    if (group.length === 0) return { status: "missing", evidence: [] };
    const evidence = group
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3)
      .flatMap((g) => buildEvidenceRefs(g));
    const meanConfidence =
      group.reduce((sum, f) => sum + f.confidence, 0) / group.length;
    const status: MeddpiccCellShape["status"] =
      meanConfidence >= 0.7 ? "present" : "partial";
    return { status, evidence };
  };

  return {
    metrics: cell(buckets.metrics),
    economicBuyer: {
      ...cell(buckets.economicBuyer),
      stakeholderId: qualification?.economicBuyerStakeholderId ?? null,
    },
    decisionCriteria: cell(buckets.decisionCriteria),
    decisionProcess: cell(buckets.decisionProcess),
    identifyPain: cell(buckets.identifyPain),
    champion: {
      ...cell(buckets.champion),
      stakeholderId: qualification?.championStakeholderId ?? null,
    },
    competition: cell(buckets.competition),
  };
}

function classifyBantRole(s: {
  isEconomicBuyer: boolean;
  isBlocker: boolean;
  championLikelihood: number | null;
}): StakeholderShape["bantRole"] {
  if (s.isEconomicBuyer) return "economic-buyer";
  if (s.isBlocker) return "blocker";
  if ((s.championLikelihood ?? 0) >= 60) return "champion";
  return "stakeholder";
}

function pickWhyNow(args: {
  triggers: Array<{
    impactPrediction: string | null;
    type: string;
    severity: number;
    confidence: number;
    urgencyWindowDays: number | null;
  }>;
  finalNba: { reasoning: string | null } | null;
  preliminaryNba: { reasoning: string | null } | null;
}): { whyNow: string | null; urgencyWindowDays: number | null } {
  const { triggers, finalNba, preliminaryNba } = args;
  if (triggers.length > 0) {
    const sorted = [...triggers].sort((a, b) => {
      if (b.severity !== a.severity) return b.severity - a.severity;
      return b.confidence - a.confidence;
    });
    const top = sorted[0];
    const text = top.impactPrediction
      ? top.impactPrediction
      : top.type.toLowerCase().replace(/_/g, " ");
    return { whyNow: text, urgencyWindowDays: top.urgencyWindowDays };
  }
  const reason = (finalNba ?? preliminaryNba)?.reasoning ?? null;
  return { whyNow: reason, urgencyWindowDays: null };
}

function shouldAutoCreateWatchlist(args: {
  stage: ReturnType<typeof deriveLeadDetailStage>;
  dealQualificationExists: boolean;
  factCount: number;
  watchlistExists: boolean;
  plan: "FREE" | "PRO" | "PRO_TEAM" | "AGENCY";
}): boolean {
  if (args.plan === "FREE") return false;
  if (args.dealQualificationExists) return false;
  if (args.watchlistExists) return false;
  if (COLD_STAGES.has(args.stage)) return false;
  return args.factCount > 0;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireUser();
    const { workspaceId } = session;
    const plan = session.workspace.plan;
    const { id } = await params;

    const lead = await prisma.lead.findFirst({
      where: { id, workspaceId },
      include: {
        websiteAudit: true,
        watchlistItem: true,
        account: true,
        // Phase 2.5 — richness absorption inputs. All scoped via the
        // parent `Lead.workspaceId` so the cross-tenant audit holds.
        salesOpportunity: true,
        reviewAnalysis: true,
        // 50 reviews is the same corpus size the trigger-detector
        // ingests (PLAN §5.6). Reused by `computeReviewVelocity` so
        // we never make a second round-trip for the badge math.
        googleReviews: {
          orderBy: { publishTime: "desc" },
          take: 50,
        },
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const watchlistItemId = lead.watchlistItem?.id ?? null;

    const [
      preliminaryNba,
      finalNba,
      triggers,
      stakeholders,
      qualification,
      qualificationFacts,
      latestDiscoverySession,
      objections,
      icpProfile,
      activities,
      // Phase 3 additive fields:
      insightPerformance,
      lastCallActivity,
      queueTotalToday,
      queueAheadCount,
      // Phase 2.5 additive fields. All scoped via the parent
      // `Lead.workspaceId` (or directly via `workspaceId` on
      // workspace-owned tables) per `multi-tenant-scope.mdc`.
      // Round-trip ceiling raised to ≤ 12 (was 8) per PLAN §6 R17.
      intelligenceBriefRun,
      dossierRun,
      enrichmentRuns,
    ] = await prisma.$transaction([
      prisma.leadNextAction.findFirst({
        where: { workspaceId, leadId: id, isPreliminary: true, supersededAt: null },
        orderBy: { createdAt: "desc" },
      }),
      prisma.leadNextAction.findFirst({
        where: { workspaceId, leadId: id, isPreliminary: false, supersededAt: null },
        orderBy: { createdAt: "desc" },
      }),
      prisma.leadTrigger.findMany({
        where: { workspaceId, leadId: id, decayedAt: null },
        orderBy: { detectedAt: "desc" },
        take: 10,
      }),
      prisma.stakeholder.findMany({
        where: {
          workspaceId,
          OR: [
            { leadId: id },
            ...(lead.accountId ? [{ accountId: lead.accountId }] : []),
          ],
        },
        orderBy: [{ isEconomicBuyer: "desc" }, { championLikelihood: "desc" }],
        take: 24,
      }),
      watchlistItemId
        ? prisma.dealQualification.findFirst({
            where: { workspaceId, watchlistItemId },
          })
        : prisma.dealQualification.findFirst({ where: { workspaceId, watchlistItemId: "__never__" } }),
      watchlistItemId
        ? prisma.dealQualificationFact.findMany({
            where: { workspaceId, watchlistItemId, supersededAt: null },
            orderBy: { extractedAt: "desc" },
            take: 60,
          })
        : prisma.dealQualificationFact.findMany({
            where: { workspaceId, watchlistItemId: "__never__" },
          }),
      prisma.discoverySession.findFirst({
        where: { workspaceId, leadId: id },
        orderBy: { conductedAt: "desc" },
        include: {
          items: {
            orderBy: { createdAt: "desc" },
            take: 60,
          },
        },
      }),
      prisma.objection.findMany({
        where: { workspaceId, leadId: id },
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
      prisma.idealCustomerProfile.findFirst({
        where: { workspaceId },
      }),
      prisma.leadActivity.findMany({
        where: { workspaceId, leadId: id },
        orderBy: { createdAt: "desc" },
        take: 25,
        select: {
          id: true,
          kind: true,
          payload: true,
          createdAt: true,
        },
      }),
      // Phase 3 — closest-win lookup. Bounded by the 50-row cap from
      // PLAN §5.6: small in-memory filter is cheaper than another
      // round-trip per request.
      prisma.insightPerformance.findMany({
        where: { workspaceId, won: { gt: 0 } },
        orderBy: [{ won: "desc" }, { applied: "desc" }],
        take: 50,
      }),
      // Phase 3 — most recent CALL_LOGGED or DISPOSITION_LOGGED activity
      // for the "did the rep dial in the last 5 minutes?" overlay
      // signal. The client also reads localStorage; this is a
      // server-side fallback so a freshly-loaded device still knows.
      prisma.leadActivity.findFirst({
        where: {
          workspaceId,
          leadId: id,
          kind: { in: ["CALL_LOGGED", "DISPOSITION_LOGGED"] },
        },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      // Phase 3 — queue total for the bottom-strip "Today X/Y" counter.
      // Per-rep scope (PLAN §6 risk #14 optimistic claim).
      prisma.lead.count({
        where: {
          workspaceId,
          assignedToUserId: session.user.id,
          archivedAt: null,
          discardedAt: null,
          OR: [
            { snoozeUntil: null },
            { snoozeUntil: { lte: new Date() } },
          ],
        },
      }),
      // Phase 3 — leads ahead of this one in the queue ordering. Used
      // to derive `queuePosition.current` cheaply without re-running
      // the full queue findMany. Same predicate as the queue route's
      // sort: `nextActionDueAt asc nulls last, salesConfidence desc`.
      prisma.lead.count({
        where: {
          workspaceId,
          assignedToUserId: session.user.id,
          archivedAt: null,
          discardedAt: null,
          id: { not: id },
          OR: [
            { snoozeUntil: null },
            { snoozeUntil: { lte: new Date() } },
          ],
          ...(lead.nextActionDueAt
            ? { nextActionDueAt: { lt: lead.nextActionDueAt } }
            : { nextActionDueAt: { not: null } }),
        },
      }),
      // Phase 2.5 — cached LEAD_INTELLIGENCE_BRIEF AgentRun.output.
      // Single most-recent SUCCEEDED run; the analyst writes one
      // brief per refresh. We project a small subset of the
      // outputJson into `IntelligenceBriefShape` below so the wire
      // payload stays small.
      prisma.agentRun.findFirst({
        where: {
          workspaceId,
          leadId: id,
          workerKind: "LEAD_INTELLIGENCE_BRIEF",
          status: "SUCCEEDED",
        },
        orderBy: { finishedAt: "desc" },
        select: {
          id: true,
          outputJson: true,
          finishedAt: true,
        },
      }),
      // Phase 2.5 — most-recent dossier-style run for the
      // "AI dossier →" lazy expand stub. The full markdown body
      // stays under `POST /api/leads/[id]/explain`; here we only
      // need to know whether one exists and surface a snippet.
      prisma.agentRun.findFirst({
        where: {
          workspaceId,
          leadId: id,
          workerKind: "LEAD_DOSSIER_GENERATOR",
          status: "SUCCEEDED",
        },
        orderBy: { finishedAt: "desc" },
        select: {
          id: true,
          outputJson: true,
          finishedAt: true,
        },
      }),
      // Phase 2.5 — recent SUCCEEDED enrichment runs feeding the
      // discovered-links extractor (socials + directories). Same
      // shape the legacy `GET /api/leads/[id]` route consumes; we
      // dedup-by-kind (latest run per worker wins) below.
      prisma.agentRun.findMany({
        where: {
          workspaceId,
          leadId: id,
          status: "SUCCEEDED",
          workerKind: {
            in: [
              "APIFY_GMAPS_DEEP",
              "APIFY_WEB_CRAWL_DEEP",
              "APIFY_INSTAGRAM_DEEP",
              "APIFY_FACEBOOK_DEEP",
              "APIFY_TIKTOK_DEEP",
              "APIFY_LINKEDIN_COMPANY",
              "APIFY_REDDIT_MENTIONS",
              "SOCIAL_SCRAPER",
            ],
          },
        },
        orderBy: { finishedAt: "desc" },
        take: 30,
        select: {
          workerKind: true,
          outputJson: true,
        },
      }),
    ]);

    const stage = deriveLeadDetailStage(
      { lastContactedAt: lead.lastContactedAt },
      lead.watchlistItem
        ? {
            dealStage: lead.watchlistItem.dealStage,
            pipelineStage: lead.watchlistItem.pipelineStage,
          }
        : null,
    );

    const wantsAutoWatchlist = shouldAutoCreateWatchlist({
      stage,
      dealQualificationExists: qualification != null,
      factCount: qualificationFacts.length,
      watchlistExists: watchlistItemId != null,
      plan,
    });

    let watchlistAfterAutoCreate = watchlistItemId;
    if (wantsAutoWatchlist) {
      const upserted = await prisma.watchlistItem.upsert({
        where: { leadId: id },
        create: { leadId: id },
        update: {},
        select: { id: true },
      });
      watchlistAfterAutoCreate = upserted.id;
    }

    const buyingReadiness = deriveBuyingReadiness({
      lead: {
        priceLevel: lead.priceLevel,
        reviewCount: lead.reviewCount,
        rating: lead.rating,
        hasWebsite: lead.hasWebsite,
        icpFitScore: lead.icpFitScore,
      },
      audit: lead.websiteAudit
        ? {
            checklistScorePct: null,
            hasBookingSystem: lead.websiteAudit.hasBookingSystem,
            hasEcommerce: lead.websiteAudit.hasEcommerce,
            mobileFriendlyGuess: lead.websiteAudit.mobileFriendlyGuess,
          }
        : null,
      triggers: triggers.map((t) => ({
        type: t.type,
        severity: t.severity,
        confidence: t.confidence,
        detectedAt: t.detectedAt,
        urgencyWindowDays: t.urgencyWindowDays,
      })),
      stakeholders: stakeholders.map((s) => ({
        isEconomicBuyer: s.isEconomicBuyer,
        championLikelihood: s.championLikelihood,
        influence: s.influence,
      })),
      recentIntentSignalCount: 0,
    });

    const factInputs: BantFactInput[] = qualificationFacts.map((f) => ({
      id: f.id,
      fieldPath: f.fieldPath,
      sourceQuote: f.sourceQuote ?? null,
      confidence: f.confidence,
      supersededAt: f.supersededAt,
    }));

    const bant = deriveBantBars(buyingReadiness, factInputs);

    const icpDimensions = computeIcpDimensions(
      {
        priceLevel: lead.priceLevel,
        reviewCount: lead.reviewCount,
        rating: lead.rating,
        hasWebsite: lead.hasWebsite,
        subNicheSlug: lead.subNicheSlug,
        borough: lead.borough,
        timezone: lead.timezone,
        account: lead.account
          ? { locationsCount: lead.account.locationsCount }
          : null,
        audit: lead.websiteAudit
          ? {
              hasBookingSystem: lead.websiteAudit.hasBookingSystem,
              hasEcommerce: lead.websiteAudit.hasEcommerce,
              mobileFriendlyGuess: lead.websiteAudit.mobileFriendlyGuess,
              checklistScorePct: null,
            }
          : null,
      },
      icpProfile
        ? {
            subNicheWeights: parseNumberRecord(icpProfile.subNicheWeights),
            priceLevelMin: icpProfile.priceLevelMin,
            priceLevelMax: icpProfile.priceLevelMax,
            minReviewCount: icpProfile.minReviewCount,
            minRating: icpProfile.minRating,
            digitalMaturityFloor: icpProfile.digitalMaturityFloor,
            highValueSignals: icpProfile.highValueSignals,
            locationFit: parseRecord(icpProfile.locationFit),
          }
        : null,
      undefined,
    );

    const dealQualificationShape: DealQualificationShape | null =
      qualification != null
        ? {
            watchlistItemId: qualification.watchlistItemId,
            fillCompletePct: qualification.fillCompletePct,
            ...rollupMeddpiccFacts(qualificationFacts, {
              championStakeholderId: qualification.championStakeholderId,
              economicBuyerStakeholderId:
                qualification.economicBuyerStakeholderId,
            }),
          }
        : null;

    const latestDiscovery: DiscoveryShape | null = latestDiscoverySession
      ? {
          sessionId: latestDiscoverySession.id,
          source: latestDiscoverySession.source,
          conductedAt: latestDiscoverySession.conductedAt.toISOString(),
          items: groupSpinItems(latestDiscoverySession.items),
        }
      : null;

    const stakeholdersOut: StakeholderShape[] = stakeholders.map((s) => ({
      id: s.id,
      name: s.name,
      role: s.role,
      email: s.email,
      phone: s.phone,
      linkedinUrl: s.linkedinUrl,
      influence: s.influence,
      championLikelihood: s.championLikelihood,
      isEconomicBuyer: s.isEconomicBuyer,
      isBlocker: s.isBlocker,
      bantRole: classifyBantRole({
        isEconomicBuyer: s.isEconomicBuyer,
        isBlocker: s.isBlocker,
        championLikelihood: s.championLikelihood,
      }),
      source: s.source,
      contacted: s.contacted,
    }));

    const predictedObjections: string[] =
      finalNba?.predictedObjections ?? preliminaryNba?.predictedObjections ?? [];

    const realObjections = objections.filter((o) => o.source === "REAL");
    const recentObjections = deriveObjectionDiff(
      predictedObjections,
      realObjections.map((o) => ({
        id: o.id,
        text: o.text,
        rebuttalUsed: o.rebuttalUsed,
        resolvedAt: o.resolvedAt,
        category: o.category,
      })),
    );

    const accountSummary: AccountSummaryShape | null = lead.account
      ? {
          id: lead.account.id,
          name: lead.account.name,
          tier: lead.account.tier,
          locationsCount: lead.account.locationsCount,
        }
      : null;

    const why = pickWhyNow({
      triggers,
      finalNba,
      preliminaryNba,
    });

    const subNicheLabel = lead.subNicheSlug
      ? lead.subNicheSlug.replace(/[-_]/g, " ")
      : lead.primaryType;

    const leadCore: LeadCoreShape = {
      id: lead.id,
      workspaceId: lead.workspaceId,
      businessName: lead.businessName,
      formattedAddress: lead.formattedAddress,
      borough: lead.borough,
      phone: lead.phone,
      websiteUrl: lead.websiteUrl,
      primaryType: lead.primaryType,
      subNicheSlug: lead.subNicheSlug,
      subNicheLabel,
      accountId: lead.accountId,
      accountTier: lead.account?.tier ?? null,
      watchlist:
        watchlistAfterAutoCreate != null
          ? {
              id: watchlistAfterAutoCreate,
              pipelineStage: lead.watchlistItem?.pipelineStage ?? "NEW",
              dealStage: lead.watchlistItem?.dealStage ?? "PROSPECTING",
            }
          : null,
      lastContactedAt: lead.lastContactedAt?.toISOString() ?? null,
      whyNow: why.whyNow,
      urgencyWindowDays: why.urgencyWindowDays,
      icpFitScore: lead.icpFitScore,
      sourceLat: lead.sourceLat,
      sourceLng: lead.sourceLng,
    };

    const reasoningGraph =
      (finalNba?.reasoningGraph as ReasoningGraph | null) ?? null;
    const arbitrationRecords =
      (finalNba?.arbitrationRecords as ContradictionRecord[] | null) ?? [];

    const nba: NbaShape | null =
      preliminaryNba || finalNba || triggers.length > 0
        ? {
            preliminary: preliminaryNba,
            final: finalNba,
            triggers,
            insight: null,
            reasoningGraph,
            arbitrationRecords,
          }
        : null;

    const planGate: PlanGateShape = {
      plan,
      meddpiccUnlocked: plan !== "FREE",
      spinUnlocked: plan !== "FREE",
    };

    const meddpiccCellsFilled = dealQualificationShape
      ? [
          dealQualificationShape.metrics,
          dealQualificationShape.economicBuyer,
          dealQualificationShape.decisionCriteria,
          dealQualificationShape.decisionProcess,
          dealQualificationShape.identifyPain,
          dealQualificationShape.champion,
          dealQualificationShape.competition,
        ].filter((c) => c.status === "present").length
      : 0;

    const closestWin =
      plan !== "FREE" && meddpiccCellsFilled >= MEDDPICC_GATE_FILLED
        ? findClosestWin(
            workspaceId,
            {
              id: lead.id,
              workspaceId,
              nicheSlug: lead.nicheSlug,
              subNicheSlug: lead.subNicheSlug,
              accountTier: lead.account?.tier ?? null,
              triggerTypes: triggers.map((t) => t.type),
            },
            insightPerformance.map((p) => ({
              id: p.id,
              workspaceId: p.workspaceId,
              insightId: p.insightId,
              nicheSlug: p.nicheSlug,
              triggerType: p.triggerType,
              segmentTier: p.segmentTier,
              framework: p.framework,
              applied: p.applied,
              won: p.won,
              meetingBooked: p.meetingBooked,
            })),
            [],
          )
        : null;

    const queuePosition: { current: number; totalToday: number } | null =
      plan === "FREE"
        ? null
        : {
            current: queueAheadCount + 1,
            totalToday: queueTotalToday,
          };

    const recentDialAt = lastCallActivity?.createdAt
      ? lastCallActivity.createdAt.toISOString()
      : null;

    // ===== Phase 2.5 — V1 richness absorption derivations =====

    // 1. Intelligence brief — projection of cached
    //    LEAD_INTELLIGENCE_BRIEF AgentRun.outputJson.
    const intelligenceBrief = projectIntelligenceBrief(intelligenceBriefRun);

    // 2. Recommended package — workspace-scoped helper resolves the
    //    free-text id; missing/deleted packages return null.
    const recommendedPackage = await resolveRecommendedPackage({
      workspaceId,
      recommendedPackageId: lead.salesOpportunity?.recommendedPackageId ?? null,
      recommendedPackageReason:
        lead.salesOpportunity?.recommendedPackageReason ?? null,
    });

    // 3. Personalized first message — PRO+ surface (FREE sees null,
    //    UI renders the locked CTA).
    const personalizedFirstMessage =
      plan === "FREE"
        ? null
        : (lead.salesOpportunity?.personalizedFirstMessage ?? null);

    // 4. Review intel summary — projection of ReviewAnalysis with
    //    server-side top-3 trims.
    const reviewIntelSummary = projectReviewIntelSummary(lead.reviewAnalysis);

    // 5. Website intel summary — projection of WebsiteAudit.
    const websiteIntelSummary = projectWebsiteIntelSummary(lead.websiteAudit);

    // 6. Review velocity — derived from the same googleReviews rows
    //    BANT timing already needs (no extra query). Per PLAN §4
    //    Phase 2.5 + §6 R20: same shared helper as Phase 8 detector.
    const reviewVelocity = computeReviewVelocity(
      (lead.googleReviews ?? []).map((r) => ({
        rating: r.rating,
        publishTime: r.publishTime,
      })),
    );

    // 7. Discovered links — extractor reuses the legacy logic. We
    //    fetched up to 30 SUCCEEDED enrichment runs; dedup-by-kind
    //    so multiple runs of the same actor don't bias the list.
    const latestRunsByKind = new Map<string, AgentRunForLinks>();
    for (const r of enrichmentRuns) {
      if (!latestRunsByKind.has(r.workerKind)) {
        latestRunsByKind.set(r.workerKind, {
          workerKind: r.workerKind,
          outputJson: r.outputJson,
        });
      }
    }
    const websiteSocials = lead.websiteAudit?.socialProfiles as
      | Record<string, unknown>
      | null
      | undefined;
    const discoveredIgnoreUrls = [
      lead.websiteUrl,
      ...(websiteSocials
        ? Object.values(websiteSocials).filter(
            (v): v is string => typeof v === "string" && v.length > 0,
          )
        : []),
    ].filter((v): v is string => typeof v === "string" && v.length > 0);
    const discoveredLinks = projectDiscoveredLinks(
      Array.from(latestRunsByKind.values()),
      discoveredIgnoreUrls,
    );

    // 8. Sub-niche state — current + version + alternatives. The
    //    `available` list (full sub-niche catalog for the niche pack)
    //    stays under `GET /api/leads/sub-niches`; the lazy menu fetches
    //    it on open so first paint isn't bloated.
    const subNicheState: SubNicheStateShape = {
      current: { slug: lead.subNicheSlug, label: subNicheLabel },
      override: {
        source: lead.subNicheSource,
        confidence: lead.subNicheConfidence,
        version: lead.subNicheVersion,
      },
      alternatives: Array.isArray(lead.subNicheAlternatives)
        ? (lead.subNicheAlternatives as Array<{
            slug?: string;
            confidence?: number;
            reason?: string;
          }>)
            .filter((a) => typeof a?.slug === "string")
            .map((a) => ({
              slug: a.slug as string,
              confidence: typeof a.confidence === "number" ? a.confidence : null,
              reason: typeof a.reason === "string" ? a.reason : null,
            }))
            .slice(0, 5)
        : [],
    };

    // 9. Dossier stub — boolean + last-generated + 220-char snippet.
    //    Full markdown stays lazy under POST /api/leads/[id]/explain.
    const dossierStub = projectDossierStub(dossierRun);

    // 10. Pipeline state — chip-row replacement for the legacy
    //     IdentityRail. DNC = lead has been discarded explicitly.
    const pipelineState: PipelineStateShape = {
      crawl: lead.crawlStatus,
      analyze: lead.analyzeStatus,
      reviews: lead.reviewAnalysisStatus,
      outreach: lead.watchlistItem?.pipelineStage ?? null,
      dnc: lead.discardedAt != null,
    };

    const response: DecisionSurfaceResponse = {
      leadCore,
      nba,
      bant,
      icpDimensions,
      stakeholders: stakeholdersOut,
      dealQualification: dealQualificationShape,
      latestDiscovery,
      recentObjections,
      accountSummary,
      activities: activities.map((a) => ({
        id: a.id,
        kind: a.kind,
        payload: a.payload,
        createdAt: a.createdAt.toISOString(),
      })),
      planGate,
      closestWin,
      queuePosition,
      recentDialAt,
      // Phase 2.5 — V1 richness absorption.
      intelligenceBrief,
      recommendedPackage,
      personalizedFirstMessage,
      reviewIntelSummary,
      websiteIntelSummary,
      reviewVelocity,
      discoveredLinks,
      subNicheState,
      dossierStub,
      pipelineState,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.leads.decision-surface.GET", err);
  }
}

function groupSpinItems(
  items: Array<{
    id: string;
    spinKind: "SITUATION" | "PROBLEM" | "IMPLICATION" | "NEED_PAYOFF";
    text: string;
    evidence: string | null;
    confidence: number;
    createdAt: Date;
  }>,
): DiscoveryShape["items"] {
  const out: DiscoveryShape["items"] = {
    SITUATION: [],
    PROBLEM: [],
    IMPLICATION: [],
    NEED_PAYOFF: [],
  };
  for (const item of items) {
    out[item.spinKind].push({
      id: item.id,
      spinKind: item.spinKind,
      text: item.text,
      evidence: item.evidence,
      confidence: item.confidence,
      createdAt: item.createdAt.toISOString(),
    });
  }
  return out;
}

function parseRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function parseNumberRecord(
  value: unknown,
): Record<string, number> | null {
  const record = parseRecord(value);
  if (!record) return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(record)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

// ===== Phase 2.5 — projection helpers =====

interface IntelligenceBriefRunShape {
  id: string;
  outputJson: unknown;
  finishedAt: Date | null;
}

function projectIntelligenceBrief(
  run: IntelligenceBriefRunShape | null,
): IntelligenceBriefShape | null {
  if (!run) return null;
  const out = parseRecord(run.outputJson);
  if (!out) return null;
  // The brief writer's payload shape is `{ salesConfidence,
  // headline, painPoints[], whyGoodTarget, ... }`. Be defensive —
  // older brief versions might not carry every field.
  const salesConfidence =
    typeof out.salesConfidence === "number" ? out.salesConfidence : null;
  const headline = typeof out.headline === "string" ? out.headline : null;
  const painPoints = Array.isArray(out.painPoints)
    ? (out.painPoints as unknown[])
        .filter((p): p is string => typeof p === "string")
        .slice(0, 6)
    : [];
  const whyGoodTarget =
    typeof out.whyGoodTarget === "string" ? out.whyGoodTarget : null;
  return {
    runId: run.id,
    generatedAt: (run.finishedAt ?? new Date()).toISOString(),
    salesConfidence,
    headline,
    painPoints,
    whyGoodTarget,
  };
}

interface ReviewAnalysisShape {
  weaknessKpis: unknown;
  strengthKpis: unknown;
  sentimentBreakdown: unknown;
  switchSignals: unknown;
  leadScore: number;
  summary: string | null;
  reviewsAnalyzedCount: number;
  analyzedAt: Date;
}

function topKpis(
  raw: unknown,
  limit: number,
): Array<{ label: string; count: number | null; percent: number | null }> {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[])
    .filter(
      (k): k is { label: string; count?: number; percent?: number } =>
        !!k && typeof (k as { label?: unknown }).label === "string",
    )
    .slice(0, limit)
    .map((k) => ({
      label: k.label,
      count: typeof k.count === "number" ? k.count : null,
      percent: typeof k.percent === "number" ? k.percent : null,
    }));
}

function projectReviewIntelSummary(
  ra: ReviewAnalysisShape | null,
): ReviewIntelSummaryShape | null {
  if (!ra) return null;
  const sentiment = parseRecord(ra.sentimentBreakdown) ?? {};
  return {
    leadScore: ra.leadScore,
    summary: ra.summary,
    sentimentBreakdown: {
      positive:
        typeof sentiment.positive === "number" ? sentiment.positive : null,
      neutral:
        typeof sentiment.neutral === "number" ? sentiment.neutral : null,
      negative:
        typeof sentiment.negative === "number" ? sentiment.negative : null,
    },
    weaknessKpisTop3: topKpis(ra.weaknessKpis, 3),
    strengthKpisTop3: topKpis(ra.strengthKpis, 3),
    switchSignalsTop3: Array.isArray(ra.switchSignals)
      ? (ra.switchSignals as unknown[])
          .filter((s): s is string => typeof s === "string")
          .slice(0, 3)
      : [],
    reviewsAnalyzedCount: ra.reviewsAnalyzedCount,
    lastAnalyzedAt: ra.analyzedAt.toISOString(),
  };
}

interface WebsiteAuditShape {
  reachable: boolean;
  crawlError: string | null;
  crawlAttemptedAt: Date | null;
  httpStatus: number | null;
  loadTimeMs: number | null;
  https: boolean;
  mobileFriendlyGuess: boolean;
  hasContactForm: boolean;
  hasWhatsappLink: boolean;
  hasBookingSystem: boolean;
  bookingProvider: string | null;
  hasEcommerce: boolean;
  servicesDetected: unknown;
  title: string | null;
  metaDescription: string | null;
}

function projectWebsiteIntelSummary(
  audit: WebsiteAuditShape | null,
): WebsiteIntelSummaryShape | null {
  if (!audit) return null;
  let crawlStatus: WebsiteIntelSummaryShape["crawlStatus"] = null;
  if (audit.crawlAttemptedAt == null) {
    crawlStatus = "never";
  } else if (audit.reachable) {
    crawlStatus = "ok";
  } else if (
    audit.crawlError === "BOT_BLOCKED_4XX" ||
    (audit.httpStatus != null && audit.httpStatus >= 400 && audit.httpStatus < 500)
  ) {
    crawlStatus = "blocked";
  } else {
    crawlStatus = "error";
  }
  return {
    hasBookingSystem: audit.hasBookingSystem,
    bookingProvider: audit.bookingProvider,
    loadTimeMs: audit.loadTimeMs,
    https: audit.https,
    mobileFriendlyGuess: audit.mobileFriendlyGuess,
    hasContactForm: audit.hasContactForm,
    hasWhatsappLink: audit.hasWhatsappLink,
    hasEcommerce: audit.hasEcommerce,
    servicesDetectedTop5: Array.isArray(audit.servicesDetected)
      ? (audit.servicesDetected as unknown[])
          .filter((s): s is string => typeof s === "string")
          .slice(0, 5)
      : [],
    title: audit.title,
    metaDescription: audit.metaDescription,
    crawlStatus,
    lastAuditedAt: audit.crawlAttemptedAt?.toISOString() ?? null,
  };
}

function projectDiscoveredLinks(
  runs: AgentRunForLinks[],
  ignoreUrls: string[],
): DiscoveredLinksShape {
  const extracted = extractDiscoveredLinks({
    agentRuns: runs,
    ignoreUrls,
    maxPerPlatform: 3,
  });
  // The extractor returns a flat `DiscoveredLink[]`. The V2 UI wants
  // the social/directory split (per PLAN §4 Phase 2.5
  // `WhoBlock`/`StakeholderOnlinePresence` + `AccountBlock` directories
  // strip), so we partition by category here.
  const socials: DiscoveredLinksShape["socials"] = [];
  const directories: DiscoveredLinksShape["directories"] = [];
  for (const link of extracted) {
    if (link.category === "social") {
      socials.push({ platform: link.platform, url: link.url });
    } else if (link.category === "directory" || link.category === "review" || link.category === "registry") {
      directories.push({
        name: link.title ?? link.platform,
        url: link.url,
      });
    }
    // `maps` (google_maps) is the lead's own GMB — already on the
    // lead row, no need to surface again.
  }
  return { socials, directories };
}

interface DossierRunShape {
  id: string;
  outputJson: unknown;
  finishedAt: Date | null;
}

function projectDossierStub(
  run: DossierRunShape | null,
): DossierStubShape {
  if (!run) {
    return { hasDossier: false, lastGeneratedAt: null, summarySnippet: null };
  }
  const out = parseRecord(run.outputJson) ?? {};
  // The dossier writer stores the markdown on a `markdown` (or
  // `summary`) key; either one becomes the snippet. Hard-cap at
  // 220 chars so the wire payload stays small.
  const candidate =
    (typeof out.summary === "string" ? out.summary : null) ??
    (typeof out.markdown === "string" ? out.markdown : null) ??
    (typeof out.body === "string" ? out.body : null);
  let snippet: string | null = null;
  if (candidate) {
    const oneLine = candidate.replace(/\s+/g, " ").trim();
    snippet = oneLine.length > 220 ? `${oneLine.slice(0, 219)}…` : oneLine;
  }
  return {
    hasDossier: true,
    lastGeneratedAt: (run.finishedAt ?? new Date()).toISOString(),
    summarySnippet: snippet,
  };
}
