/**
 * POST /api/leads/[id]/pipeline-rerun
 *
 * Re-emits `lead_created` for one lead — the same AI Core chain that runs
 * when the lead is first ingested (per workspace Lead Pipeline settings).
 * Not exposed as a generic planner event; server-only contract.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { internalError } from "@/lib/api-errors";
import { logger } from "@/lib/logger";
import { emit } from "@/lib/ai-core/events";
import { workspaceHasServicePackages } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireUser();
    const { workspaceId } = session;
    const { id: leadId } = await params;

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, workspaceId },
      select: { id: true, pipelineStatus: true },
    });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const hasPackages = await workspaceHasServicePackages(workspaceId);
    if (!hasPackages) {
      return NextResponse.json(
        {
          error: "no_service_packages",
          message:
            "Add at least one service package in Settings before running the intake pipeline.",
        },
        { status: 400 },
      );
    }

    if (lead.pipelineStatus === "BLOCKED_NEEDS_PACKAGES") {
      await prisma.lead.updateMany({
        where: { id: leadId, workspaceId },
        data: { pipelineStatus: "OK" },
      });
    }

    const plannerSessionId = await emit("lead_created", {
      workspaceId,
      leadId,
      userId: session.user.id,
      inputs: { source: "lead_detail_pipeline_rerun" },
    });

    if (!plannerSessionId) {
      return NextResponse.json(
        {
          error: "pipeline_unavailable",
          message:
            "Pipeline did not start. It may be disabled for this workspace (Settings → Lead pipeline).",
        },
        { status: 409 },
      );
    }

    logger.info("api.leads.pipeline_rerun.ok", {
      workspaceId,
      leadId,
      plannerSessionId,
    });

    return NextResponse.json({ sessionId: plannerSessionId });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.leads.pipeline_rerun.error", error);
  }
}
