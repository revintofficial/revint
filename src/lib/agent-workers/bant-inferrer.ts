/**
 * BANT_INFERRER worker (T1 deterministic).
 *
 * Computes the BANT (Budget, Authority, Need, Timing) view via the
 * pure-function deriver in `@/lib/sdr-brain/buying-readiness`, then
 * writes a PRELIMINARY `LeadNextAction` row so the lead detail UI can
 * render an NBA card within ~3-5s of `lead_created` emit, before the
 * full T3 SDR_BRAIN run finishes (~15-25s later).
 *
 * The preliminary row carries `isPreliminary = true` and confidence=40.
 * T3 SDR_BRAIN later upserts a `isPreliminary = false` row with full
 * arbitration + reasoningGraph, then stamps `supersededAt = now()` on
 * the preliminary one. The UI hides superseded preliminaries.
 *
 * No Gemini call here — entirely deterministic. Token cost is 0.
 */
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { deriveBuyingReadiness } from "@/lib/sdr-brain/buying-readiness";
import { derivePreliminaryNba } from "@/lib/sdr-brain/preliminary-nba";
import { runAuditChecklist } from "@/lib/audit-checklist";
import type { WebsiteFeatures } from "@/types";
import type {
  AgentWorkerContext,
  AgentWorkerOutput,
  AgentWorkerRun,
  MemoryWrite,
} from "./types";
import { REASONING_SUMMARY_REF_TYPES } from "./reasoning-ref-types";

