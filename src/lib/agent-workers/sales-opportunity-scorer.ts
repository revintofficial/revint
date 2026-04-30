/**
 * SALES_OPPORTUNITY_SCORER worker wrapper for AI Core.
 *
 * Registry adapter over the existing analyze pipeline. Computes the
 * deterministic score, calls Gemini for the qualitative analysis,
 * blends the two into a 0-100 opportunity score and persists into
 * `SalesOpportunity`.
 *
 * Re-entrant: the `user_deep_research` chain calls this a second
 * time after Apify enrichment has updated review + competitor data.
 * Each run overwrites the row (last-write-wins).
 */
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  analyzeLeadWithGemini,
  type AnalysisActiveCampaign,
  type ReviewContextForAnalysis,
} from "@/lib/gemini";
import { calculateDeterministicScore } from "@/lib/scoring";
import type { WebsiteFeatures } from "@/types";
import type {
  AgentWorkerContext,
  AgentWorkerOutput,
  AgentWorkerRun,
  MemoryWrite,
} from "./types";

/**
 * Loose case-insensitive match between a lead's niche slugs and a
 * workspace's target / campaign niche tag. We compare both child
 * slug and parent slug because reps often filter by parent ("fnb")
 * while leads land with a child slug ("fnb-bar-club"), and vice
 * versa.
 */
function matchesNiche(
  lead: { nicheSlug: string | null; subNicheSlug: string | null },
  candidate: string | null,
): boolean {
  if (!candidate) return false;
  const c = candidate.toLowerCase().trim();
  if (!c) return false;
  const a = (lead.subNicheSlug ?? "").toLowerCase();
  const b = (lead.nicheSlug ?? "").toLowerCase();
  if (!a && !b) return false;
  // Direct match either way.
  if (a === c || b === c) return true;
  // Hierarchy match — e.g. campaign tag "fnb" should match lead
  // sub-niche "fnb-bar-club", and campaign tag "fnb-bar-club"
  // should match a lead whose parent niche is "fnb" only when
  // the parent is identical to the campaign root.
  if (a && (a.startsWith(`${c}-`) || c.startsWith(`${a}-`))) return true;
  if (b && (b.startsWith(`${c}-`) || c.startsWith(`${b}-`))) return true;
  return false;
}

/**
 * Deterministic ICP-fit adjustment — sits next to the prompt-level
 * rule so a misbehaving Gemini output cannot drop the signal. Returns
 * the bonus/penalty + the reason code that callers should merge into
 * `reason_codes`.
 *
 * Bonus  : +5  when the lead matches an active campaign niche OR is
 *              in `targetSubNiches`.
 * Penalty: -8  when `targetSubNiches` is non-empty AND the lead is
 *              outside it (and no campaign matches it either).
 * Neutral:  0  when targetSubNiches is empty AND no campaign matches.
 */
function computeIcpFitAdjustment(
  lead: { nicheSlug: string | null; subNicheSlug: string | null },
  targetSubNiches: string[],
  activeCampaigns: AnalysisActiveCampaign[],
): { delta: number; code: "icp_fit" | "outside_icp" | null; matchedCampaignId: string | null } {
  const matchedCampaign = activeCampaigns.find((c) => matchesNiche(lead, c.niche));
  const inTargetList =
    targetSubNiches.length > 0 &&
    targetSubNiches.some((slug) => matchesNiche(lead, slug));

  if (matchedCampaign || inTargetList) {
    return {
      delta: +5,
      code: "icp_fit",
      matchedCampaignId: matchedCampaign?.id ?? null,
    };
  }
  if (targetSubNiches.length > 0) {
    return { delta: -8, code: "outside_icp", matchedCampaignId: null };
  }
  return { delta: 0, code: null, matchedCampaignId: null };
}

