import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    const item = await prisma.watchlistItem.update({
      where: { id },
      data: {
        ...(siteUrl !== undefined && { siteUrl }),
        ...(notes !== undefined && { notes }),
        ...(offerValue !== undefined && { selectedOffer: offerValue }),
        ...(resultValue !== undefined && { meetingResult: resultValue }),
        ...(pipelineNotes !== undefined && { pipelineNotes }),
      },
      include: {
        lead: true,
      },
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error("Watchlist update error:", error);
    return NextResponse.json(
      { error: "Failed to update watchlist item" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.watchlistItem.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Watchlist delete error:", error);
    return NextResponse.json(
      { error: "Failed to remove from watchlist" },
      { status: 500 }
    );
  }
}
