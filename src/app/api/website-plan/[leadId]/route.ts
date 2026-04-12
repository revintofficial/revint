import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateWebsitePlan } from "@/lib/gemini";
import type { WebsiteFeatures } from "@/types";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params;

    const lead = await prisma.lead.findUniqueOrThrow({
      where: { id: leadId },
      include: {
        websiteAudit: true,
        salesOpportunity: true,
        googleReviews: { orderBy: { publishTime: "desc" }, take: 30 },
        watchlistItem: true,
      },
    });

    if (!lead.watchlistItem) {
      return NextResponse.json(
        { error: "Lead is not in watchlist" },
        { status: 400 }
      );
    }

    const features = lead.websiteAudit?.rawFeaturesJson as unknown as WebsiteFeatures | null;

    const plan = await generateWebsitePlan({
      businessName: lead.businessName,
      address: lead.formattedAddress,
      phone: lead.phone,
      rating: lead.rating,
      reviewCount: lead.reviewCount,
      websiteUrl: lead.websiteUrl,
      features,
      reviews: lead.googleReviews.map((r) => ({
        authorName: r.authorName,
        rating: r.rating,
        text: r.text,
      })),
      salesOpportunity: lead.salesOpportunity
        ? {
            opportunityScore: lead.salesOpportunity.opportunityScore,
            reasonCodes: lead.salesOpportunity.reasonCodes as string[],
            whyGoodTarget: lead.salesOpportunity.whyGoodTarget,
            likelyPainPoints: lead.salesOpportunity.likelyPainPoints as string[],
            suggestedOffer: lead.salesOpportunity.suggestedOffer,
            bestSalesAngle: lead.salesOpportunity.bestSalesAngle,
          }
        : null,
    });

    try {
      await prisma.watchlistItem.update({
        where: { id: lead.watchlistItem.id },
        data: { websitePlan: plan },
      });
    } catch (saveErr) {
      console.error("Failed to save plan to DB, returning anyway:", saveErr);
    }

    return NextResponse.json({ success: true, plan });
  } catch (error) {
    console.error("Website plan generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate website plan", details: String(error) },
      { status: 500 }
    );
  }
}
