/**
 * POST /api/leads/[id]/workers/[kind]
 *
 * Triggers a new AI Worker run for a lead. Inserts a PENDING `AgentRun`
 * row scoped to the caller's workspace, enqueues a BullMQ agent-runs
 * job, and returns `{ runId, artifactUrl: null, status: "PENDING" }`.
 *
 * Quota + plan gating happen here (402 Payment Required on failure).
 * The worker process re-checks quota at job start so BullMQ bypass
 * attempts still get blocked.
 *
 * Multi-tenant scoping: every DB read + write filters by
 * `session.workspaceId`; the lead lookup uses `findFirst` with that
 * filter so cross-workspace lead ids return 404.
 */
import { NextResponse } from "next/server";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getAgentRunsQueue } from "@/lib/queues";
import { getWorker } from "@/lib/agent-workers/registry";
import { executeAgentRun } from "@/lib/agent-workers/execute";
import {
  assertWorkerQuota,
  PlanTooLowError,
  QuotaExceededError,
} from "@/lib/agent-workers/quota";
import { AgentWorkerKind } from "@/generated/prisma/client";

// The registry is the source of truth for which worker kinds exist and
// whether they're exposed to the UI. Never hardcode a subset here;
// doing so silently masks newly registered workers (e.g. Apify enrichment
// kinds) and produces misleading "Unknown or not yet implemented" 404s.
const VALID_KINDS = new Set<string>(Object.values(AgentWorkerKind));

/**
 * Cached "Redis is down" flag. When `tryEnqueue` detects an
 * unreachable Redis (enqueue deadline blown), we stamp this timestamp
 * with the future moment at which we'll try again. Subsequent calls
 * in the cooldown window skip the enqueue attempt entirely - no new
 * ioredis reconnect loop, no new error spam. Inline execution takes
 * over immediately. 30 seconds is long enough to skip the common
 * "dev running without Redis" case and short enough that when the
 * user starts Redis it recovers within a minute.
 */
let redisDownUntil = 0;
const REDIS_DOWN_TTL_MS = 30_000;

/**
 * Race the BullMQ enqueue against a short deadline. Returns `true` if
 * the job was successfully enqueued, `false` if Redis is unavailable
 * or the add() didn't resolve in time. ioredis with the worker config
 * (`maxRetriesPerRequest: null`) will queue commands forever on a
 * dead connection, so the deadline is the only reliable signal that
 * we should fall back to inline execution.
 */
