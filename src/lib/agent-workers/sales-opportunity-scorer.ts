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
    const servicePackages = await prisma.servicePackage.findMany({
      where: { workspaceId: ctx.workspace.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        priceLabel: true,
        features: true,
        isPopular: true,
      },
    });

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
      },
      reviewContext,
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

    const finalScore = Math.min(
      100,
      Math.round(deterministicScore * 0.4 + analysis.opportunity_score * 0.6),
    );
    const mergedReasons = Array.from(new Set([...reasons, ...analysis.reason_codes]));

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

    logger.info("agent_workers.scorer.done", { leadId, score: finalScore });

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
