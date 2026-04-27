/**
 * POST /api/agent-runs/recover-stuck-sessions
 *
 * Workspace-scoped manual recovery for PlannerSession rows that are
 * stuck in EXECUTING with no in-flight (PENDING / RUNNING) AgentRun.
 * Re-enqueues an `orchestrator_advance` job for each so the DAG
 * walker reconciles step status from the agent_runs table and
 * schedules the next layer of work.
 *
 * Why an explicit endpoint when the worker also runs a periodic
 * watchdog: the watchdog only fires when the worker process is
 * alive. If a workspace owner notices their pipeline stalled and the
 * worker host is down (Redis blip, deploy in progress), they want a
 * way to trigger recovery without waiting for the next tick once
 * everything comes back. Hitting this endpoint after restarting the
 * worker forces an immediate scan over their own workspace's
 * sessions instead of relying on the 60-second tick to catch up.
 *
 * Multi-tenant: the call is hard-scoped to the caller's workspaceId
 * via `requireUser()` and the workspaceId argument forwarded to
 * `recoverStuckSessions`. There is no cross-workspace path.
 */
import { NextResponse } from "next/server";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { recoverStuckSessions } from "@/lib/ai-core/orchestrator";
import { logger } from "@/lib/logger";
import { internalError } from "@/lib/api-errors";

export async function POST(request: Request) {
  try {
    const session = await requireUser();

    // Optional `staleAfterMs` override - useful for an admin who
    // wants to force-recover sessions that just stalled (e.g. after a
    // local worker restart). Default matches the periodic watchdog so
    // manual + automatic behaviour stay aligned.
    let staleAfterMs = 2 * 60 * 1000;
    try {
      const body = (await request.json().catch(() => null)) as
        | { staleAfterMs?: number }
        | null;
      if (
        body &&
        typeof body.staleAfterMs === "number" &&
        body.staleAfterMs >= 0 &&
        body.staleAfterMs <= 24 * 60 * 60 * 1000
      ) {
        staleAfterMs = body.staleAfterMs;
      }
    } catch {
      // No body or invalid JSON - fall through with the default.
    }

    const result = await recoverStuckSessions({
      workspaceId: session.workspaceId,
      staleAfterMs,
      limit: 200,
    });

    logger.info("api.agent_run.recover_stuck_sessions", {
      workspaceId: session.workspaceId,
      recovered: result.recovered,
      staleAfterMs,
    });

    return NextResponse.json({
      recovered: result.recovered,
      sessionIds: result.sessionIds,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.agent_run.recover_stuck_sessions_error", err);
  }
}
