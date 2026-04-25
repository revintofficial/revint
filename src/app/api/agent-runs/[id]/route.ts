/**
 * GET /api/agent-runs/[id]
 *
 * Returns a single AgentRun with status + output. The UI polls this
 * every 2s while a run is PENDING or RUNNING. Once status lands on
 * SUCCEEDED or FAILED the UI stops polling and renders the artifact
 * (artifactUrl for public links like /m/{slug}, outputJson for
 * config-style deliverables).
 *
 * Multi-tenant: the findFirst lookup filters by workspaceId so any
 * cross-tenant run id returns 404.
 */
import { NextResponse } from "next/server";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireUser();
    const { id } = await params;

    const run = await prisma.agentRun.findFirst({
      where: { id, workspaceId: session.workspaceId },
      select: {
        id: true,
        workspaceId: true,
        leadId: true,
        workerKind: true,
        status: true,
        outputJson: true,
        artifactUrl: true,
        errorMsg: true,
        costTokens: true,
        startedAt: true,
        finishedAt: true,
        createdAt: true,
      },
    });
    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    // Lazy watchdog: if the run is still PENDING/RUNNING but was
    // created more than 3 minutes ago, the worker process almost
    // certainly crashed or the Gemini call hung past every deadline.
    // Flip it to FAILED here so the UI stops showing the infinite
    // spinner and the user can retry. This is the cheapest possible
    // watchdog - zero extra infrastructure, triggered by normal
    // polling that the UI is already doing every 2 seconds.
    if (run.status === "PENDING" || run.status === "RUNNING") {
      const ageMs = Date.now() - new Date(run.createdAt).getTime();
      if (ageMs > 3 * 60 * 1000) {
        const updated = await prisma.agentRun.update({
          where: { id: run.id },
          data: {
            status: "FAILED",
            finishedAt: new Date(),
            errorMsg: "watchdog: run exceeded 3-minute deadline without completing",
          },
          select: {
            id: true,
            workspaceId: true,
            leadId: true,
            workerKind: true,
            status: true,
            outputJson: true,
            artifactUrl: true,
            errorMsg: true,
            costTokens: true,
            startedAt: true,
            finishedAt: true,
            createdAt: true,
          },
        });
        logger.warn("api.agent_run.watchdog_failed", {
          runId: run.id,
          workerKind: run.workerKind,
          ageMs,
        });
        return NextResponse.json(updated);
      }
    }

    return NextResponse.json(run);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.agent_run.get_error", { err });
    return NextResponse.json(
      { error: "Failed to fetch run", detail: String(err) },
      { status: 500 },
    );
  }
}
