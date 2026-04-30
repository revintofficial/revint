/**
 * GET /api/leads/processing-status
 *
 * Lightweight live progress feed for the Leads + Discovery surfaces.
 *
 * Lead.crawlStatus / analyzeStatus + AgentRun.status are mutated by
 * background workers (BullMQ → AI Core chain) so the user has no idea
 * how much pipeline work is still pending after a Discovery run. This
 * endpoint summarises everything in one cheap query so the UI can
 * render a "Analyzing N of M leads" strip and stop polling when the
 * workspace is fully idle.
 *
 * Response shape:
 *   {
 *     totals: { crawling, analyzing, pipelinePending, recentlyAnalyzed, total },
 *     activity: { running, oldestStartedAt, recentlyCompleted },
 *     workers: [{ id, kind, leadId, leadName, ageSeconds, status }, ...]
 *   }
 *
 * Multi-tenant: every count + AgentRun lookup filters by `workspaceId`
 * derived from `requireUser()`. Cross-tenant leak is impossible by
 * construction here — there is no path that accepts a workspaceId
 * from the request.
 *
 * Cost: 6 small COUNT queries + one AgentRun.findMany capped at 10
 * rows. Safe to poll every 3s while activity exists.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { internalError } from "@/lib/api-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// How recent is "just finished" — drives the 'X just completed' chip
// so the rep gets a visual heartbeat even when nothing is currently
// running (e.g. between two parallel chain steps).
const RECENT_WINDOW_MS = 60_000;
const MAX_VISIBLE_WORKERS = 10;

export async function GET() {
  try {
    const { workspaceId } = await requireUser();

    const recentSince = new Date(Date.now() - RECENT_WINDOW_MS);

    // All queries run in parallel — they touch different tables /
    // different status partitions and Postgres serves them off the
    // (workspace_id, *) indexes.
    const [
      crawling,
      analyzing,
      pipelinePending,
      recentlyAnalyzed,
      total,
      runningRuns,
      runningCount,
      oldestRun,
      recentlyCompletedRuns,
    ] = await Promise.all([
      prisma.lead.count({
        where: {
          workspaceId,
          crawlStatus: { in: ["PENDING", "CRAWLING"] },
          // PENDING leads with no website are not "crawling" — they
          // skip straight to analysis. Filter them out so the count
          // reflects work that will actually keep the UI waiting.
          hasWebsite: true,
        },
      }),
      prisma.lead.count({
        where: {
          workspaceId,
          analyzeStatus: { in: ["PENDING", "ANALYZING"] },
        },
      }),
      prisma.lead.count({
        where: {
          workspaceId,
          OR: [
            {
              crawlStatus: { in: ["PENDING", "CRAWLING"] },
              hasWebsite: true,
            },
            {
              analyzeStatus: { in: ["PENDING", "ANALYZING"] },
            },
          ],
        },
      }),
      prisma.lead.count({
        where: {
          workspaceId,
          analyzeStatus: "ANALYZED",
          updatedAt: { gte: recentSince },
        },
      }),
      prisma.lead.count({ where: { workspaceId, archivedAt: null } }),
      prisma.agentRun.findMany({
        where: {
          workspaceId,
          status: { in: ["PENDING", "RUNNING"] },
        },
        select: {
          id: true,
          workerKind: true,
          leadId: true,
          status: true,
          createdAt: true,
          startedAt: true,
          lead: { select: { businessName: true } },
        },
        orderBy: { createdAt: "asc" },
        take: MAX_VISIBLE_WORKERS,
      }),
      // Actual total in-flight count — separate from the display list
      // which is capped at MAX_VISIBLE_WORKERS. Async-Apify jobs stay
      // RUNNING while Apify's cloud processes them, so this can be much
      // larger than the worker concurrency setting.
      prisma.agentRun.count({
        where: { workspaceId, status: { in: ["PENDING", "RUNNING"] } },
      }),
      prisma.agentRun.findFirst({
        where: {
          workspaceId,
          status: { in: ["PENDING", "RUNNING"] },
        },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.agentRun.count({
        where: {
          workspaceId,
          status: "SUCCEEDED",
          finishedAt: { gte: recentSince },
        },
      }),
    ]);

    const now = Date.now();
    const workers = runningRuns.map((r) => ({
      id: r.id,
      kind: r.workerKind,
      leadId: r.leadId,
      leadName: r.lead?.businessName ?? null,
      status: r.status,
      ageSeconds: Math.max(
        0,
        Math.floor(
          (now - new Date(r.startedAt ?? r.createdAt).getTime()) / 1000,
        ),
      ),
    }));

    const running = runningCount;
    const isIdle =
      pipelinePending === 0 &&
      running === 0 &&
      recentlyAnalyzed === 0 &&
      recentlyCompletedRuns === 0;

    return NextResponse.json(
      {
        idle: isIdle,
        totals: {
          crawling,
          analyzing,
          pipelinePending,
          recentlyAnalyzed,
          total,
        },
        activity: {
          running,
          oldestStartedAt: oldestRun?.createdAt ?? null,
          recentlyCompleted: recentlyCompletedRuns,
        },
        workers,
      },
      {
        headers: {
          // Don't let the browser or any CDN cache this — it's the
          // "are we still working?" heartbeat.
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.leads.processing_status.error", err);
  }
}
