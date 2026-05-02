import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireWorkspaceAdminApi,
  UnauthorizedError,
  ForbiddenError,
} from "@/lib/auth";
import { internalError } from "@/lib/api-errors";
import { logger } from "@/lib/logger";
import type { SequenceChannel } from "@/generated/prisma/client";

const VALID_CHANNELS: SequenceChannel[] = ["EMAIL", "WHATSAPP", "MANUAL_CALL", "WAIT"];

interface CreateSequenceBody {
  name: string;
  description?: string;
  niche?: string;
  steps: Array<{
    channel: SequenceChannel;
    delayHours: number;
    payload?: Record<string, unknown>;
  }>;
}

/**
 * Phase 2 — list and create sequences for the active workspace.
 * Admin-only because cadence rules are workspace-wide policy.
 */
export async function GET() {
  try {
    const session = await requireWorkspaceAdminApi();
    const sequences = await prisma.sequence.findMany({
      where: { workspaceId: session.workspaceId },
      include: {
        steps: { orderBy: { position: "asc" } },
        _count: { select: { states: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ sequences });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return internalError("api.sequences.list_error", err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireWorkspaceAdminApi();
    const body = (await request.json()) as CreateSequenceBody;

    if (!body.name || !Array.isArray(body.steps) || body.steps.length === 0) {
      return NextResponse.json(
        { error: "name and at least one step are required" },
        { status: 400 },
      );
    }

    for (const step of body.steps) {
      if (!VALID_CHANNELS.includes(step.channel)) {
        return NextResponse.json(
          { error: `Invalid channel: ${step.channel}` },
          { status: 400 },
        );
      }
      if (typeof step.delayHours !== "number" || step.delayHours < 0) {
        return NextResponse.json(
          { error: "delayHours must be a non-negative number" },
          { status: 400 },
        );
      }
    }

    const sequence = await prisma.sequence.create({
      data: {
        workspaceId: session.workspaceId,
        name: body.name,
        description: body.description ?? null,
        niche: body.niche ?? null,
        steps: {
          create: body.steps.map((step, idx) => ({
            position: idx,
            channel: step.channel,
            delayHours: step.delayHours,
            payload: (step.payload ?? {}) as object,
          })),
        },
      },
      include: { steps: { orderBy: { position: "asc" } } },
    });

    logger.info("api.sequences.created", {
      sequenceId: sequence.id,
      workspaceId: session.workspaceId,
      stepCount: sequence.steps.length,
    });
    return NextResponse.json({ sequence });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return internalError("api.sequences.create_error", err);
  }
}
