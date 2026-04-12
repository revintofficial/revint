import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const items = await prisma.watchlistItem.findMany({
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
            googleReviews: {
              orderBy: { publishTime: "desc" },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Watchlist fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch watchlist" },
      { status: 500 }
    );
  }
}

async function triggerAnalysis(leadId: string, origin: string) {
  try {
    await fetch(`${origin}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId }),
    });
  } catch (err) {
    console.error("Auto-analyze trigger failed:", err);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { leadId, siteUrl, notes } = body;

    if (!leadId) {
      return NextResponse.json(
        { error: "leadId is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.watchlistItem.findUnique({
      where: { leadId },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Lead is already in watchlist" },
        { status: 409 }
      );
    }

    const item = await prisma.watchlistItem.create({
      data: {
        leadId,
        siteUrl: siteUrl || null,
        notes: notes || null,
      },
      include: {
        lead: {
          include: { salesOpportunity: true },
        },
      },
    });

    const origin = new URL(request.url).origin;

    if (!item.lead.salesOpportunity) {
      triggerAnalysis(leadId, origin);
    }

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Watchlist create error:", error);
    return NextResponse.json(
      { error: "Failed to add to watchlist" },
      { status: 500 }
    );
  }
}
