import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { logger } from "@/lib/logger";

/**
 * Phase 1 — return the latest cached LEAD_INTELLIGENCE_BRIEF output
 * for a given lead. Workspace-scoped by `requireUser()`. The UI's
 * "Sales Talking Points" card reads off this endpoint and falls back
 * to triggering a new run via /api/leads/[id]/workers/LEAD_INTELLIGENCE_BRIEF
 * when no cached output exists yet.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId } = await requireUser();
    const { id } = await params;

    const lead = await prisma.lead.findFirst({
      where: { id, workspaceId },
      select: { id: true },
    });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const run = await prisma.agentRun.findFirst({
      where: {
        workspaceId,
        leadId: id,
        workerKind: "LEAD_INTELLIGENCE_BRIEF",
        status: "SUCCEEDED",
      },
      orderBy: { finishedAt: "desc" },
      select: {
        id: true,
        outputJson: true,
        finishedAt: true,
      },
    });

    if (!run) {
      return NextResponse.json({ brief: null }, { status: 200 });
    }

    return NextResponse.json({
      brief: run.outputJson,
      runId: run.id,
      finishedAt: run.finishedAt,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.leads.intelligence_brief.error", { err: error });
    return NextResponse.json({ error: "Failed to load brief" }, { status: 500 });
  }
}
