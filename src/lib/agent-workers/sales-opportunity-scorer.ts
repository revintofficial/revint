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
import { analyzeLeadWithGemini } from "@/lib/gemini";
import {
  calculateDeterministicScore,
  suggestOffer,
  estimatePriceBand,
} from "@/lib/scoring";
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
      include: { websiteAudit: true },
    });
    const features = lead.websiteAudit?.rawFeaturesJson as unknown as WebsiteFeatures | null;

    const { score: deterministicScore, reasons } = calculateDeterministicScore(
      lead.hasWebsite,
      lead.rating,
      lead.reviewCount,
      features,
    );

    // When Gemini fails we must NOT silently substitute a fake "AI
    // analysis" with canned copy - that fake analysis then flows into
    // SalesOpportunity, UI surfaces, memory writes, and downstream
    // workers (OPENER_WRITER reads bestSalesAngle + painPoints) as if
    // it were real. Instead, the run fails, the pipeline records the
    // failure, and the existing SalesOpportunity row (if any) stays
    // intact. The deterministic score is logged for observability.
    const analysis = await analyzeLeadWithGemini(
      lead.businessName,
      lead.formattedAddress,
      lead.rating,
      lead.reviewCount,
      lead.websiteUrl,
      features,
      ctx.workspace.language ?? "en",
    );

    const finalScore = Math.min(
      100,
      Math.round(deterministicScore * 0.4 + analysis.opportunity_score * 0.6),
    );
    const mergedReasons = Array.from(new Set([...reasons, ...analysis.reason_codes]));
    const finalOffer = analysis.suggested_offer || suggestOffer(finalScore, mergedReasons);

    await prisma.salesOpportunity.upsert({
      where: { leadId },
      create: {
        leadId,
        opportunityScore: finalScore,
        reasonCodes: mergedReasons,
        whyGoodTarget: analysis.why_good_target,
        likelyPainPoints: analysis.likely_pain_points,
        bestSalesAngle: analysis.best_sales_angle,
        suggestedOffer: finalOffer.toUpperCase() as "STARTER" | "GROWTH" | "SALES",
        personalizedFirstMessage: analysis.personalized_first_message,
        expectedPriceBand: analysis.expected_price_band || estimatePriceBand(finalOffer),
        status: "NEW",
      },
      update: {
        opportunityScore: finalScore,
        reasonCodes: mergedReasons,
        whyGoodTarget: analysis.why_good_target,
        likelyPainPoints: analysis.likely_pain_points,
        bestSalesAngle: analysis.best_sales_angle,
        suggestedOffer: finalOffer.toUpperCase() as "STARTER" | "GROWTH" | "SALES",
        personalizedFirstMessage: analysis.personalized_first_message,
        expectedPriceBand: analysis.expected_price_band || estimatePriceBand(finalOffer),
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
        suggestedOffer: finalOffer,
        expectedPriceBand: analysis.expected_price_band,
        personalizedFirstMessage: analysis.personalized_first_message,
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
