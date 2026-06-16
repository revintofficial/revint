/**
 * FineDine v1 update — set the lead's playbook stage.
 *
 * Updates `Lead.playbookStageKey`, recomputes temperature, writes a
 * STATUS_CHANGED activity, and enqueues a HubSpot deal-stage writeback.
 *
 * BODY: { stageKey: string }
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { internalError } from "@/lib/api-errors";
import { getPlaybook, computeTemperature } from "@/lib/playbook/resolve";
import { enqueueCrmWriteback } from "@/lib/integrations/hubspot/writeback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId, user } = await requireUser();
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { stageKey?: unknown };
    const stageKey = typeof body.stageKey === "string" ? body.stageKey : null;
    if (!stageKey) {
      return NextResponse.json({ error: "stageKey required" }, { status: 400 });
    }

    const lead = await prisma.lead.findFirst({
      where: { id, workspaceId },
      select: {
        id: true,
        playbookStageKey: true,
        lastDisposition: true,
        inboundReceivedAt: true,
        qualification: { select: { qualified: true } },
      },
    });
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    const playbook = await getPlaybook(prisma, workspaceId);
    const stage = playbook.stages.find((s) => s.key === stageKey);
    if (!stage) {
      return NextResponse.json(
        { error: "Unknown stage", allowed: playbook.stages.map((s) => s.key) },
        { status: 400 },
      );
    }

    const hoursSinceInbound = lead.inboundReceivedAt
      ? (Date.now() - lead.inboundReceivedAt.getTime()) / 3_600_000
      : null;
    const temperature = computeTemperature(playbook, {
      hoursSinceInbound,
      lastDisposition: lead.lastDisposition,
      qualified: lead.qualification?.qualified || !!stage.isQualified,
    });

    await prisma.$transaction([
      prisma.lead.update({
        where: { id },
        data: { playbookStageKey: stageKey, leadTemperature: temperature },
      }),
      prisma.leadActivity.create({
        data: {
          workspaceId,
          leadId: id,
          userId: user.id,
          kind: "STATUS_CHANGED",
          payload: { from: lead.playbookStageKey, to: stageKey, kind: "playbook_stage" },
        },
      }),
    ]);

    void enqueueCrmWriteback(prisma, { workspaceId, leadId: id, reason: "stage" }).catch(
      () => {},
    );

    return NextResponse.json({ ok: true, stageKey, temperature });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.leads.playbook_stage.POST", err);
  }
}
