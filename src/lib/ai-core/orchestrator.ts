/**
 * AI Core - orchestrator.
 *
 * Walks a PlannerSession's DAG. On each `advance(sessionId)` call:
 *
 *   1. Load the session and its persisted plan.
 *   2. For each step with status = PENDING whose every dependsOn
 *      step is SUCCEEDED (or SKIPPED for optional ones), create an
 *      AgentRun row + enqueue it.
 *   3. If all steps are in a terminal state (SUCCEEDED / FAILED /
 *      SKIPPED), mark the session COMPLETED or FAILED.
 *
 * `advance()` is idempotent and race-safe: the plan JSON column is
 * updated with an optimistic check on the existing status, so two
 * concurrent advance calls cannot both schedule the same step.
 *
 * Sentinel steps (SENTINEL_STEPS) are handled inline: instead of
 * enqueuing a worker, the orchestrator performs the side effect
 * directly (embed lead profile, write opener outcome) and marks the
 * step SUCCEEDED in the same transaction.
 */
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getAgentRunsQueue } from "@/lib/queues";
import { computeIdempotencyKey } from "@/lib/agent-workers/idempotency";
import { SENTINEL_STEPS } from "./chains";
import type { PersistedPlan, PersistedPlanStep } from "./planner";
import type { AgentWorkerKind, PlannerStatus } from "@/generated/prisma/client";

export interface AdvanceResult {
  sessionId: string;
  status: PlannerStatus;
  scheduled: string[];   // stepIds enqueued this call
  completed: boolean;
}

/**
 * Enqueues an `orchestrator_advance` job. The ai-runs worker handles
 * the job type and calls `advance()` server-side so multiple callers
 * (executor post-run hook, webhook handler, cron retry) do not need
 * to import the orchestrator directly.
 *
 * Redis-unavailable fallback: if the BullMQ queue cannot be reached
 * (dev machine without Redis, transient outage) we call `advance()`
 * inline in the request path. This keeps the feature working without
 * Redis at the cost of concurrency; recommended for prod to have
 * Redis running.
 */
