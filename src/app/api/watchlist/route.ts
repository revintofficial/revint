import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const { workspaceId } = await requireUser();
    const items = await prisma.watchlistItem.findMany({
      where: { lead: { workspaceId } },
      include: {
        lead: {
          include: {
            salesOpportunity: {
              select: {
                opportunityScore: true,
                suggestedOffer: true,
                status: true,
                whyGoodTarget: true,
                likelyPainPoints: true,
                bestSalesAngle: true,
                personalizedFirstMessage: true,
                expectedPriceBand: true,
                reasonCodes: true,
              },
            },
            googleReviews: { orderBy: { publishTime: "desc" } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.watchlist.fetch_error", { err: error });
    return NextResponse.json(
      { error: "Failed to fetch watchlist", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

async function triggerAnalysis(leadId: string, origin: string, cookie: string) {
  try {
    await fetch(`${origin}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ leadId }),
    });
  } catch (err) {
    logger.error("api.watchlist.auto_analyze_trigger_failed", { err });
  }
}

export async function POST(request: Request) {
  try {
    const { workspaceId } = await requireUser();
    const body = await request.json();
    const { leadId, siteUrl, notes } = body;

    if (!leadId) {
      return NextResponse.json({ error: "leadId is required" }, { status: 400 });
    }

    // Make sure the lead belongs to this workspace.
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, workspaceId },
      include: { salesOpportunity: true, watchlistItem: true },
    });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    if (lead.watchlistItem) {
      return NextResponse.json({ error: "Lead is already in watchlist" }, { status: 409 });
    }

    const item = await prisma.watchlistItem.create({
      data: {
        leadId,
        siteUrl: siteUrl || null,
        notes: notes || null,
      },
      include: { lead: { include: { salesOpportunity: true } } },
    });

    if (!lead.salesOpportunity) {
      const origin = new URL(request.url).origin;
      const cookie = request.headers.get("cookie") || "";
      triggerAnalysis(leadId, origin, cookie);
    }

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.watchlist.create_error", { err: error });
    return NextResponse.json({ error: "Failed to add to watchlist" }, { status: 500 });
  }
}
