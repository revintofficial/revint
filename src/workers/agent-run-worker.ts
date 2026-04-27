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
import { Worker, type Job, UnrecoverableError } from "bullmq";
import IORedis from "ioredis";
import { logger } from "../lib/logger";
import { executeAgentRun } from "../lib/agent-workers/execute";
import { isRetryable } from "../lib/agent-workers/errors";

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
    logger.info("worker.ai_runs.agent_run.starting", { runId, attempt: job.attemptsMade });
    try {
      // Pass isRetry so executeAgentRun can reset a FAILED row (set by a
      // previous attempt's RetryableError) back to RUNNING before re-executing.
      await executeAgentRun(runId, { isRetry: job.attemptsMade > 0 });
    } catch (err) {
      if (!isRetryable(err)) {
        // Surface as UnrecoverableError so BullMQ stops retrying
        // schema / quota / grounding failures that would just fail
        // again with the same payload. The AgentRun row is already
        // marked FAILED by executeAgentRun before it rethrows.
        const msg = err instanceof Error ? err.message : String(err);
        throw new UnrecoverableError(`permanent: ${msg}`);
      }
      throw err; // RetryableError — BullMQ retries with backoff
    }
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
    // Lock duration: how long BullMQ holds the job lock before
    // assuming the worker is dead. Must be > the longest possible job
    // duration (180s outer deadline). 240s = 4 min gives 60s buffer.
    // Without this, a process restart mid-job can cause the job to
    // be stalled and re-queued while the original is still running,
    // leading to duplicate execution.
    lockDuration: 240_000,
    // How often BullMQ checks for stalled jobs. 30s means a dead
    // worker is detected within 30s of its lock expiry.
    stalledInterval: 30_000,
    // Allow at most 1 stall per job before marking it failed. Without
    // this, a stuck job can stall indefinitely across restarts.
    maxStalledCount: 1,
    settings: {
      backoffStrategy: (attemptsMade: number) =>
        Math.min(60000, 1000 * Math.pow(2, attemptsMade)),
    },
  });

  worker.on("completed", (job) => {
    logger.info("worker.ai_runs.job_completed", { jobId: job.id });
  });
  worker.on("failed", async (job, err) => {
    logger.error("worker.ai_runs.job_failed", { jobId: job?.id, err: err?.message });

    // When all retry attempts are exhausted (or the error is UnrecoverableError),
    // the AgentRun row may still be FAILED from the last rethrow without the
    // planner session having been notified. Notify it now so the session can
    // advance to FAILED rather than stalling in EXECUTING indefinitely.
    if (!job) return;
    const data = job.data as AgentRunJob;
    if (inferJobType(data) !== "agent_run") return;
    const runId = "runId" in data ? data.runId : undefined;
    if (!runId) return;

    // `failed` fires on every attempt, including intermediate ones that
    // will be retried. Only act on the final failure.
    const isFinalFailure =
      err instanceof UnrecoverableError ||
      job.attemptsMade >= ((job.opts as { attempts?: number })?.attempts ?? 1);
    if (!isFinalFailure) return;

    try {
      const { prisma: p } = await import("../lib/prisma");
      const run = await p.agentRun.findUnique({
        where: { id: runId },
        select: { plannerSessionId: true, status: true },
      });
      if (!run || run.status === "SUCCEEDED") return;

      // Ensure the run has a definitive FAILED status with a clear message.
      await p.agentRun.updateMany({
        where: { id: runId, status: { notIn: ["SUCCEEDED", "CANCELLED"] } },
        data: {
          status: "FAILED",
          finishedAt: new Date(),
          errorMsg: `retries_exhausted: ${err?.message ?? "unknown"}`.slice(0, 2000),
        },
      });

      if (run.plannerSessionId) {
        const { enqueueAdvance } = await import("../lib/ai-core/orchestrator");
        await enqueueAdvance(run.plannerSessionId);
      }
    } catch (notifyErr) {
      logger.error("worker.ai_runs.failed_handler_notify_error", {
        runId,
        err: notifyErr instanceof Error ? notifyErr.message : String(notifyErr),
      });
    }
  });

  return worker;
}
