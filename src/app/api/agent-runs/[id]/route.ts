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
import type { Prisma } from "@/generated/prisma/client";

/**
 * True when the AgentRun was scheduled as an async-apify run, i.e.
 * the executor's `start(ctx)` path persisted `mode: "async-apify"`
 * (and an `apifyRunId`) into `inputsJson`. Async runs use a longer
 * watchdog deadline because their completion is gated on Apify's
 * actor + webhook round-trip rather than our own process staying
 * alive. We treat malformed JSON as "sync" - that keeps the strict
 * 3-minute watchdog as the safe default.
 */
function isAsyncRun(inputsJson: Prisma.JsonValue | null | undefined): boolean {
  if (!inputsJson || typeof inputsJson !== "object" || Array.isArray(inputsJson)) {
    return false;
  }
  const obj = inputsJson as Record<string, unknown>;
  return obj.mode === "async-apify" && typeof obj.apifyRunId === "string";
}

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
        inputsJson: true,
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

    // Lazy watchdog: if the run is still PENDING/RUNNING but its
    // deadline has passed, flip it to FAILED so the UI stops showing
    // the infinite spinner and the user can retry. This is the
    // cheapest possible watchdog - zero extra infrastructure,
    // triggered by normal polling that the UI is already doing
    // every 2 seconds.
    //
    // Sync runs (Gemini calls, in-process scrapers, sync Apify):
    //   3 minutes is a comfortable ceiling - the executor's own
    //   outer deadline is 180s and the worker process's lockDuration
    //   is 240s, so anything older has definitely crashed.
    //
    // Async-apify runs (mode set in inputsJson by the executor's
    // start() path): up to 10 minutes. Apify's actor timeout is
    // 180s and the webhook handler runs after that, but cold-start
    // queues + retry backoff can stretch the round-trip well past
    // 3 minutes for first-of-day runs. Killing too aggressively
    // would mark genuinely-in-flight runs as FAILED while the
    // webhook is still about to land.
    if (run.status === "PENDING" || run.status === "RUNNING") {
      const ageMs = Date.now() - new Date(run.createdAt).getTime();
      const isAsync = isAsyncRun(run.inputsJson);
      const deadlineMs = isAsync ? 10 * 60 * 1000 : 3 * 60 * 1000;
      if (ageMs > deadlineMs) {
        const errorMsg = isAsync
          ? "watchdog: async Apify run exceeded 10-minute deadline without webhook callback"
          : "watchdog: run exceeded 3-minute deadline without completing";
        const updated = await prisma.agentRun.update({
          where: { id: run.id },
          data: {
            status: "FAILED",
            finishedAt: new Date(),
            errorMsg,
          },
          select: {
            id: true,
            workspaceId: true,
            leadId: true,
            workerKind: true,
            status: true,
            inputsJson: true,
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
          isAsync,
          deadlineMs,
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
