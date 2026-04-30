/**
 * GET /api/leads/[id]/deep-research-session
 *
 * Returns the most recent `USER_DEEP_RESEARCH` PlannerSession for a
 * lead, along with its associated AgentRuns. Used by the
 * DeepResearchProgressPanel on the lead detail page to render a
 * unified live progress view across the parallel Apify workers.
 *
 * Response shape:
 *   - When a session exists: `{ session: { id, status, plan, ... },
 *     runs: [...], hasActiveSession: boolean }`
 *   - When no session has ever run: `{ session: null, runs: [], hasActiveSession: false }`
 *
 * `hasActiveSession` is `true` when status is `PLANNING` or `EXECUTING`.
 * Terminal sessions (`COMPLETED`/`FAILED`/`CANCELLED`) are still
 * returned for one final render pass so the UI can swap to a success
 * / error summary; the panel hides itself a few seconds after that.
 *
 * Multi-tenant: lead is verified by workspaceId before reading any
 * planner row.
 */
import { NextResponse } from "next/server";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { internalError } from "@/lib/api-errors";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId } = await requireUser();
    const { id: leadId } = await params;

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, workspaceId },
      select: { id: true },
    });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Most recent deep-research session for this lead, regardless of
    // status. Caller decides whether to render based on
    // `hasActiveSession`. We sort by createdAt desc + take 1 because a
    // lead can have many over its lifetime; only the latest matters
    // for live progress.
    const sessionRow = await prisma.plannerSession.findFirst({
      where: {
        workspaceId,
        leadId,
        triggeredBy: "USER_DEEP_RESEARCH",
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        leadId: true,
        goal: true,
        status: true,
        plan: true,
        triggeredBy: true,
        errorMsg: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!sessionRow) {
      return NextResponse.json({
        session: null,
        runs: [],
        hasActiveSession: false,
      });
    }

    const runs = await prisma.agentRun.findMany({
      where: { plannerSessionId: sessionRow.id },
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
      orderBy: { createdAt: "asc" },
    });

    const hasActiveSession =
      sessionRow.status === "PLANNING" || sessionRow.status === "EXECUTING";

    return NextResponse.json({
      session: sessionRow,
      runs,
      hasActiveSession,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.lead.deep_research_session.error", err);
  }
}
