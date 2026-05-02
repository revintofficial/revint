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

  // L4 fix - findFirst({id, workspaceId}) instead of findUnique({id})
  // + post-check. The previous version leaked timing info (post-
  // check 404 ≠ scoped 404) and was an IDOR shape. Same pattern as
  // L1/L2/L3.
  const sessionRow = await prisma.plannerSession.findFirst({
    where: { id, workspaceId: session.workspaceId },
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

  if (!sessionRow) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // L4 - the runs lookup was scoped only by plannerSessionId; if a
  // future PR removes the parent guard above, runs from another
  // tenant's planner session could leak. Belt-and-braces with the
  // workspaceId predicate (AgentRun has it as a denormalized
  // column for exactly this reason).
  const runs = await prisma.agentRun.findMany({
    where: { plannerSessionId: id, workspaceId: session.workspaceId },
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
