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
    const { siteUrl, notes, selectedOffer, meetingResult, pipelineNotes } = body;

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
