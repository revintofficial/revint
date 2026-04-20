/**
 * POST /api/agent-runs/cleanup-stale
 *
 * One-shot cleanup - marks every PENDING/RUNNING AgentRun in the
 * caller's workspace that is older than 90 seconds as CANCELLED.
 * Useful after a dev-server restart leaves orphaned inline runs
 * stuck in RUNNING (the UI otherwise blocks Generate on those).
 *
 * Workspace-scoped: never touches other tenants' runs.
 */
import { NextResponse } from "next/server";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function POST() {
  try {
    const session = await requireUser();
    const staleBefore = new Date(Date.now() - 90 * 1000);

    const result = await prisma.agentRun.updateMany({
      where: {
        workspaceId: session.workspaceId,
        status: { in: ["PENDING", "RUNNING"] },
        createdAt: { lt: staleBefore },
      },
      data: {
        status: "CANCELLED",
        finishedAt: new Date(),
        errorMsg: "Cancelled by manual workspace cleanup (stale run).",
      },
    });

    logger.info("api.agent_run.manual_cleanup", {
      workspaceId: session.workspaceId,
      cancelled: result.count,
    });

    return NextResponse.json({ cancelled: result.count });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Cleanup failed", detail: String(err) },
      { status: 500 },
    );
  }
}
