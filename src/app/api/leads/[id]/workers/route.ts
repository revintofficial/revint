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
import { listWorkers, planMeetsMinimum } from "@/lib/agent-workers/registry";
import { getLimit } from "@/lib/agent-workers/quota";
import type { AgentWorkerKind } from "@/generated/prisma/client";

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

    // Registry-driven projection: include every worker so the UI can
    // render locked / upgrade state for tiers the user has not paid for.
    const workers = listWorkers().map((w) => {
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
    logger.error("api.agent_run.list_error", { err });
    return NextResponse.json(
      { error: "Failed to list workers", detail: String(err) },
      { status: 500 },
    );
  }
}