export async function enqueueAdvance(sessionId: string): Promise<void> {
  try {
    const queue = getAgentRunsQueue();
    await queue.add(
      `advance:${sessionId}:${Date.now()}`,
      { type: "orchestrator_advance", sessionId },
      {
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );
  } catch (err) {
    logger.warn("orchestrator.enqueue_fallback_inline", {
      sessionId,
      err: err instanceof Error ? err.message : String(err),
    });
    // Fire-and-forget inline execution. We do NOT await to keep the
    // HTTP request fast. If advance() itself throws, we mark the session
    // FAILED so it does not stall silently in EXECUTING forever with no
    // caller coming back to unblock it.
    advance(sessionId).catch(async (e) => {
      logger.error("orchestrator.inline_advance_failed", {
        sessionId,
        err: e instanceof Error ? e.message : String(e),
      });
      try {
        await prisma.plannerSession.updateMany({
          where: {
            id: sessionId,
            status: { notIn: ["COMPLETED", "FAILED", "CANCELLED"] },
          },
          data: { status: "FAILED" },
        });
      } catch (updateErr) {
        logger.error("orchestrator.inline_advance_session_fail_update_failed", {
          sessionId,
          err: updateErr instanceof Error ? updateErr.message : String(updateErr),
        });
      }
    });
  }
}

/**
 * Namespace identifier for advisory locks owned by the orchestrator,
 * used as the first key of pg_try_advisory_lock(int4, int4). Arbitrary
 * constant; picked so it is stable and unlikely to collide with other
 * callers of advisory locks in the same database.
 */
const ORCHESTRATOR_LOCK_NAMESPACE = 0x4F524348; // "ORCH"

/**
 * Hashes a session id into a signed 32-bit integer for the second key
 * argument of `pg_try_advisory_lock(int4, int4)`. A collision means
 * two unrelated sessions briefly serialize on the same lock -- harmless,
 * just a momentary wait while one releases. The (namespace, id) pair
 * makes real collisions astronomically unlikely.
 */
function sessionLockId(sessionId: string): number {
  let h = 5381 | 0;
  for (let i = 0; i < sessionId.length; i++) {
    h = (Math.imul(33, h) ^ sessionId.charCodeAt(i)) | 0;
  }
  return h;
}

/**
 * Runs one iteration of the DAG walk. Safe to call repeatedly; each
 * invocation schedules any newly-ready steps and updates session
 * status when the graph terminates.
 *
 * Concurrency: `advance()` takes a Postgres session-level advisory
 * lock keyed on the sessionId before reading the plan. Concurrent
 * advance calls for the same session serialize on this lock; callers
 * that find the lock already held return immediately as no-op
 * (a later advance triggered by the still-running call will re-read
 * the up-to-date plan and pick up where we left off). Without this
 * two advance calls could both observe a PENDING step whose deps are
 * satisfied, both insert an AgentRun row, and both enqueue BullMQ
 * jobs -- duplicate Apify spend, duplicate memory writes.
 */
export async function advance(sessionId: string): Promise<AdvanceResult> {
  const key1 = ORCHESTRATOR_LOCK_NAMESPACE;
  const key2 = sessionLockId(sessionId);
  const lockRows = await prisma.$queryRaw<Array<{ got: boolean }>>`
    SELECT pg_try_advisory_lock(${key1}::int4, ${key2}::int4) AS got
  `;
  const gotLock = lockRows[0]?.got === true;
  if (!gotLock) {
    logger.info("orchestrator.advance_skipped_locked", { sessionId });
    const existing = await prisma.plannerSession.findUnique({
      where: { id: sessionId },
      select: { status: true },
    });
    return {
      sessionId,
      status: existing?.status ?? "EXECUTING",
      scheduled: [],
      completed: false,
    };
  }

  try {
    return await advanceLocked(sessionId);
  } finally {
    await prisma.$executeRaw`SELECT pg_advisory_unlock(${key1}::int4, ${key2}::int4)`;
  }
}

async function advanceLocked(sessionId: string): Promise<AdvanceResult> {
  const session = await prisma.plannerSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      workspaceId: true,
      userId: true,
      leadId: true,
      plan: true,
      status: true,
    },
  });

  if (!session) {
    logger.warn("orchestrator.session_missing", { sessionId });
    return { sessionId, status: "FAILED", scheduled: [], completed: true };
  }

  if (session.status === "COMPLETED" || session.status === "FAILED" || session.status === "CANCELLED") {
    return { sessionId, status: session.status, scheduled: [], completed: true };
  }

  const plan: PersistedPlan = Array.isArray(session.plan) ? (session.plan as unknown as PersistedPlan) : [];
  const scheduled: string[] = [];

  // Step 1: reconcile per-step status from AgentRun. Runs complete
  // asynchronously so the persisted `step.status` may be stale by
  // the time we're called; re-reading the run status keeps the DAG
  // decisions based on current truth.
  const runIds = plan.filter((s) => s.runId).map((s) => s.runId!) as string[];
  const runs = runIds.length
    ? await prisma.agentRun.findMany({
        where: { id: { in: runIds } },
        select: { id: true, status: true },
      })
    : [];
  const runStatusById = new Map(runs.map((r) => [r.id, r.status] as const));

  for (const step of plan) {
    if (!step.runId) continue;
    const actual = runStatusById.get(step.runId);
    if (!actual) continue;
    if (actual === "SUCCEEDED" && step.status !== "SUCCEEDED") {
      step.status = "SUCCEEDED";
    } else if (actual === "FAILED" && step.status !== "FAILED") {
      step.status = step.optional ? "SKIPPED" : "FAILED";
    } else if (actual === "CANCELLED" && step.status !== "FAILED") {
      // A CANCELLED AgentRun (manual cancel, retries exhausted on a
      // permanent error, or webhook abort) is terminal. We never want
      // to leave the session stuck in EXECUTING because reconciliation
      // didn't recognize the cancel state. Treat it like FAILED for
      // session aggregation, but keep the message specific so the UI
      // can surface "cancelled" instead of a generic failure.
      step.status = step.optional ? "SKIPPED" : "FAILED";
    } else if (actual === "RUNNING" && step.status === "PENDING") {
      step.status = "RUNNING";
    }
  }

  // Step 2: did any non-optional step fail? If so, the session fails
  // and no further work is scheduled.
  const hardFailure = plan.some((s) => s.status === "FAILED" && !s.optional);

  // Stale-run guard: snapshot the lead's current `subNicheVersion`
  // once per advance() so every AgentRun we schedule below records
  // the version at enqueue time. The executor compares this snapshot
  // with the live value; mismatches mean a manual override (or a
  // re-classification) bumped the slug after the run was queued, so
  // the run would be working from stale sub-niche context. The
  // executor early-exits stale runs with SUCCEEDED + reason instead
  // of letting them overwrite fresh data.
  const subNicheVersionSnapshot = session.leadId
    ? (
        await prisma.lead.findUnique({
          where: { id: session.leadId },
          select: { subNicheVersion: true },
        })
      )?.subNicheVersion ?? null
    : null;

  // Step 3: schedule ready steps when no hard failure.
  if (!hardFailure) {
    for (const step of plan) {
      if (step.status !== "PENDING") continue;
      if (!areDepsSatisfied(step, plan)) continue;

      const sentinelId = extractSentinel(step);
      if (sentinelId) {
        const ok = await runSentinel(sentinelId, {
          sessionId: session.id,
          workspaceId: session.workspaceId,
          leadId: session.leadId,
          userId: session.userId,
          step,
        });
        step.status = ok ? "SUCCEEDED" : step.optional ? "SKIPPED" : "FAILED";
        scheduled.push(step.stepId);
        continue;
      }

      // Derive an idempotency key so a retry of advance() cannot
      // schedule the same step twice (defence in depth vs the
      // advisory lock: the lock is advisory, the unique index is
      // authoritative).
      const idempotencyKey = computeIdempotencyKey({
        workspaceId: session.workspaceId,
        workerKind: step.workerKind as AgentWorkerKind,
        leadId: session.leadId,
        inputs: {
          ...step.inputs,
          // Include sessionId + stepId so two parallel sessions for
          // the same workspace+kind+lead (e.g. user_one_click_pitch
          // invoked twice in rapid succession) can each create their
          // own AgentRun rather than the second silently joining the
          // first one's pending work.
          __sessionId: session.id,
          __stepId: step.stepId,
        },
      });

      // Try-create; on unique-index conflict, reuse the existing row.
      // We cannot use Prisma's `upsert` here because we do not know
      // the existing row's id up front.
      let run: { id: string };
      try {
        run = await prisma.agentRun.create({
          data: {
            workspaceId: session.workspaceId,
            leadId: session.leadId,
            userId: session.userId,
            workerKind: step.workerKind as AgentWorkerKind,
            status: "PENDING",
            inputsJson: (step.inputs ?? {}) as never,
            plannerSessionId: session.id,
            idempotencyKey,
            inputSubNicheVersion: subNicheVersionSnapshot,
          },
          select: { id: true },
        });
      } catch (err) {
        if (
          err &&
          typeof err === "object" &&
          "code" in err &&
          (err as { code?: string }).code === "P2002"
        ) {
          const existing = await prisma.agentRun.findFirst({
            where: {
              workspaceId: session.workspaceId,
              idempotencyKey,
            },
            select: { id: true },
          });
          if (!existing) throw err;
          run = existing;
          logger.info("orchestrator.reused_existing_run", {
            runId: run.id,
            stepId: step.stepId,
          });
        } else {
          throw err;
        }
      }

      step.runId = run.id;
      step.status = "RUNNING";

      // Try BullMQ first; fall back to inline execution if Redis is
      // unavailable. Inline runs block the orchestrator request so
      // they're serialized - not great for throughput but keeps the
      // feature functional on dev machines without Redis.
      let queued = false;
      try {
        const queue = getAgentRunsQueue();
        await queue.add(
          `run:${run.id}`,
          { type: "agent_run", runId: run.id },
          {
            // 3 attempts total: 1 initial + 2 retries with exponential backoff.
            // Retries only happen when executeAgentRun throws RetryableError
            // (network transients, Gemini timeouts, outer deadline).
            attempts: 3,
            backoff: { type: "exponential", delay: 2000 },
            removeOnComplete: 100,
            removeOnFail: 50,
          },
        );
        queued = true;
      } catch (err) {
        logger.warn("orchestrator.agent_run_enqueue_fallback_inline", {
          runId: run.id,
          err: err instanceof Error ? err.message : String(err),
        });
      }

      if (!queued) {
        // Inline fire-and-forget. executeAgentRun updates the run row
        // to SUCCEEDED/FAILED and notifies the orchestrator to advance
        // further, so the session still completes eventually.
        const { executeAgentRun } = await import("@/lib/agent-workers/execute");
        executeAgentRun(run.id).catch((e) => {
          logger.error("orchestrator.inline_agent_run_failed", {
            runId: run.id,
            err: e instanceof Error ? e.message : String(e),
          });
        });
      }

      scheduled.push(step.stepId);
    }
  }

  // Step 4: compute aggregate status.
  const allTerminal = plan.every(
    (s) => s.status === "SUCCEEDED" || s.status === "FAILED" || s.status === "SKIPPED",
  );
  const anyRunning = plan.some((s) => s.status === "RUNNING");

  let nextStatus: PlannerStatus = session.status;
  if (hardFailure && allTerminal) {
    nextStatus = "FAILED";
  } else if (allTerminal) {
    nextStatus = "COMPLETED";
  } else if (anyRunning || scheduled.length > 0) {
    nextStatus = "EXECUTING";
  }

  await prisma.plannerSession.update({
    where: { id: session.id },
    data: {
      plan: plan as never,
      status: nextStatus,
    },
  });

  logger.info("orchestrator.advance", {
    sessionId: session.id,
    scheduled: scheduled.length,
    status: nextStatus,
  });

  return {
    sessionId: session.id,
    status: nextStatus,
    scheduled,
    // CANCELLED cannot occur here (the early return at the top of
    // advance() short-circuits for that case), so only COMPLETED and
    // FAILED are the terminal states worth flagging.
    completed: nextStatus === "COMPLETED" || nextStatus === "FAILED",
  };
}

