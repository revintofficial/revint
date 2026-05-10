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
}

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
