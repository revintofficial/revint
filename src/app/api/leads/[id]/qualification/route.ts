/**
 * FineDine v1 update — qualification checklist read/write.
 *
 * GET  → current qualification state for the lead.
 * POST → save checklist answers; recompute qualified / status against the
 *        workspace playbook, persist `LeadQualification`, and reflect the
 *        rolled-up temperature on the lead. Writes a NOTE activity so the
 *        timeline records the qualification change. Phase 4 hooks the
 *        HubSpot writeback off the same save.
 *
 * BODY: { answers: Record<string, boolean>, noShowRisk?: "low"|"medium"|"high" }
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { internalError } from "@/lib/api-errors";
import {
  getPlaybook,
  computeQualification,
  computeTemperature,
} from "@/lib/playbook/resolve";
import { enqueueCrmWriteback } from "@/lib/integrations/hubspot/writeback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId } = await requireUser();
    const { id } = await params;
    const lead = await prisma.lead.findFirst({
      where: { id, workspaceId },
      select: { id: true, qualification: true },
    });
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    return NextResponse.json({ qualification: lead.qualification ?? null });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.leads.qualification.GET", err);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId, user } = await requireUser();
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      answers?: Record<string, unknown>;
      noShowRisk?: unknown;
    };

    const lead = await prisma.lead.findFirst({
      where: { id, workspaceId },
      select: {
        id: true,
        playbookStageKey: true,
        lastDisposition: true,
        inboundReceivedAt: true,
      },
    });
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    // Coerce answers to a boolean map.
    const answers: Record<string, boolean> = {};
    if (body.answers && typeof body.answers === "object") {
      for (const [k, v] of Object.entries(body.answers)) {
        answers[k] = v === true;
      }
    }
    const noShowRisk =
      body.noShowRisk === "low" || body.noShowRisk === "medium" || body.noShowRisk === "high"
        ? body.noShowRisk
        : null;

    const playbook = await getPlaybook(prisma, workspaceId);
    const result = computeQualification(playbook, answers);

    const currentStage = playbook.stages.find((s) => s.key === lead.playbookStageKey);
    const hoursSinceInbound = lead.inboundReceivedAt
      ? (Date.now() - lead.inboundReceivedAt.getTime()) / 3_600_000
      : null;
    const temperature = computeTemperature(playbook, {
      hoursSinceInbound,
      lastDisposition: lead.lastDisposition,
      qualified: result.qualified || !!currentStage?.isQualified,
    });

    const qualificationRisk =
      result.status === "info_only"
        ? "high"
        : result.missing.length === 0
          ? "low"
          : result.missing.length <= 1
            ? "medium"
            : "high";

    await prisma.$transaction([
      prisma.leadQualification.upsert({
        where: { leadId: id },
        create: {
          workspaceId,
          leadId: id,
          answers,
          qualified: result.qualified,
          status: result.status,
          qualificationRisk,
          noShowRisk,
          updatedByUserId: user.id,
        },
        update: {
          answers,
          qualified: result.qualified,
          status: result.status,
          qualificationRisk,
          ...(noShowRisk ? { noShowRisk } : {}),
          updatedByUserId: user.id,
        },
      }),
      prisma.lead.update({
        where: { id },
        data: { leadTemperature: temperature },
      }),
      prisma.leadActivity.create({
        data: {
          workspaceId,
          leadId: id,
          userId: user.id,
          kind: "NOTE",
          payload: {
            body: `Qualification updated: ${result.status}${result.qualified ? " (qualified)" : ""}`,
          },
        },
      }),
    ]);

    // Phase 4 — push the rolled-up signal to HubSpot (best-effort outbox).
    void enqueueCrmWriteback(prisma, {
      workspaceId,
      leadId: id,
      reason: "qualification",
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      qualified: result.qualified,
      status: result.status,
      qualificationRisk,
      noShowRisk,
      temperature,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.leads.qualification.POST", err);
  }
}
