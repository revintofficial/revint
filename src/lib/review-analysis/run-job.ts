/**
 * Shared review-analysis execution: BullMQ worker and HTTP inline fallback
 * both call this so logic stays single-sourced.
 */

import { analyzeReviewsWithGemini } from "@/lib/gemini";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  filterReviewKpis,
  normalizeForGrounding,
} from "@/lib/review-analysis/kpi-filter";

export async function runReviewAnalysisJob(leadId: string): Promise<{
  leadId: string;
  skipped?: boolean;
  leadScore?: number;
}> {
  logger.info("review_analysis.job_started", { leadId });

  await prisma.lead.update({
    where: { id: leadId },
    data: { reviewAnalysisStatus: "ANALYZING" },
  });

  try {
    const lead = await prisma.lead.findUniqueOrThrow({
      where: { id: leadId },
      include: {
        workspace: { select: { offerName: true, valueProposition: true, niche: true } },
        googleReviews: {
          orderBy: { publishTime: "desc" },
          // 220 is the Gemini KPI-bar context cap — same value used by
          // the AI Core review-analyst worker (`src/lib/agent-workers/
          // review-analyst.ts`). A 500-review F&B corpus + label-
          // whitelist responseSchema overflows gemini-2.5-flash's
          // practical context ceiling. The trigger-detector's
          // REVIEW_VOLUME_* rule + the decision-surface badge math
          // both still see the full 500-row corpus via their own
          // queries — only this Gemini-bound path is narrowed.
          take: 220,
        },
      },
    });

    if (lead.googleReviews.length === 0) {
      await prisma.lead.update({
        where: { id: leadId },
        data: { reviewAnalysisStatus: "NO_REVIEWS" },
      });
      logger.info("review_analysis.no_reviews", { leadId });
      return { leadId, skipped: true };
    }

    const ourOffer = lead.workspace.valueProposition
      ? `${lead.workspace.offerName ?? "Web Sitesi Hizmeti"}: ${lead.workspace.valueProposition}`
      : null;

    const analysis = await analyzeReviewsWithGemini({
      businessName: lead.businessName,
      address: lead.formattedAddress,
      rating: lead.rating,
      reviewCount: lead.reviewCount,
      reviews: lead.googleReviews.map((r) => ({
        authorName: r.authorName,
        rating: r.rating,
        text: r.text,
        relativeTime: r.relativeTime,
      })),
      ourOffer,
      workspaceNiche: lead.workspace.niche,
    });

    // Beta finding §2/§3: same KPI post-process filter the AI Core
    // path applies in `review-analyst.ts`. Centralised in
    // `kpi-filter.ts` so both code paths produce identical
    // (count, percent, examples) tuples — including dropping single-
    // reviewer KPIs and re-deriving percent from the true pool size.
    const corpusNormalized = lead.googleReviews
      .map((r) => normalizeForGrounding(r.text ?? ""))
      .filter(Boolean);
    const negativePoolCount = lead.googleReviews.filter(
      (r) => r.rating > 0 && r.rating <= 2,
    ).length;
    const positivePoolCount = lead.googleReviews.filter(
      (r) => r.rating >= 4,
    ).length;
    const weaknessFiltered = filterReviewKpis(
      analysis.weaknessKpis,
      negativePoolCount,
      corpusNormalized,
      { kind: "weakness" },
    );
    const strengthFiltered = filterReviewKpis(
      analysis.strengthKpis,
      positivePoolCount,
      corpusNormalized,
      { kind: "strength" },
    );
    analysis.weaknessKpis = weaknessFiltered.kpis;
    analysis.strengthKpis = strengthFiltered.kpis;
    logger.info("review_analysis.kpi_filter", {
      leadId,
      weaknessIn: weaknessFiltered.stats.inCount,
      weaknessOut: weaknessFiltered.stats.outCount,
      weaknessDroppedPoolFloor: weaknessFiltered.stats.droppedForPoolFloor,
      weaknessDroppedCountInflation: weaknessFiltered.stats.droppedForCountInflation,
      weaknessDroppedLabelFusion: weaknessFiltered.stats.droppedForLabelFusion,
      strengthIn: strengthFiltered.stats.inCount,
      strengthOut: strengthFiltered.stats.outCount,
      strengthDroppedPoolFloor: strengthFiltered.stats.droppedForPoolFloor,
      negativePool: negativePoolCount,
      positivePool: positivePoolCount,
    });

    await prisma.reviewAnalysis.upsert({
      where: { leadId },
      create: {
        leadId,
        reviewsAnalyzedCount: analysis.reviewsAnalyzedCount,
        weaknessKpis: analysis.weaknessKpis,
        strengthKpis: analysis.strengthKpis,
        sentimentBreakdown: analysis.sentimentBreakdown,
        painPhrases: analysis.painPhrases,
        strengthPhrases: analysis.strengthPhrases,
        switchSignals: analysis.switchSignals,
        leadScore: analysis.leadScore,
        summary: analysis.summary,
      },
      update: {
        reviewsAnalyzedCount: analysis.reviewsAnalyzedCount,
        weaknessKpis: analysis.weaknessKpis,
        strengthKpis: analysis.strengthKpis,
        sentimentBreakdown: analysis.sentimentBreakdown,
        painPhrases: analysis.painPhrases,
        strengthPhrases: analysis.strengthPhrases,
        switchSignals: analysis.switchSignals,
        leadScore: analysis.leadScore,
        summary: analysis.summary,
        analyzedAt: new Date(),
      },
    });

    await prisma.lead.update({
      where: { id: leadId },
      data: { reviewAnalysisStatus: "ANALYZED" },
    });

    logger.info("review_analysis.done", {
      leadId,
      businessName: lead.businessName,
      leadScore: analysis.leadScore,
    });
    return { leadId, leadScore: analysis.leadScore };
  } catch (error) {
    await prisma.lead.update({
      where: { id: leadId },
      data: { reviewAnalysisStatus: "FAILED" },
    });
    throw error;
  }
}
