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
  // C1 fix: every `embed` job MUST carry the workspaceId of the row
  // that owns the memory. The worker uses it as the second tenant
  // guard before writing the embedding back, so a mis-routed payload
  // pointing at someone else's memoryId no-ops instead of corrupting
  // a victim workspace's vector. Legacy payloads without it are
  // refused (see processEmbedJob).
  | { type: "embed"; memoryId: string; workspaceId: string }
  // Phase 2 — native sequence engine. `sequence_tick` scans for due
  // LeadSequenceState rows and enqueues `sequence_step` jobs for the
  // ones that are ACTIVE + due. `sequence_step` actually fires the
  // outbound action (email, whatsapp, manual call reminder) for one
  // (lead, sequence, step) tuple. Both reuse the agent-runs queue —
  // no new BullMQ queue per the architecture rule.
  | { type: "sequence_tick" }
  | { type: "sequence_step"; stateId: string }
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
    const workspaceId =
      "workspaceId" in data && typeof (data as { workspaceId?: unknown }).workspaceId === "string"
        ? (data as { workspaceId: string }).workspaceId
        : undefined;
    if (!memoryId) {
      logger.warn("worker.ai_runs.embed_missing_memoryId", { jobId: job.id });
      return;
    }
    if (!workspaceId) {
      // C1: refuse legacy payloads that don't carry the tenant. A
      // re-embed without a workspaceId could overwrite a victim
      // workspace's vector if the memoryId was guessed or replayed.
      // UnrecoverableError stops BullMQ from retrying — the bad
      // payload won't pass on attempt 2 either.
      logger.error("worker.ai_runs.embed_missing_workspaceId", {
        jobId: job.id,
        memoryId,
      });
      throw new UnrecoverableError("embed job payload missing workspaceId");
    }
    await processEmbedJob(memoryId, workspaceId);
    return { memoryId };
  }

  if (jobType === "sequence_tick") {
    const { processSequenceTick } = await import("../lib/sequence-engine/tick");
    const result = await processSequenceTick();
    logger.info("worker.ai_runs.sequence_tick.done", { ...result });
    return result;
  }

  if (jobType === "sequence_step") {
    const stateId = "stateId" in data ? (data as { stateId: string }).stateId : undefined;
    if (!stateId) {
      logger.warn("worker.ai_runs.sequence_step_missing_stateId", { jobId: job.id });
      return;
    }
    const { processSequenceStep } = await import("../lib/sequence-engine/step");
    const result = await processSequenceStep(stateId);
    logger.info("worker.ai_runs.sequence_step.done", { stateId, ...result });
    return result;
  }

  logger.warn("worker.ai_runs.unknown_job_type", { jobId: job.id, type: jobType });
}

function inferJobType(
  data: AgentRunJob,
): "agent_run" | "orchestrator_advance" | "embed" | "sequence_tick" | "sequence_step" | "unknown" {
  if ("type" in data && typeof data.type === "string") {
    return data.type as
      | "agent_run"
      | "orchestrator_advance"
      | "embed"
      | "sequence_tick"
      | "sequence_step";
  }
  if ("runId" in data && typeof data.runId === "string") return "agent_run";
  return "unknown";
}

/**
 * Re-embeds a SemanticMemory row. Called when a row was inserted
 * without an embedding (the fast write path) and needs its vector
 * populated asynchronously.
 *
 * C1 fix: both reads (the row lookup) and writes (the embedding
 * UPDATE) are scoped to `workspaceId`. The lookup goes through the
 * memory facade so the workspace_id constraint is applied at the
 * Prisma layer; if the row is missing OR belongs to a different
 * workspace the worker logs and returns without ever calling the
 * embedding endpoint or touching the DB.
 */
async function processEmbedJob(memoryId: string, workspaceId: string): Promise<void> {
  const { findScopedMemoryRow, writeEmbedding } = await import("../lib/ai-core/memory");
  const row = await findScopedMemoryRow({ workspaceId, memoryId });
  if (!row) {
    logger.warn("worker.ai_runs.embed.row_missing_or_cross_tenant", {
      memoryId,
      workspaceId,
    });
    return;
  }
  const { embed } = await import("../lib/ai-core/embed");
  const vec = await embed(row.text);
  await writeEmbedding(memoryId, vec, workspaceId);
  logger.info("worker.ai_runs.embed.done", { memoryId, workspaceId });
}