export const run: AgentWorkerRun = async (ctx): Promise<AgentWorkerOutput> => {
  if (!ctx.lead) throw new Error("SALES_OPPORTUNITY_SCORER requires a lead context");
  const leadId = ctx.lead.id;

  await prisma.lead.update({
    where: { id: leadId },
    data: { analyzeStatus: "ANALYZING" },
  });

  try {
    const lead = await prisma.lead.findUniqueOrThrow({
      where: { id: leadId },
      include: { websiteAudit: true, reviewAnalysis: true },
    });
    const features = lead.websiteAudit?.rawFeaturesJson as unknown as WebsiteFeatures | null;

    const { score: deterministicScore, reasons } = calculateDeterministicScore(
      lead.hasWebsite,
      lead.rating,
      lead.reviewCount,
      features,
    );

    // Build the grounded review context for Gemini. ReviewAnalysis
    // arrays are stored as JSON on Postgres, so coerce them to
    // string[] defensively. Empty arrays + null summary are
    // tolerated downstream and trigger the "no review data" branch
    // in the prompt builder.
    const ra = lead.reviewAnalysis;
    const reviewContext: ReviewContextForAnalysis | null = ra
      ? {
          summary: ra.summary ?? null,
          painPhrases: Array.isArray(ra.painPhrases)
            ? (ra.painPhrases as unknown[]).filter(
                (x): x is string => typeof x === "string",
              )
            : [],
          strengthPhrases: Array.isArray(ra.strengthPhrases)
            ? (ra.strengthPhrases as unknown[]).filter(
                (x): x is string => typeof x === "string",
              )
            : [],
          reviewsAnalyzedCount: ra.reviewsAnalyzedCount ?? 0,
        }
      : null;

    // When Gemini fails we must NOT silently substitute a fake "AI
    // analysis" with canned copy - that fake analysis then flows into
    // SalesOpportunity, UI surfaces, memory writes, and downstream
    // workers (OPENER_WRITER reads bestSalesAngle + painPoints) as if
    // it were real. Instead, the run fails, the pipeline records the
    // failure, and the existing SalesOpportunity row (if any) stays
    // intact. The deterministic score is logged for observability.
    // Confidence gate (P0.4): below 0.7 from an AUTO classification we
    // pass `subNicheSlug = null` so the prompt falls back to the parent
    // F&B framing instead of writing "we'll set up your <wrong-vertical>"
    // claims. MANUAL overrides skip the gate (rep is gold-standard) by
    // sending confidence 1.0 regardless of the stored value.
    const subNicheTrusted =
      lead.subNicheSlug != null &&
      (lead.subNicheSource === "MANUAL" ||
        (lead.subNicheConfidence ?? 0) >= 0.7);
    const effectiveSubNiche = subNicheTrusted ? lead.subNicheSlug : null;
    const effectiveSubNicheConfidence = subNicheTrusted
      ? lead.subNicheSource === "MANUAL"
        ? 1.0
        : lead.subNicheConfidence ?? null
      : null;

    // Pre-load the workspace's priced tiers so Gemini can pick a
    // package_id from the rep's actual price card instead of inventing
    // generic STARTER/GROWTH/SALES copy. Empty list -> prompt falls
    // back to the legacy enum, so non-FineDine tenants stay unaffected.
    // Also load the workspace's full personalization context (target
    // sub-niches) and the live sales campaigns (Sequences) so the
    // analyst can reward leads that fit what THIS team actually sells
    // and is currently running outbound for.
    const [servicePackages, workspaceFull, activeSequences] = await Promise.all([
      prisma.servicePackage.findMany({
        where: { workspaceId: ctx.workspace.id },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          priceLabel: true,
          features: true,
          isPopular: true,
        },
      }),
      prisma.workspace.findUnique({
        where: { id: ctx.workspace.id },
        select: { targetSubNiches: true },
      }),
      prisma.sequence.findMany({
        where: { workspaceId: ctx.workspace.id, archivedAt: null },
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: { id: true, name: true, niche: true, description: true },
      }),
    ]);

    const targetSubNiches = workspaceFull?.targetSubNiches ?? [];
    const activeCampaigns: AnalysisActiveCampaign[] = activeSequences.map((s) => ({
      id: s.id,
      name: s.name,
      niche: s.niche ?? null,
      description: s.description ?? null,
    }));

    const analysis = await analyzeLeadWithGemini(
      lead.businessName,
      lead.formattedAddress,
      lead.rating,
      lead.reviewCount,
      lead.websiteUrl,
      features,
      ctx.workspace.language ?? "en",
      {
        niche: ctx.workspace.niche ?? null,
        offerName: ctx.workspace.offerName ?? null,
        valueProposition: ctx.workspace.valueProposition ?? null,
        language: ctx.workspace.language ?? null,
        subNicheSlug: effectiveSubNiche,
        subNicheConfidence: effectiveSubNicheConfidence,
        servicePackages,
        // Personalization signals — see `AnalysisWorkspaceContext`.
        objective: ctx.workspace.objective ?? null,
        tone: ctx.workspace.tone ?? null,
        offerHook: ctx.workspace.offerHook ?? null,
        socialProof: ctx.workspace.socialProof ?? null,
        senderName: ctx.workspace.senderName ?? null,
        targetSubNiches,
        activeCampaigns,
      },
      reviewContext,
    );

    // Deterministic ICP-fit adjustment. Sits next to the prompt-level
    // rule so reps see the same bonus/penalty regardless of Gemini's
    // mood. Applied to the BLENDED final score (after the 0.4/0.6
    // blend) and merged into reason_codes so the UI can render a
    // chip ("ICP fit" / "Outside ICP") off a single signal.
    const icpAdjustment = computeIcpFitAdjustment(
      { nicheSlug: lead.nicheSlug, subNicheSlug: lead.subNicheSlug },
      targetSubNiches,
      activeCampaigns,
    );

    // Validate the package id Gemini returned: it must match an id
    // we actually sent in the prompt. Models occasionally invent ids
    // ("pkg-premium-plus") even when given a fixed list, and a
    // dangling FK-less recommendation in the DB confuses the rep.
    // Drop unknown ids silently and clear the reason; the UI then
    // shows the legacy suggestedOffer enum instead.
    const validPackageIds = new Set(servicePackages.map((p) => p.id));
    const recommendedPackageId =
      typeof analysis.recommended_package_id === "string" &&
      validPackageIds.has(analysis.recommended_package_id)
        ? analysis.recommended_package_id
        : null;
    const recommendedPackageReason = recommendedPackageId
      ? typeof analysis.recommended_package_reason === "string"
        ? analysis.recommended_package_reason.slice(0, 600)
        : null
      : null;

    const blendedScore = Math.round(
      deterministicScore * 0.4 + analysis.opportunity_score * 0.6,
    );
    // Apply the deterministic ICP-fit delta on top of the blend, then
    // clamp to [0, 100]. Gemini may also have applied its own bonus
    // via the prompt rule — that double-counts intentionally, since
    // it represents "the analyst chose this lead because it fits the
    // ICP" PLUS "math says it does", which is the exact intent.
    const finalScore = Math.max(
      0,
      Math.min(100, blendedScore + icpAdjustment.delta),
    );
    const mergedReasons = Array.from(
      new Set([
        ...reasons,
        ...analysis.reason_codes,
        ...(icpAdjustment.code ? [icpAdjustment.code] : []),
      ]),
    );

    // suggestedOffer + expectedPriceBand are deprecated (P0.4). The
    // dossier owns the package recommendation now; the column survives
    // for legacy data but the write path leaves it at the schema
    // default (STARTER) on first create and untouched on update so we
    // can't accidentally pin a stale tier on a re-analyze.
    await prisma.salesOpportunity.upsert({
      where: { leadId },
      create: {
        leadId,
        opportunityScore: finalScore,
        reasonCodes: mergedReasons,
        whyGoodTarget: analysis.why_good_target,
        likelyPainPoints: analysis.likely_pain_points,
        bestSalesAngle: analysis.best_sales_angle,
        personalizedFirstMessage: analysis.personalized_first_message,
        recommendedPackageId,
        recommendedPackageReason,
        status: "NEW",
      },
      update: {
        opportunityScore: finalScore,
        reasonCodes: mergedReasons,
        whyGoodTarget: analysis.why_good_target,
        likelyPainPoints: analysis.likely_pain_points,
        bestSalesAngle: analysis.best_sales_angle,
        personalizedFirstMessage: analysis.personalized_first_message,
        recommendedPackageId,
        recommendedPackageReason,
      },
    });

    await prisma.lead.update({
      where: { id: leadId },
      data: { analyzeStatus: "ANALYZED" },
    });

    logger.info("agent_workers.scorer.done", {
      leadId,
      score: finalScore,
      blendedScore,
      icpDelta: icpAdjustment.delta,
      icpCode: icpAdjustment.code,
      matchedCampaignId: icpAdjustment.matchedCampaignId,
    });

    return {
      output: {
        opportunityScore: finalScore,
        reasonCodes: mergedReasons,
        whyGoodTarget: analysis.why_good_target,
        likelyPainPoints: analysis.likely_pain_points,
        bestSalesAngle: analysis.best_sales_angle,
        personalizedFirstMessage: analysis.personalized_first_message,
        recommendedPackageId,
        recommendedPackageReason,
        // Surface ICP fit so the UI can render "Enroll in <campaign>"
        // and the leads list can filter on icp_fit / outside_icp.
        icpFit: {
          delta: icpAdjustment.delta,
          code: icpAdjustment.code,
          matchedCampaignId: icpAdjustment.matchedCampaignId,
        },
      },
      costTokens: Math.ceil(JSON.stringify(analysis).length / 4),
    };
  } catch (error) {
    await prisma.lead.update({
      where: { id: leadId },
      data: { analyzeStatus: "FAILED" },
    });
    throw error;
  }
};

/**
 * SALES_OPPORTUNITY_SCORER intentionally does NOT produce a
 * LEAD_PROFILE memory write: the `embedLeadProfile` sentinel runs at
 * the tail of both `lead_created` and `user_deep_research` chains and
 * writes a richer profile (with review + audit context) keyed on
 * `refType: "lead", refId: leadId`. A second scorer-emitted write
 * keyed on `refType: "sales_opportunity"` would not collide at the
 * DB level but would surface two LEAD_PROFILE rows for the same lead
 * in retrieval (memory.ts query returns both), poisoning few-shot
 * slots with an older + newer version of the same lead. Keeping the
 * sentinel as the single writer is the correct invariant.
 */
export const memoryWrites = (
  _output: unknown,
  _ctx: AgentWorkerContext,
): MemoryWrite[] => [];
