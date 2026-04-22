/**
 * AI Core - unified agent-runs BullMQ worker.
 *
 * Handles every AI Core job type off the single `agent-runs` queue.
 * Job payload is a discriminated union:
 *
 *   { type: "agent_run", runId }             -> executeAgentRun
 *   { type: "orchestrator_advance", sessionId } -> orchestrator.advance
 *   { type: "embed", memoryId }              -> re-embed a memory row
 *
 * Keeping one worker process + one queue (rather than the legacy
 * per-worker queues) means concurrency and Gemini rate-limiting apply
 * to all AI work uniformly. Legacy intelligence queues (crawl,
 * analyze, review-analysis, email-verification) still exist for the
 * ingestion pipeline that predates AI Core; their migration into
 * chains happens in a follow-up PR.
 */
import { Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { logger } from "../lib/logger";
import { executeAgentRun } from "../lib/agent-workers/execute";

type AgentRunJob =
  | { type: "agent_run"; runId: string }
  | { type: "orchestrator_advance"; sessionId: string }
  | { type: "embed"; memoryId: string }
  // Legacy payload shape (pre-discriminator). Anything posted before
  // this worker upgrade lands without a `type` field. We infer
  // `agent_run` when `runId` is present.
  | { runId: string };

async function processJob(job: Job<AgentRunJob>) {
  const data = job.data;

  // Backward compat: jobs without a `type` field are agent_runs.
  const jobType = inferJobType(data);

  if (jobType === "agent_run") {
    const runId = "runId" in data ? data.runId : undefined;
    if (!runId) {
      logger.warn("worker.ai_runs.agent_run_missing_runId", { jobId: job.id });
      return;
    }
    logger.info("worker.ai_runs.agent_run.starting", { runId });
    await executeAgentRun(runId);
    return { runId };
  }

  if (jobType === "orchestrator_advance") {
    const sessionId = "sessionId" in data ? data.sessionId : undefined;
    if (!sessionId) {
      logger.warn("worker.ai_runs.advance_missing_sessionId", { jobId: job.id });
      return;
    }
    const { advance } = await import("../lib/ai-core/orchestrator");
    const result = await advance(sessionId);
    logger.info("worker.ai_runs.advance.done", {
      sessionId,
      scheduled: result.scheduled.length,
      status: result.status,
    });
    return result;
  }

  if (jobType === "embed") {
    const memoryId = "memoryId" in data ? data.memoryId : undefined;
    if (!memoryId) {
      logger.warn("worker.ai_runs.embed_missing_memoryId", { jobId: job.id });
      return;
    }
    await processEmbedJob(memoryId);
    return { memoryId };
  }

  logger.warn("worker.ai_runs.unknown_job_type", { jobId: job.id, type: jobType });
}

function inferJobType(
  data: AgentRunJob,
): "agent_run" | "orchestrator_advance" | "embed" | "unknown" {
  if ("type" in data && typeof data.type === "string") {
    return data.type as "agent_run" | "orchestrator_advance" | "embed";
  }
  if ("runId" in data && typeof data.runId === "string") return "agent_run";
  return "unknown";
}

/**
 * Re-embeds a SemanticMemory row. Called when a row was inserted
 * without an embedding (the fast write path) and needs its vector
 * populated asynchronously.
 */
async function processEmbedJob(memoryId: string): Promise<void> {
  const { prisma } = await import("../lib/prisma");
  const row = await prisma.semanticMemory.findUnique({
    where: { id: memoryId },
    select: { id: true, text: true },
  });
  if (!row) {
    logger.warn("worker.ai_runs.embed.row_missing", { memoryId });
    return;
  }
  const { embed } = await import("../lib/ai-core/embed");
  const { writeEmbedding } = await import("../lib/ai-core/memory");
  const vec = await embed(row.text);
  await writeEmbedding(memoryId, vec);
  logger.info("worker.ai_runs.embed.done", { memoryId });
}

export function startAgentRunWorker() {
  const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });

  const worker = new Worker<AgentRunJob>("agent-runs", processJob, {
    connection,
    // Keep concurrency conservative; the bottleneck is Gemini quota.
    // Apify-backed workers have their own timeouts and are mostly
    // waiting, so they don't consume a Gemini slot.
    concurrency: 5,
    limiter: { max: 60, duration: 60000 },
  });

  worker.on("completed", (job) => {
    logger.info("worker.ai_runs.job_completed", { jobId: job.id });
  });
  worker.on("failed", (job, err) => {
    logger.error("worker.ai_runs.job_failed", { jobId: job?.id, err: err?.message });
  });

  return worker;
}
