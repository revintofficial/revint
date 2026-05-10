/**
 * GET /api/leads/[id]/workers
 *
 * Returns the full AgentRun history for a lead plus the live quota +
 * plan status per worker kind. The lead detail "AI Workers" tab uses
 * this to render the per-kind status badge ("generated 14 Apr",
 * "3/30 used", "upgrade to Pro") without calling separate endpoints
 * for each worker.
 *
 * Multi-tenant: findFirst on the lead scopes to workspaceId; runs are
 * also filtered by workspaceId so any cross-tenant bleed would need
 * both the lead to exist AND rows to be mis-scoped (defense in depth).
 */
import { NextResponse } from "next/server";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { internalError } from "@/lib/api-errors";
import { listPanelWorkers, planMeetsMinimum } from "@/lib/agent-workers/registry";
import { getLimit } from "@/lib/agent-workers/quota";
import type { AgentWorkerKind } from "@/generated/prisma/client";

/**
 * Matches the watchdog rule used by GET /api/agent-runs/[id]:
 *   - Sync runs (no `mode: "async-apify"` in inputsJson):
 *     mark FAILED after 3 minutes - the executor process has died.
 *   - Async-apify runs (Apify webhook callbacks):
 *     mark FAILED after 10 minutes - we wait long enough for the
 *     actor + cold-start + webhook delivery to complete. This must
 *     stay in lockstep with `isAsyncRun` in the per-run handler so
 *     the two endpoints don't disagree about what a stuck run is.
 */
const SYNC_WATCHDOG_MS = 3 * 60 * 1000;
const ASYNC_WATCHDOG_MS = 10 * 60 * 1000;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireUser();
    const { id: leadId } = await params;

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, workspaceId: session.workspaceId },
      select: { id: true },
    });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const ws = await prisma.workspace.findUniqueOrThrow({
      where: { id: session.workspaceId },
      select: { cycleResetAt: true, plan: true },
    });

    // Lazy watchdog: mark stuck PENDING/RUNNING runs as FAILED before
    // building the response. Two passes so async-apify runs (which
    // legitimately stay RUNNING for up to 10 minutes while Apify
    // works through its actor queue + webhook delivery) are not
    // killed by the strict 3-minute rule that sync runs need.
    //
    // Selection: async runs are identified by `inputsJson.mode =
    // "async-apify"` set by the executor in `src/lib/agent-workers/execute.ts`.
    // Anything without that marker is treated as sync (the strict
    // default).
    const now = Date.now();
    const syncWatchdogCutoff = new Date(now - SYNC_WATCHDOG_MS);
    const asyncWatchdogCutoff = new Date(now - ASYNC_WATCHDOG_MS);

    const [syncReap, asyncReap] = await Promise.all([
      prisma.agentRun.updateMany({
        where: {
          workspaceId: session.workspaceId,
          leadId,
          status: { in: ["PENDING", "RUNNING"] },
          createdAt: { lt: syncWatchdogCutoff },
          // Postgres JSONB equality: filter to rows whose mode is
          // NOT "async-apify". Rows with no mode set fall into this
          // bucket because `path: ["mode"]` returns null.
          NOT: { inputsJson: { path: ["mode"], equals: "async-apify" } },
        },
        data: {
          status: "FAILED",
          finishedAt: new Date(),
          errorMsg: "watchdog: run exceeded 3-minute deadline without completing",
        },
      }),
      prisma.agentRun.updateMany({
        where: {
          workspaceId: session.workspaceId,
          leadId,
          status: { in: ["PENDING", "RUNNING"] },
          createdAt: { lt: asyncWatchdogCutoff },
          inputsJson: { path: ["mode"], equals: "async-apify" },
        },
        data: {
          status: "FAILED",
          finishedAt: new Date(),
          errorMsg:
            "watchdog: async Apify run exceeded 10-minute deadline without webhook callback",
        },
      }),
    ]);
    const reapTotal = syncReap.count + asyncReap.count;
    if (reapTotal > 0) {
      logger.warn("api.agent_run.watchdog_batch_failed", {
        sync: syncReap.count,
        async: asyncReap.count,
        leadId,
      });
    }

    // Recent runs for this lead (capped so one hot lead can't balloon
    // the response). 50 is more than enough to surface "latest run per
    // worker kind" across 19 worker kinds.
    const runs = await prisma.agentRun.findMany({
      where: {
        workspaceId: session.workspaceId,
        leadId,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        workerKind: true,
        status: true,
        artifactUrl: true,
        errorMsg: true,
        startedAt: true,
        finishedAt: true,
        createdAt: true,
      },
    });

    const latestByKind = new Map<AgentWorkerKind, typeof runs[number]>();
    for (const r of runs) {
      if (!latestByKind.has(r.workerKind)) latestByKind.set(r.workerKind, r);
    }

    // Per-kind cycle usage counter (only status != FAILED/CANCELLED).
    const cycleUsageRows = await prisma.agentRun.groupBy({
      by: ["workerKind"],
      where: {
        workspaceId: session.workspaceId,
        status: { notIn: ["FAILED", "CANCELLED"] },
        createdAt: { gte: ws.cycleResetAt },
      },
      _count: { _all: true },
    });
    const usageByKind = new Map<AgentWorkerKind, number>();
    for (const row of cycleUsageRows) usageByKind.set(row.workerKind, row._count._all);

    // Registry-driven projection: include every PANEL worker so the
    // UI can render locked / upgrade state for tiers the user has not
    // paid for. `listPanelWorkers()` filters out registry entries
    // flagged `hiddenFromPanel: true` — server-internal jobs (outcome
    // attributor, inbox attributor), client deliverables (receptionist,
    // review-reply), Phase 2 placeholders, and deprecated workers
    // (google-places-reviews replaced by apify-gmaps-deep). The
    // `runs` array below still includes those kinds when historical
    // AgentRun rows exist, so the lead detail timeline doesn't lose
    // legacy entries.
    const workers = listPanelWorkers().map((w) => {
      const limit = getLimit(w.kind, ws.plan);
      const used = usageByKind.get(w.kind) ?? 0;
      const latest = latestByKind.get(w.kind);
      return {
        kind: w.kind,
        group: w.group,
        displayName: w.displayName,
        displayNameTr: w.displayNameTr,
        description: w.description,
        descriptionTr: w.descriptionTr,
        minPlan: w.minPlan,
        phase1Enabled: w.phase1Enabled,
        estimatedDurationMs: w.estimatedDurationMs,
        exportFormats: w.exportFormats ?? [],
        locked: !planMeetsMinimum(ws.plan, w.minPlan),
        used,
        limit,
        remaining: limit > 0 ? Math.max(0, limit - used) : 0,
        latestRun: latest
          ? {
              id: latest.id,
              status: latest.status,
              artifactUrl: latest.artifactUrl,
              errorMsg: latest.errorMsg,
              createdAt: latest.createdAt,
              finishedAt: latest.finishedAt,
            }
          : null,
      };
    });

    return NextResponse.json({
      leadId,
      plan: ws.plan,
      cycleResetAt: ws.cycleResetAt,
      workers,
      runs,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.agent_run.list_error", err);
  }
}
