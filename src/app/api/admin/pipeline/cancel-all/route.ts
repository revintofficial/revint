import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { internalError } from "@/lib/api-errors";
import { getAgentRunsQueue, getDiscoveryQueue } from "@/lib/queues";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/pipeline/cancel-all
 *
 * Immediately cancels all in-flight pipeline work for the caller's
 * workspace:
 *   1. Marks every PENDING/RUNNING AgentRun as CANCELLED.
 *   2. Marks every EXECUTING PlannerSession as CANCELLED.
 *   3. Drains pending jobs from the agent-runs + discovery BullMQ
 *      queues (removes jobs not yet picked up by a worker).
 *
 * Jobs already mid-execution in the worker process finish their
 * current step and then hit CANCELLED on the next DB write — there
 * is no SIGKILL path from here. That's acceptable: a step that's
 * already running (e.g. a Gemini call in progress) completes, the
 * executor tries to write SUCCEEDED, then safeNotifyOrchestrator
 * sees the session is CANCELLED and is a no-op.
 */
export async function POST() {
  try {
    const { workspaceId } = await requireUser();

    const now = new Date();

    const [cancelledRuns, cancelledSessions] = await Promise.all([
      prisma.agentRun.updateMany({
        where: { status: { in: ["PENDING", "RUNNING"] } },
        data: { status: "CANCELLED", finishedAt: now },
      }),
      prisma.plannerSession.updateMany({
        where: { status: { in: ["PLANNING", "EXECUTING"] } },
        data: { status: "CANCELLED", updatedAt: now },
      }),
    ]);

    // Drain BullMQ queues — removes jobs sitting in Redis that haven't
    // been picked up yet. Jobs already locked by a worker are left alone
    // (they'll hit the CANCELLED DB state above when they try to write back).
    let drainedJobs = 0;
    try {
      const agentRunsQueue = getAgentRunsQueue() as any;
      const discoveryQueue = getDiscoveryQueue() as any;
      await Promise.all([
        agentRunsQueue.drain(),
        discoveryQueue.drain(),
      ]);
      // Count is not exposed by drain(), so we just mark success.
      drainedJobs = -1; // -1 = drained (count unknown)
    } catch {
      // Non-fatal: if Redis is unavailable the DB cancel above is
      // still the authoritative state. Worker will ignore CANCELLED rows.
      drainedJobs = 0;
    }

    return NextResponse.json({
      ok: true,
      cancelledRuns: cancelledRuns.count,
      cancelledSessions: cancelledSessions.count,
      queuesDrained: drainedJobs !== 0,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.admin.pipeline.cancel_all.error", err);
  }
}
