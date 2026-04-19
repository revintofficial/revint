import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { workspaceId } = await requireUser();
    const { id } = await params;
    const lead = await prisma.lead.findFirst({
      where: { id, workspaceId },
      include: {
        websiteAudit: true,
        salesOpportunity: true,
        watchlistItem: true,
        googleReviews: { orderBy: { publishTime: "desc" } },
        reviewAnalysis: true,
        voiceNotes: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json(lead);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Lead fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch lead" }, { status: 500 });
  }
}
