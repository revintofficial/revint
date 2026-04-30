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
import { runReviewAnalysisJob } from "@/lib/review-analysis/run-job";
import { logger } from "../lib/logger";

interface ReviewAnalysisJobData {
  leadId: string;
}

async function processReviewAnalysis(job: Job<ReviewAnalysisJobData>) {
  return runReviewAnalysisJob(job.data.leadId);
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
