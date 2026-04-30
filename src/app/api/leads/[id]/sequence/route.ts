import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { logger } from "@/lib/logger";

interface EnrollBody {
  sequenceId: string;
}

interface PauseBody {
  state: "PAUSE" | "RESUME" | "EXIT";
  reason?: string;
}

/**
 * Phase 2 — enroll, pause, resume, or exit a lead from a sequence.
 *
 * POST   /api/leads/[id]/sequence  → enroll
 * PATCH  /api/leads/[id]/sequence  → pause / resume / exit (active state)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId, user } = await requireUser();
    const { id: leadId } = await params;
    const body = (await request.json()) as EnrollBody;

    if (!body.sequenceId) {
      return NextResponse.json({ error: "sequenceId required" }, { status: 400 });
    }

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, workspaceId },
      select: { id: true, dnc: true, businessName: true },
    });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    if (lead.dnc) {
      return NextResponse.json(
        { error: "dnc_blocked", message: "Cannot enroll a DNC lead in a sequence." },
        { status: 403 },
      );
    }

    const sequence = await prisma.sequence.findFirst({
      where: { id: body.sequenceId, workspaceId, archivedAt: null },
      include: { steps: { orderBy: { position: "asc" } } },
    });
    if (!sequence || sequence.steps.length === 0) {
      return NextResponse.json({ error: "Sequence not found or empty" }, { status: 404 });
    }

    const firstStep = sequence.steps[0];
    const now = new Date();
    const nextStepAt = new Date(now.getTime() + firstStep.delayHours * 60 * 60 * 1000);

    const state = await prisma.leadSequenceState.upsert({
      where: {
        workspaceId_leadId_sequenceId: {
          workspaceId,
          leadId,
          sequenceId: sequence.id,
        },
      },
      create: {
        workspaceId,
        leadId,
        sequenceId: sequence.id,
        currentStepId: firstStep.id,
        state: "ACTIVE",
        nextStepAt,
        enrolledByUserId: user.id,
      },
      update: {
        currentStepId: firstStep.id,
        state: "ACTIVE",
        pausedAt: null,
        pausedReason: null,
        nextStepAt,
        completedAt: null,
        stepsFired: 0,
      },
    });

    await prisma.leadActivity.create({
      data: {
        workspaceId,
        leadId,
        userId: user.id,
        kind: "STATUS_CHANGED",
        payload: {
          enrolled: true,
          sequenceId: sequence.id,
          sequenceName: sequence.name,
          stateId: state.id,
        },
      },
    });

    logger.info("api.leads.sequence.enrolled", {
      leadId,
      workspaceId,
      sequenceId: sequence.id,
    });
    return NextResponse.json({ state });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.leads.sequence.enroll_error", { err });
    return NextResponse.json({ error: "Failed to enroll" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId } = await requireUser();
    const { id: leadId } = await params;
    const body = (await request.json()) as PauseBody;

    const active = await prisma.leadSequenceState.findFirst({
      where: { leadId, workspaceId, state: "ACTIVE" },
      select: { id: true, sequenceId: true },
    });

    if (!active && body.state !== "RESUME") {
      return NextResponse.json({ error: "No active sequence" }, { status: 404 });
    }

    if (body.state === "PAUSE" && active) {
      await prisma.leadSequenceState.update({
        where: { id: active.id },
        data: { state: "PAUSED", pausedAt: new Date(), pausedReason: body.reason ?? "manual" },
      });
      return NextResponse.json({ ok: true });
    }
    if (body.state === "EXIT" && active) {
      await prisma.leadSequenceState.update({
        where: { id: active.id },
        data: { state: "EXITED", completedAt: new Date(), pausedReason: body.reason ?? "manual" },
      });
      return NextResponse.json({ ok: true });
    }
    if (body.state === "RESUME") {
      const paused = await prisma.leadSequenceState.findFirst({
        where: { leadId, workspaceId, state: "PAUSED" },
        select: { id: true },
      });
      if (!paused) {
        return NextResponse.json({ error: "No paused sequence" }, { status: 404 });
      }
      await prisma.leadSequenceState.update({
        where: { id: paused.id },
        data: { state: "ACTIVE", pausedAt: null, pausedReason: null },
      });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Invalid state transition" }, { status: 400 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.leads.sequence.patch_error", { err });
    return NextResponse.json({ error: "Failed to update sequence state" }, { status: 500 });
  }
}
