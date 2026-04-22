/**
 * GET /api/planner/[id]
 *
 * Returns a PlannerSession with its current plan JSON and the
 * AgentRun row for every step that has been scheduled. The UI polls
 * this endpoint to render a live DAG progress view under the "Deep
 * research" / "Pitch pack" buttons.
 *
 * Scoping: the session must belong to the caller's workspace;
 * otherwise 404 (not 403, to avoid leaking existence of other
 * workspaces' sessions).
 */
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const GET = withAuth(async (session, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;

  const sessionRow = await prisma.plannerSession.findUnique({
    where: { id },
    select: {
      id: true,
      workspaceId: true,
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

  if (!sessionRow || sessionRow.workspaceId !== session.workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Runs belonging to this session - joined for a single round trip.
  const runs = await prisma.agentRun.findMany({
    where: { plannerSessionId: id },
    select: {
      id: true,
      workerKind: true,
      status: true,
      artifactUrl: true,
      errorMsg: true,
      startedAt: true,
      finishedAt: true,
      costTokens: true,
      costUsdCents: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    session: sessionRow,
    runs,
  });
});
