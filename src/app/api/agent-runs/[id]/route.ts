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
import { internalError } from "@/lib/api-errors";
import { watchdogVerdict } from "@/lib/agent-workers/deadline";
import { getWorker } from "@/lib/agent-workers/registry";

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
    //   is 240s, so anything older has definitely crashed. Workers
    //   that declare deadlineMs in the registry get that deadline plus
    //   one minute instead.
    //
    // Async-apify runs (mode set in inputsJson by the executor's
    // start() path): up to 10 minutes. Apify's actor timeout is
    // 180s and the webhook handler runs after that, but cold-start
    // queues + retry backoff can stretch the round-trip well past
    // 3 minutes for first-of-day runs. Killing too aggressively
    // would mark genuinely-in-flight runs as FAILED while the
    // webhook is still about to land.
    if (run.status === "PENDING" || run.status === "RUNNING") {
      // Sync runs get the worker's own deadline (+60 s) when it declares one,
      // counted from the latest of creation, start and deferral; see
      // watchdogVerdict. WEBSITE_AUDITOR's deep capture runs up to 300 s and
      // may wait for a capture slot before it starts.
      const verdict = watchdogVerdict(run, getWorker(run.workerKind));
      const { ageMs, isAsync } = verdict;
      const deadlineMs = verdict.limitMs;
      if (verdict.expired) {
        const errorMsg = isAsync
          ? "watchdog: async Apify run exceeded 10-minute deadline without webhook callback"
          : `watchdog: run exceeded ${Math.round(deadlineMs / 60_000)}-minute deadline without completing`;
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
    return internalError("api.agent_run.get_error", err);
  }
}
