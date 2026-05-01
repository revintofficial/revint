import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { internalError } from "@/lib/api-errors";
import {
  removeAllPendingJobsFromPipelineQueuesGlobally,
  resetAllLeadPipelineColumnsGlobally,
} from "@/lib/pipeline-cancel-workspace";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADER = "x-leadac-global-pipeline-secret";

/** Dev-only: bare POST from the browser (e.g. DevTools) without leaking a secret. Disabled in production. */
function isDevBrowserBypass(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.LEADAC_DISABLE_GLOBAL_PIPELINE_KILL_DEV !== "1"
  );
}

function isAuthorizedGlobalKill(request: Request): boolean {
  const secret = process.env.LEADAC_GLOBAL_PIPELINE_SECRET;
  if (!secret || secret.length < 24) return false;

  const headerSecret = request.headers.get(HEADER);
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const presented = (headerSecret ?? bearer ?? "").trim();

  try {
    const a = Buffer.from(secret, "utf8");
    const b = Buffer.from(presented, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * POST /api/admin/pipeline/cancel-all-global
 *
 * **Destructive / cross-tenant.** Cancels every workspace's in-flight pipeline:
 * all PENDING/RUNNING AgentRuns, all active PlannerSessions, resets stuck Lead
 * pipeline columns app-wide, and removes **all** queued jobs from discovery,
 * crawl, analyze, review-analysis, email-verification, and agent-runs (except
 * repeatable `sequence_tick`).
 *
 * Auth (production): env `LEADAC_GLOBAL_PIPELINE_SECRET` (≥24 chars) + header
 * `x-leadac-global-pipeline-secret` or `Authorization: Bearer …`.
 *
 * Auth (development only): no secret — plain `POST` works so you can call from
 * DevTools. Set `LEADAC_DISABLE_GLOBAL_PIPELINE_KILL_DEV=1` to force prod-style
 * checks locally. **Never rely on dev bypass against a shared prod DB.**
 *
 * Does **not** stop Apify runs already executing in Apify Cloud.
 */
export async function POST(request: Request) {
  try {
    const devBypass = isDevBrowserBypass();

    if (!devBypass) {
      if (!process.env.LEADAC_GLOBAL_PIPELINE_SECRET) {
        return NextResponse.json(
          {
            error:
              "LEADAC_GLOBAL_PIPELINE_SECRET is not set — global kill is disabled.",
          },
          { status: 503 },
        );
      }
      if (!isAuthorizedGlobalKill(request)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else {
      logger.warn("api.admin.pipeline.cancel_all_global.dev_bypass", {
        hint: "NODE_ENV=development — auth skipped for browser testing only",
      });
    }

    const now = new Date();

    const [cancelledRuns, cancelledSessions, leadPipelineReset] =
      await Promise.all([
        prisma.agentRun.updateMany({
          where: { status: { in: ["PENDING", "RUNNING"] } },
          data: { status: "CANCELLED", finishedAt: now },
        }),
        prisma.plannerSession.updateMany({
          where: { status: { in: ["PLANNING", "EXECUTING"] } },
          data: { status: "CANCELLED", updatedAt: now },
        }),
        resetAllLeadPipelineColumnsGlobally(),
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
      queueJobsRemoved =
        await removeAllPendingJobsFromPipelineQueuesGlobally();
    } catch (err) {
      logger.error("api.admin.pipeline.cancel_all_global.redis_failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    }

    const totalQueueJobsRemoved = Object.values(queueJobsRemoved).reduce(
      (a, b) => a + b,
      0,
    );

    logger.info("api.admin.pipeline.cancel_all_global.done", {
      cancelledRuns: cancelledRuns.count,
      cancelledSessions: cancelledSessions.count,
      totalQueueJobsRemoved,
      leadPipelineReset,
    });

    return NextResponse.json({
      ok: true,
      scope: "global",
      devBrowserBypass: devBypass,
      cancelledRuns: cancelledRuns.count,
      cancelledSessions: cancelledSessions.count,
      queuesDrained: totalQueueJobsRemoved > 0,
      queueJobsRemoved,
      totalQueueJobsRemoved,
      leadPipelineReset,
    });
  } catch (err) {
    return internalError("api.admin.pipeline.cancel_all_global.error", err);
  }
}