/**
 * True iff every step listed in `step.dependsOn` has status
 * SUCCEEDED or (for optional upstream deps) SKIPPED. If any upstream
 * is FAILED and not optional, this returns false; the session is
 * already heading for FAILED anyway.
 */
function areDepsSatisfied(step: PersistedPlanStep, plan: PersistedPlan): boolean {
  if (step.dependsOn.length === 0) return true;
  for (const depId of step.dependsOn) {
    const dep = plan.find((s) => s.stepId === depId);
    if (!dep) return false;
    if (dep.status === "SUCCEEDED" || dep.status === "SKIPPED") continue;
    return false;
  }
  return true;
}

function extractSentinel(step: PersistedPlanStep): string | null {
  const inp = step.inputs as Record<string, unknown> | undefined;
  const sentinel = inp?.__sentinel;
  return typeof sentinel === "string" ? sentinel : null;
}

/**
 * Stuck-session recovery.
 *
 * Finds PlannerSession rows that are still EXECUTING but have no
 * in-flight (PENDING / RUNNING) AgentRun and have not been touched
 * for `staleAfterMs`. Re-enqueues an `orchestrator_advance` job for
 * each so the DAG walker reconciles step status from agent_runs and
 * schedules whatever is now ready (typically the next layer that
 * was waiting on a step whose completion advance was dropped).
 *
 * Why this exists: the post-run `safeNotifyOrchestrator` hook in
 * `executeAgentRun` is best-effort - if Redis is briefly unreachable,
 * the worker process dies between two writes, or the `agent-runs`
 * BullMQ queue loses a job, the session gets stuck waiting for an
 * advance that will never come. The agent_runs themselves are
 * already terminal (SUCCEEDED / FAILED) - the session.plan JSON is
 * just stale. advance() is idempotent (advisory-locked + reads truth
 * from agent_runs) so re-enqueuing is safe.
 *
 * Scoping: workspaceId is optional. Worker-process callers leave it
 * undefined to scan globally; an API endpoint scoping to the caller's
 * workspace must always pass it through.
 */
