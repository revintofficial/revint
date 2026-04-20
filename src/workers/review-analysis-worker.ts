/**
 * P0.1 - Review Intelligence v1 worker.
 *
 * Reads up to 50 GoogleReview rows for a lead, calls Gemini 2.5 Flash to
 * produce KPI bar aggregation (weakness/strength %, sentiment, pain phrases,
 * switch signals, lead score), and upserts the result into ReviewAnalysis.
 *
 * Triggered by:
 *   - POST /api/reviews/[leadId]/analyze (manual)
 *   - Auto-enqueued after fresh reviews are fetched (future enhancement)
 *
 * Concurrency: 5. Limiter: 20/min (Gemini quota friendly).
 */

import { Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { analyzeReviewsWithGemini } from "../lib/gemini";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

interface ReviewAnalysisJobData {
  leadId: string;
}

async function processReviewAnalysis(job: Job<ReviewAnalysisJobData>) {
  const { leadId } = job.data;
  logger.info("worker.review_analysis.starting", { leadId });

  await prisma.lead.update({
    where: { id: leadId },
    data: { reviewAnalysisStatus: "ANALYZING" },
  });

  try {
    const lead = await prisma.lead.findUniqueOrThrow({
      where: { id: leadId },
      include: {
        workspace: { select: { offerName: true, valueProposition: true } },
        googleReviews: {
          orderBy: { publishTime: "desc" },
          take: 50,
        },
      },
    });

    if (lead.googleReviews.length === 0) {
      await prisma.lead.update({
        where: { id: leadId },
        data: { reviewAnalysisStatus: "NO_REVIEWS" },
      });
      logger.info("worker.review_analysis.no_reviews", { leadId });
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

    logger.info("worker.review_analysis.done", {
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

export function startReviewAnalysisWorker() {
  const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });

  const worker = new Worker<ReviewAnalysisJobData>("review-analysis", processReviewAnalysis, {
    connection,
    concurrency: 5,
    limiter: { max: 20, duration: 60_000 },
  });

  worker.on("completed", (job) => {
    logger.info("worker.review_analysis.job_completed", { jobId: job.id });
  });

  worker.on("failed", (job, err) => {
    logger.error("worker.review_analysis.job_failed", { jobId: job?.id, err });
  });

  return worker;
}