/**
 * Periodic watchdog that reconciles stuck PlannerSession rows.
 *
 * Why we need this in addition to the lazy per-AgentRun watchdog in
 * `GET /api/agent-runs/[id]`: the lazy watchdog only fires when
 * something fetches the run row, and it only handles AgentRuns - not
 * the PlannerSession layer. If the worker process is killed between
 * "AgentRun.status = SUCCEEDED" and `safeNotifyOrchestrator` (or if
 * Redis briefly drops the orchestrator_advance job), the session
 * sits in EXECUTING forever with all its agent_runs already terminal.
 *
 * Symptom this prevents (observed on workspace
 * 5496e39e-cc76-41bd-b18b-f1128fb9e41b on 2026-04-27): 91 leads
 * discovered, ~330 worker runs completed, then the worker process
 * exited mid-batch. Score + dossier never enqueued because the
 * advance job was lost; only 2 of 91 leads ended up fully analyzed.
 * On worker restart, this watchdog picks up where the lost advance
 * left off.
 */
interface StuckSessionWatchdog {
  close: () => void;
}

function startStuckSessionWatchdog(): StuckSessionWatchdog {
  // Stale-after window: a session that hasn't moved for 2 minutes
  // with no in-flight runs is, by definition, stuck. The
  // orchestrator's advance() is idempotent so a false positive (we
  // re-advance a session that was about to advance anyway) is a
  // no-op via the advisory lock.
  const staleAfterMs = 2 * 60 * 1000;
  // Tick interval: 60 seconds. Long enough to not thrash the DB,
  // short enough that the human-perceived stall is bounded by ~3
  // minutes total (2-min staleness + 1-min tick).
  const tickIntervalMs = 60 * 1000;

  const tick = async () => {
    try {
      const { recoverStuckSessions } = await import("../lib/ai-core/orchestrator");
      const { recovered, sessionIds } = await recoverStuckSessions({
        staleAfterMs,
        limit: 50,
      });
      if (recovered > 0) {
        logger.info("worker.ai_runs.watchdog_recovered_sessions", {
          count: recovered,
          sessionIds,
        });
      }
    } catch (err) {
      logger.error("worker.ai_runs.watchdog_tick_failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  };

  // Initial tick is delayed so the worker has time to fully boot
  // before we start scanning. After the first tick, run on a fixed
  // interval - setInterval is fine here because tick() is awaited
  // inside the closure and any overlap is harmless (advance() is
  // advisory-locked).
  const initialDelay = setTimeout(() => {
    void tick();
  }, 30_000);

  const interval = setInterval(() => {
    void tick();
  }, tickIntervalMs);

  return {
    close: () => {
      clearTimeout(initialDelay);
      clearInterval(interval);
    },
  };
}

export function startAgentRunWorker() {
  const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });

  const worker = new Worker<AgentRunJob>("agent-runs", processJob, {
    connection,
    // Concurrency tuned together with the Prisma pool (worker pool=25,
    // see src/lib/prisma.ts). 15 was too aggressive: combined with the
    // sibling crawl/analyze/review/email-verification workers running
    // in the same node, peak DB demand (~33 concurrent jobs × 1-2 conns
    // each) blew past the pool's connectionTimeoutMillis, surfacing as
    // pg "Connection terminated due to connection timeout" and FAILED
    // AgentRun rows. 10 keeps the agent-runs queue's share of the pool
    // around 60% utilisation (10 jobs × 1.5 conns avg = 15 of 25),
    // leaving headroom for the legacy intelligence queues.
    //
    // At 10 concurrency × ~12s avg sync duration we still clear ~50
    // jobs/min, comfortably under the 150/min Gemini rate limiter.
    concurrency: 10,
    limiter: { max: 150, duration: 60000 },
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

  const watchdogHandle = startStuckSessionWatchdog();

  const baseClose = worker.close.bind(worker);
  worker.close = async (force?: boolean) => {
    watchdogHandle.close();
    return baseClose(force);
  };

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
      if (!run || run.status === "SUCCEEDED" || run.status === "SUCCEEDED_NO_MEMORY") return;

      // Ensure the run has a definitive FAILED status with a clear message.
      await p.agentRun.updateMany({
        where: { id: runId, status: { notIn: ["SUCCEEDED", "SUCCEEDED_NO_MEMORY", "CANCELLED"] } },
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
