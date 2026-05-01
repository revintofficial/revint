import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { internalError } from "@/lib/api-errors";
import {
  removeWorkspaceJobsFromPipelineQueues,
  resetWorkspaceLeadPipelineColumns,
} from "@/lib/pipeline-cancel-workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/pipeline/cancel-all
 *
 * Immediately cancels all in-flight pipeline work for the caller's
 * workspace:
 *   1. Marks every PENDING/RUNNING AgentRun as CANCELLED (scoped).
 *   2. Marks every PLANNING/EXECUTING PlannerSession as CANCELLED (scoped).
 *   3. Removes **this workspace's** pending BullMQ jobs from discovery,
 *      crawl, analyze, review-analysis, email-verification, and agent-runs
 *      (does not drain other tenants — replaces the old global `drain()`).
 *   4. Resets stuck Lead.crawlStatus / analyzeStatus / reviewAnalysisStatus
 *      rows so the live processing strip matches Redis + AgentRun reality.
 *
 * Jobs already mid-execution in the worker process finish their
 * current step and then hit CANCELLED on the next DB write — there
 * is no SIGKILL path from here. That's acceptable: a step that's
 * already running (e.g. a Gemini call in progress) completes, the
 * executor tries to write SUCCEEDED, then safeNotifyOrchestrator
 * sees the session is CANCELLED and is a no-op.
 *
 * Apify async actors already running in Apify Cloud may still bill until
 * completion — this endpoint does not call Apify's abort APIs.
 */
export async function POST() {
  try {
    const { workspaceId } = await requireUser();

    const now = new Date();

    const [cancelledRuns, cancelledSessions, leadPipelineReset] =
      await Promise.all([
        prisma.agentRun.updateMany({
          where: {
            workspaceId,
            status: { in: ["PENDING", "RUNNING"] },
          },
          data: { status: "CANCELLED", finishedAt: now },
        }),
        prisma.plannerSession.updateMany({
          where: {
            workspaceId,
            status: { in: ["PLANNING", "EXECUTING"] },
          },
          data: { status: "CANCELLED", updatedAt: now },
        }),
        resetWorkspaceLeadPipelineColumns(workspaceId),
      ]);

    let queueJobsRemoved: Record<string, number> = {
      discovery: 0,
      crawl: 0,
      analyze: 0,
      reviewAnalysis: 0,
      emailVerification: 0,
      agentRuns: 0,
    };
    try {
      queueJobsRemoved = await removeWorkspaceJobsFromPipelineQueues(
        workspaceId,
      );
    } catch {
      // Redis down — DB cancellation + lead resets still apply.
    }

    const totalQueueJobsRemoved = Object.values(queueJobsRemoved).reduce(
      (a, b) => a + b,
      0,
    );

    return NextResponse.json({
      ok: true,
      cancelledRuns: cancelledRuns.count,
      cancelledSessions: cancelledSessions.count,
      /** @deprecated use totalQueueJobsRemoved — kept for older dashboards */
      queuesDrained: totalQueueJobsRemoved > 0,
      queueJobsRemoved,
      totalQueueJobsRemoved,
      leadPipelineReset,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.admin.pipeline.cancel_all.error", err);
  }
}
