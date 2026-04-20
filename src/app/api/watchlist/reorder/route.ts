import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { logger } from "@/lib/logger";

const VALID_STAGES = ["NEW", "REACHED_OUT", "IN_TALKS", "WON", "LOST"] as const;
type PipelineStageValue = (typeof VALID_STAGES)[number];

interface ReorderEntry {
  id: string;
  pipelineStage: PipelineStageValue;
  stageOrder: number;
}

// POST /api/watchlist/reorder
// Body: { items: [{ id, pipelineStage, stageOrder }, ...] }
// Applies a batch of stage + order updates in a single transaction. Used by
// the kanban board on drag-end. The caller sends the full new sequence for
// whichever column(s) changed.
export async function POST(request: Request) {
  try {
    const { workspaceId } = await requireUser();
    const body = await request.json();
    const items = Array.isArray(body?.items) ? body.items : null;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "items[] is required" }, { status: 400 });
    }

    const clean: ReorderEntry[] = [];
    for (const raw of items) {
      if (!raw || typeof raw !== "object") continue;
      const { id, pipelineStage, stageOrder } = raw as Record<string, unknown>;
      if (typeof id !== "string" || !id) continue;
      if (typeof pipelineStage !== "string" || !VALID_STAGES.includes(pipelineStage as PipelineStageValue)) continue;
      if (typeof stageOrder !== "number" || !Number.isFinite(stageOrder)) continue;
      clean.push({
        id,
        pipelineStage: pipelineStage as PipelineStageValue,
        stageOrder: Math.trunc(stageOrder),
      });
    }

    if (clean.length === 0) {
      return NextResponse.json({ error: "no valid items" }, { status: 400 });
    }

    // Guard: every id must belong to the caller's workspace. Skip anything that
    // doesn't so a tampered payload can't move another tenant's cards.
    const owned = await prisma.watchlistItem.findMany({
      where: {
        id: { in: clean.map((c) => c.id) },
        lead: { workspaceId },
      },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((o) => o.id));
    const safe = clean.filter((c) => ownedIds.has(c.id));

    if (safe.length === 0) {
      return NextResponse.json({ error: "no owned items" }, { status: 404 });
    }

    await prisma.$transaction(
      safe.map((entry) =>
        prisma.watchlistItem.update({
          where: { id: entry.id },
          data: {
            pipelineStage: entry.pipelineStage as "NEW" | "REACHED_OUT" | "IN_TALKS" | "WON" | "LOST",
            stageOrder: entry.stageOrder,
          },
        })
      )
    );

    return NextResponse.json({ updated: safe.length });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.watchlist.reorder_error", { err: error });
    return NextResponse.json({ error: "Failed to reorder watchlist" }, { status: 500 });
  }
}
