/**
 * REVIEW_ANALYST worker wrapper for AI Core.
 *
 * Registry adapter over the existing `analyzeReviewsWithGemini`
 * function in `src/lib/gemini.ts` + the ReviewAnalysis upsert from
 * `src/workers/review-analysis-worker.ts`.
 *
 * The orchestrator calls this twice in the `user_deep_research`
 * chain: once for the initial ingestion-time analysis, once after
 * APIFY_GMAPS_DEEP imports 500+ reviews. Both runs write to the
 * same ReviewAnalysis row; idempotent.
 *
 * Memory writes: each pain phrase becomes a REVIEW_CHUNK row so the
 * copilot and opener writer can retrieve them semantically ("leads
 * where reviewers complain about wait times" works).
 */
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { analyzeReviewsWithGemini } from "@/lib/gemini";
import type {
  AgentWorkerContext,
  AgentWorkerOutput,
  AgentWorkerRun,
  MemoryWrite,
} from "./types";

export const run: AgentWorkerRun = async (ctx): Promise<AgentWorkerOutput> => {
  if (!ctx.lead) throw new Error("REVIEW_ANALYST requires a lead context");
  const leadId = ctx.lead.id;

  await prisma.lead.update({
    where: { id: leadId },
    data: { reviewAnalysisStatus: "ANALYZING" },
  });

  try {
    const lead = await prisma.lead.findUniqueOrThrow({
      where: { id: leadId },
      include: {
        workspace: { select: { offerName: true, valueProposition: true } },
        googleReviews: { orderBy: { publishTime: "desc" }, take: 50 },
      },
    });

    if (lead.googleReviews.length === 0) {
      await prisma.lead.update({
        where: { id: leadId },
        data: { reviewAnalysisStatus: "NO_REVIEWS" },
      });
      return { output: { skipped: true, reason: "no_reviews" }, costTokens: 0 };
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

    logger.info("agent_workers.review_analyst.done", {
      leadId,
      leadScore: analysis.leadScore,
    });

    return {
      output: {
        leadScore: analysis.leadScore,
        painPhrases: analysis.painPhrases,
        strengthPhrases: analysis.strengthPhrases,
        summary: analysis.summary,
        reviewsAnalyzedCount: analysis.reviewsAnalyzedCount,
      },
      costTokens: Math.ceil(JSON.stringify(analysis).length / 4),
    };
  } catch (error) {
    await prisma.lead.update({
      where: { id: leadId },
      data: { reviewAnalysisStatus: "FAILED" },
    });
    throw error;
  }
};

export const memoryWrites = (
  output: unknown,
  ctx: AgentWorkerContext,
): MemoryWrite[] => {
  if (!ctx.leadId) return [];
  const o = output as {
    painPhrases?: unknown;
    strengthPhrases?: unknown;
    summary?: string;
    leadScore?: number;
  };
  const writes: MemoryWrite[] = [];

  if (o.summary && typeof o.summary === "string") {
    writes.push({
      kind: "REVIEW_CHUNK",
      text: `Review summary: ${o.summary}`,
      leadId: ctx.leadId,
      refType: "review_summary",
      refId: ctx.leadId,
      metadata: { leadScore: o.leadScore ?? null, source: "review_analyst" },
    });
  }

  const pains = Array.isArray(o.painPhrases)
    ? (o.painPhrases as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  pains.slice(0, 8).forEach((phrase, i) => {
    writes.push({
      kind: "REVIEW_CHUNK",
      text: phrase,
      leadId: ctx.leadId,
      refType: "pain_phrase",
      refId: `${ctx.leadId}:pain:${i}`,
      metadata: { polarity: "negative", source: "review_analyst" },
    });
  });

  const strengths = Array.isArray(o.strengthPhrases)
    ? (o.strengthPhrases as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  strengths.slice(0, 6).forEach((phrase, i) => {
    writes.push({
      kind: "REVIEW_CHUNK",
      text: phrase,
      leadId: ctx.leadId,
      refType: "strength_phrase",
      refId: `${ctx.leadId}:strength:${i}`,
      metadata: { polarity: "positive", source: "review_analyst" },
    });
  });

  return writes;
};