export async function recoverStuckSessions(opts: {
  staleAfterMs?: number;
  limit?: number;
  workspaceId?: string;
} = {}): Promise<{ recovered: number; sessionIds: string[] }> {
  const staleAfterMs = opts.staleAfterMs ?? 2 * 60 * 1000;
  const limit = opts.limit ?? 100;
  const staleBefore = new Date(Date.now() - staleAfterMs);

  const workspaceFilter = opts.workspaceId ? { workspaceId: opts.workspaceId } : {};

  // Pull candidate sessions first (status + age), then filter out the
  // ones that still have in-flight runs in JS land. This avoids a
  // LATERAL / NOT EXISTS subquery and keeps the implementation
  // portable across drivers.
  const candidates = await prisma.plannerSession.findMany({
    where: {
      status: "EXECUTING",
      updatedAt: { lt: staleBefore },
      ...workspaceFilter,
    },
    select: { id: true },
    take: limit,
    orderBy: { updatedAt: "asc" },
  });

  if (candidates.length === 0) {
    return { recovered: 0, sessionIds: [] };
  }

  const inFlight = await prisma.agentRun.groupBy({
    by: ["plannerSessionId"],
    where: {
      plannerSessionId: { in: candidates.map((c) => c.id) },
      status: { in: ["PENDING", "RUNNING"] },
    },
    _count: { _all: true },
  });
  const inFlightIds = new Set(
    inFlight.map((r) => r.plannerSessionId).filter((v): v is string => v !== null),
  );

  const toRecover = candidates.filter((c) => !inFlightIds.has(c.id));

  for (const s of toRecover) {
    try {
      await enqueueAdvance(s.id);
    } catch (err) {
      logger.error("orchestrator.recover_stuck_enqueue_failed", {
        sessionId: s.id,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (toRecover.length > 0) {
    logger.info("orchestrator.recover_stuck_sessions", {
      workspaceId: opts.workspaceId ?? null,
      candidateCount: candidates.length,
      recovered: toRecover.length,
      staleAfterMs,
    });
  }

  return {
    recovered: toRecover.length,
    sessionIds: toRecover.map((s) => s.id),
  };
}

/**
 * Executes a sentinel step inline. Sentinels are tiny DB-only side
 * effects that would be overkill to wrap as a full worker + registry
 * entry. Add new sentinels here AND in `SENTINEL_STEPS` in chains.ts.
 */
async function runSentinel(
  sentinelId: string,
  args: {
    sessionId: string;
    workspaceId: string;
    leadId: string | null;
    userId: string | null;
    step: PersistedPlanStep;
  },
): Promise<boolean> {
  try {
    if (sentinelId === SENTINEL_STEPS.EMBED_LEAD_PROFILE) {
      if (!args.leadId) return false;
      const { embedLeadProfile } = await import("./sentinels");
      await embedLeadProfile({ workspaceId: args.workspaceId, leadId: args.leadId });
      return true;
    }
    if (sentinelId === SENTINEL_STEPS.WRITE_OPENER_OUTCOME) {
      if (!args.leadId) return false;
      const { writeOpenerOutcome } = await import("./sentinels");
      await writeOpenerOutcome({ workspaceId: args.workspaceId, leadId: args.leadId });
      return true;
    }
    logger.warn("orchestrator.unknown_sentinel", { sentinelId });
    return false;
  } catch (err) {
    logger.error("orchestrator.sentinel_failed", {
      sentinelId,
      err: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