async function tryEnqueue(runId: string, timeoutMs = 1500): Promise<boolean> {
  if (Date.now() < redisDownUntil) {
    // Recent probe said Redis is unreachable - skip the attempt so
    // we don't spin up another ioredis reconnect burst.
    return false;
  }
  try {
    const queue = getAgentRunsQueue();
    const addPromise = queue.add(
      `agent-run-${runId}`,
      { runId },
      {
        attempts: 2,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 500,
        removeOnFail: 500,
      },
    );
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("queue_enqueue_timeout")), timeoutMs),
    );
    await Promise.race([addPromise, timeout]);
    redisDownUntil = 0;
    return true;
  } catch {
    redisDownUntil = Date.now() + REDIS_DOWN_TTL_MS;
    return false;
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; kind: string }> },
) {
  try {
    const session = await requireUser();
    const { id: leadId, kind: rawKind } = await params;

    // Validate against the enum + registry instead of a hardcoded list.
    const upper = rawKind.toUpperCase();
    if (!VALID_KINDS.has(upper)) {
      return NextResponse.json(
        { error: "Unknown worker kind", kind: rawKind },
        { status: 404 },
      );
    }
    const kind = upper as AgentWorkerKind;

    const worker = getWorker(kind);
    if (!worker || !worker.phase1Enabled) {
      return NextResponse.json(
        { error: "Worker not enabled in Phase 1", kind },
        { status: 404 },
      );
    }

    // Scope to caller's workspace. findFirst ensures cross-tenant leadId
    // lookups return 404 with no side-channel signal.
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, workspaceId: session.workspaceId },
      select: { id: true },
    });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Quota + plan gating. Throws 402-coded errors.
    await assertWorkerQuota({
      workspaceId: session.workspaceId,
      plan: session.workspace.plan,
      kind,
    });

    // Auto-cancel any stuck runs for this (lead, worker) combo before
    // creating a new one. A run is "stuck" if it sits PENDING or
    // RUNNING longer than 90 seconds - that's ~2.5x the slowest
    // Gemini worker's estimated duration (AI Receptionist at 40s),
    // so legitimate inflight jobs aren't touched. This handles
    // dev-server restarts and BullMQ worker crashes that leave runs
    // orphaned without requiring manual DB cleanup, and keeps the
    // quota counter honest (stale rows no longer burn limit).
    const staleBefore = new Date(Date.now() - 90 * 1000);
    const cancelled = await prisma.agentRun.updateMany({
      where: {
        workspaceId: session.workspaceId,
        leadId,
        workerKind: kind,
        status: { in: ["PENDING", "RUNNING"] },
        createdAt: { lt: staleBefore },
      },
      data: {
        status: "CANCELLED",
        finishedAt: new Date(),
        errorMsg: "Cancelled: run exceeded 3 minute deadline and was auto-reset on retry.",
      },
    });
    if (cancelled.count > 0) {
      logger.info("api.agent_run.stale_cancelled", {
        count: cancelled.count,
        kind,
        leadId,
      });
    }

    const run = await prisma.agentRun.create({
      data: {
        workspaceId: session.workspaceId,
        leadId,
        userId: session.user.id,
        workerKind: kind,
        status: "PENDING",
        inputsJson: {},
      },
      select: { id: true, createdAt: true, workerKind: true, status: true },
    });

    // Try to enqueue on Redis/BullMQ with a short deadline. If Redis
    // is down (dev environments without a local Redis, upstream
    // outages) fall back to running the worker inline on the Node
    // process - fire-and-forget so the response returns immediately
    // with the runId. The UI polls /api/agent-runs/{id} either way so
    // the experience is identical from the browser's point of view.
    const enqueued = await tryEnqueue(run.id);
    if (!enqueued) {
      logger.warn("api.agent_run.queue_unavailable_inline_fallback", {
        runId: run.id,
        kind,
      });
      // Intentionally NOT awaited - the executor writes its own status
      // to the AgentRun row; any errors are caught inside executeAgentRun.
      void executeAgentRun(run.id).catch((err) => {
        logger.error("api.agent_run.inline_fallback_error", {
          runId: run.id,
          err: err instanceof Error ? err.message : String(err),
        });
      });
    } else {
      logger.info("api.agent_run.enqueued", { runId: run.id, kind, leadId });
    }

    return NextResponse.json({
      runId: run.id,
      status: run.status,
      artifactUrl: null,
      estimatedDurationMs: worker.estimatedDurationMs,
      mode: enqueued ? "queue" : "inline",
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof PlanTooLowError) {
      return NextResponse.json(
        {
          error: "plan_too_low",
          message: `This worker requires the ${err.minPlan} plan or higher.`,
          kind: err.kind,
          minPlan: err.minPlan,
        },
        { status: 402 },
      );
    }
    if (err instanceof QuotaExceededError) {
      return NextResponse.json(
        {
          error: "quota_exceeded",
          message: `You have used ${err.used}/${err.limit} runs this cycle. Upgrade your plan for more.`,
          kind: err.kind,
          used: err.used,
          limit: err.limit,
        },
        { status: 402 },
      );
    }
    logger.error("api.agent_run.trigger_error", { err });
    return NextResponse.json(
      { error: "Failed to start worker", detail: String(err) },
      { status: 500 },
    );
  }
}