export const run: AgentWorkerRun = async (
  ctx: AgentWorkerContext,
): Promise<AgentWorkerOutput> => {
  if (!ctx.lead) throw new Error("BANT_INFERRER requires a lead context");
  const lead = ctx.lead;
  const workspaceId = ctx.workspaceId;

  // 1. Read the active LeadTrigger rows (decayedAt IS NULL).
  const triggers = await prisma.leadTrigger.findMany({
    where: { workspaceId, leadId: lead.id, decayedAt: null },
    select: {
      id: true,
      type: true,
      severity: true,
      confidence: true,
      detectedAt: true,
      urgencyWindowDays: true,
    },
  });

  // 2. Stakeholder map for authority dimension.
  const stakeholders = await prisma.stakeholder.findMany({
    where: { workspaceId, leadId: lead.id },
    select: {
      isEconomicBuyer: true,
      championLikelihood: true,
      influence: true,
    },
  });

  // 3. Recent intent signals — count of voice notes + activities in last 14d.
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const recentIntentSignalCount = await prisma.leadActivity.count({
    where: {
      workspaceId,
      leadId: lead.id,
      createdAt: { gte: fourteenDaysAgo },
      kind: { in: ["EMAIL_REPLIED", "MEETING_BOOKED", "DISPOSITION_LOGGED", "NOTE"] },
    },
  });

  // 4. Audit checklist score (cheap; same helper LEAD_INTELLIGENCE_BRIEF uses).
  const features = (lead.websiteAudit?.rawFeaturesJson as WebsiteFeatures | null) ?? null;
  const checklist = runAuditChecklist(
    features,
    lead.hasWebsite,
    ctx.workspace.niche,
    lead.subNicheSlug,
  );

  // 5. Derive BANT (pure).
  //
  // Phase 3 — pass the full v1-intel narrative so Need/Timing/Budget
  // dimensions reflect ReviewAnalysis + SalesOpportunity + Account
  // rather than the thin Lead-only baseline. Every new field is
  // optional in `BuyingReadinessInput`, so older call sites still
  // work; the deriver self-skips when the intel isn't present.
  const ra = lead.reviewAnalysis;
  const opp = lead.salesOpportunity;
  const account = lead.account ?? null;
  const reviewIntel = ra
    ? {
        painPhrases: Array.isArray(ra.painPhrases)
          ? (ra.painPhrases as string[])
          : [],
        weaknessKpis: Array.isArray(ra.weaknessKpis)
          ? (ra.weaknessKpis as Array<{
              label: string;
              count?: number;
              percent?: number;
            }>)
          : [],
        switchSignals: Array.isArray(ra.switchSignals)
          ? (ra.switchSignals as string[])
          : [],
        leadScore: ra.leadScore,
      }
    : null;
  const salesOpportunity = opp
    ? {
        likelyPainPoints: Array.isArray(opp.likelyPainPoints)
          ? (opp.likelyPainPoints as string[])
          : [],
        reasonCodes: Array.isArray(opp.reasonCodes)
          ? (opp.reasonCodes as string[])
          : [],
        opportunityScore: opp.opportunityScore,
        suggestedOffer: opp.suggestedOffer,
      }
    : null;
  const accountIntel = account
    ? {
        locationsCount: account.locationsCount,
        tier: account.tier,
      }
    : null;

  const bant = deriveBuyingReadiness({
    lead: {
      priceLevel: lead.priceLevel,
      reviewCount: lead.reviewCount,
      rating: lead.rating,
      hasWebsite: lead.hasWebsite,
      icpFitScore: lead.icpFitScore,
      salesConfidence: lead.salesConfidence,
      icpReasons: Array.isArray(lead.icpReasons)
        ? (lead.icpReasons as unknown[])
        : [],
    },
    audit: lead.websiteAudit
      ? {
          checklistScorePct: features ? checklist.summary.scorePercent : null,
          hasBookingSystem: lead.websiteAudit.hasBookingSystem,
          hasEcommerce: lead.websiteAudit.hasEcommerce,
          mobileFriendlyGuess: lead.websiteAudit.mobileFriendlyGuess,
        }
      : null,
    triggers,
    stakeholders,
    recentIntentSignalCount,
    reviewIntel,
    salesOpportunity,
    account: accountIntel,
  });

  // 6. Preliminary NBA derivation.
  //
  // Phase 3 — pass the analyst's `likelyPainPoints` so the
  // preliminary card surfaces predicted objections before the T3
  // brain pass overwrites them. Empty array when SalesOpportunity
  // isn't ready yet.
  const preliminary = derivePreliminaryNba({
    bant,
    lead: {
      icpFitScore: lead.icpFitScore,
      dnc: lead.dnc,
      optedOutAt: lead.optedOutAt,
      timezone: lead.timezone,
      hasWebsite: lead.hasWebsite,
      websiteUrl: lead.websiteUrl,
    },
    triggerCount: triggers.length,
    likelyPainPoints: salesOpportunity?.likelyPainPoints ?? [],
  });

  // 7. Upsert the preliminary LeadNextAction. We supersede any earlier
  // preliminary row so the UI never sees two competing previews. The
  // T3 SDR_BRAIN later writes a non-preliminary row and supersedes
  // this one in turn.
  await prisma.leadNextAction.updateMany({
    where: {
      workspaceId,
      leadId: lead.id,
      isPreliminary: true,
      supersededAt: null,
    },
    data: { supersededAt: new Date() },
  });

  // version increments per lead — get the highest existing + 1
  const lastVersion = await prisma.leadNextAction.findFirst({
    where: { workspaceId, leadId: lead.id },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (lastVersion?.version ?? 0) + 1;

  await prisma.leadNextAction.create({
    data: {
      workspaceId,
      leadId: lead.id,
      version: nextVersion,
      isPreliminary: true,
      actionKind: preliminary.actionKind,
      timingWindowStart: preliminary.timingWindowStart,
      timingWindowEnd: preliminary.timingWindowEnd,
      channel: preliminary.channel,
      triggerIds: preliminary.triggerIds,
      qualificationGap: preliminary.qualificationGap,
      predictedObjections: preliminary.predictedObjections,
      whatNotToPitch: [],
      confidence: preliminary.confidence,
      reasoning: preliminary.reasoning,
      reasoningGraph: null,
      arbitrationRecords: [],
    },
  });

  logger.info("agent_workers.bant_inferrer.done", {
    leadId: lead.id,
    workspaceId,
    overall: bant.overall,
    preliminaryAction: preliminary.actionKind,
    version: nextVersion,
  });

  return {
    output: {
      bant,
      preliminary: {
        ...preliminary,
        version: nextVersion,
      },
    },
    costTokens: 0,
  };
};

/**
 * Surfaces the BANT summary into REASONING_SUMMARY memory so the T3
 * SDR_BRAIN prompt can reference it without a follow-up DB read.
 */
export function memoryWrites(output: unknown, ctx: AgentWorkerContext): MemoryWrite[] {
  if (!ctx.leadId) return [];
  const o = output as {
    bant: { overall: number; budget: number; authority: number; need: number; timing: number };
  };
  return [
    {
      kind: "REASONING_SUMMARY",
      text: `BANT — overall ${o.bant.overall} (B${o.bant.budget}/A${o.bant.authority}/N${o.bant.need}/T${o.bant.timing}).`,
      leadId: ctx.leadId,
      // Phase 0 hot-fix — was "BANT_INFERRER" (SCREAMING_SNAKE_CASE),
      // but `lead-intelligence-brief.ts` reader expects PascalCase
      // (`BantInferrer`). Every refType now flows through
      // `REASONING_SUMMARY_REF_TYPES` so the casing cannot drift.
      refType: REASONING_SUMMARY_REF_TYPES.BantInferrer,
      refId: ctx.runId,
      metadata: { bant: o.bant },
      skipEmbed: true, // structured numbers — no value in vectorising
    },
  ];
}
