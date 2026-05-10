import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { workspaceId } = await requireUser();
    const { id } = await params;
    const body = await request.json();
    const {
      siteUrl,
      notes,
      selectedOffer,
      meetingResult,
      pipelineNotes,
      pipelineStage,
      stageOrder,
      dealStage,
      dealStageOrder,
    } = body;

    const validOffers = ["STARTER", "GROWTH", "SALES"];
    const offerValue =
      selectedOffer === null
        ? null
        : validOffers.includes(selectedOffer)
        ? selectedOffer
        : undefined;

    const validResults = ["POSITIVE", "NEGATIVE", "IN_PROGRESS"];
    const resultValue =
      meetingResult === null
        ? null
        : validResults.includes(meetingResult)
        ? meetingResult
        : undefined;

    const validStages = ["NEW", "REACHED_OUT", "IN_TALKS", "WON", "LOST"];
    const stageValue =
      typeof pipelineStage === "string" && validStages.includes(pipelineStage)
        ? pipelineStage
        : undefined;

    const orderValue =
      typeof stageOrder === "number" && Number.isFinite(stageOrder)
        ? Math.trunc(stageOrder)
        : undefined;

    const validDealStages = [
      "PROSPECTING",
      "PREPARATION",
      "APPROACH",
      "DISCOVERY",
      "PRESENTATION",
      "OBJECTION_HANDLING",
      "NEGOTIATION",
      "CLOSING",
      "WON",
      "LOST",
      "FOLLOWUP",
    ];
    const dealStageValue =
      typeof dealStage === "string" && validDealStages.includes(dealStage)
        ? dealStage
        : undefined;
    const dealStageOrderValue =
      typeof dealStageOrder === "number" && Number.isFinite(dealStageOrder)
        ? Math.trunc(dealStageOrder)
        : undefined;

    const existing = await prisma.watchlistItem.findFirst({
      where: { id, lead: { workspaceId } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const item = await prisma.watchlistItem.update({
      where: { id },
      data: {
        ...(siteUrl !== undefined && { siteUrl }),
        ...(notes !== undefined && { notes }),
        ...(offerValue !== undefined && { selectedOffer: offerValue }),
        ...(resultValue !== undefined && { meetingResult: resultValue }),
        ...(pipelineNotes !== undefined && { pipelineNotes }),
        ...(stageValue !== undefined && {
          pipelineStage: stageValue as "NEW" | "REACHED_OUT" | "IN_TALKS" | "WON" | "LOST",
        }),
        ...(orderValue !== undefined && { stageOrder: orderValue }),
        ...(dealStageValue !== undefined && {
          dealStage: dealStageValue as
            | "PROSPECTING"
            | "PREPARATION"
            | "APPROACH"
            | "DISCOVERY"
            | "PRESENTATION"
            | "OBJECTION_HANDLING"
            | "NEGOTIATION"
            | "CLOSING"
            | "WON"
            | "LOST"
            | "FOLLOWUP",
        }),
        ...(dealStageOrderValue !== undefined && {
          dealStageOrder: dealStageOrderValue,
        }),
      },
      include: { lead: true },
    });

    return NextResponse.json(item);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.watchlist.update_error", { err: error });
    return NextResponse.json({ error: "Failed to update watchlist item" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { workspaceId } = await requireUser();
    const { id } = await params;

    const result = await prisma.watchlistItem.deleteMany({
      where: { id, lead: { workspaceId } },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.watchlist.delete_error", { err: error });
    return NextResponse.json({ error: "Failed to remove from watchlist" }, { status: 500 });
  }
}
