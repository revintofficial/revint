/**
 * AI Workers - generic agent-runs BullMQ worker.
 *
 * Picks agent-runs jobs off the BullMQ queue and delegates to the
 * shared `executeAgentRun()` function. The same executor runs inline
 * in the API handler when Redis is unavailable, so the two code paths
 * stay behaviorally identical.
 */
import { Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { logger } from "../lib/logger";
import { executeAgentRun } from "../lib/agent-workers/execute";

interface AgentRunJobData {
  runId: string;
}

async function processAgentRun(job: Job<AgentRunJobData>) {
  const { runId } = job.data;
  logger.info("worker.agent_run.starting", { runId });
  await executeAgentRun(runId);
  return { runId };
}

export function startAgentRunWorker() {
  const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });

  const worker = new Worker<AgentRunJobData>("agent-runs", processAgentRun, {
    connection,
    // Keep concurrency conservative; the bottleneck is Gemini quota.
    concurrency: 3,
    limiter: { max: 30, duration: 60000 },
  });

  worker.on("completed", (job) => {
    logger.info("worker.agent_run.job_completed", { jobId: job.id });
  });
  worker.on("failed", (job, err) => {
    logger.error("worker.agent_run.job_failed", { jobId: job?.id, err: err?.message });
  });

  return worker;
}
