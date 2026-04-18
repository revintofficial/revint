import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateWebsitePlan } from "@/lib/gemini";
import { runAuditChecklist } from "@/lib/audit-checklist";
import type { WebsiteFeatures } from "@/types";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { assertCanUseAi, recordAiUsed, QuotaExceededError } from "@/lib/quotas";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { workspaceId } = await requireUser();
    const { leadId } = await params;

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, workspaceId },
      include: {
        websiteAudit: true,
        salesOpportunity: true,
        googleReviews: { orderBy: { publishTime: "desc" } },
        watchlistItem: true,
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (!lead.watchlistItem) {
      return NextResponse.json(
        { error: "Lead is not in watchlist" },
        { status: 400 }
      );
    }

    await assertCanUseAi(workspaceId, 2);

    const features = lead.websiteAudit?.rawFeaturesJson as unknown as WebsiteFeatures | null;
    const auditChecklist = runAuditChecklist(features, !!lead.websiteUrl);

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
      auditChecklist,
    });

    try {
      await prisma.watchlistItem.update({
        where: { id: lead.watchlistItem.id },
        data: { websitePlan: plan },
      });
    } catch (saveErr) {
      console.error("Failed to save plan to DB, returning anyway:", saveErr);
    }

    await recordAiUsed(workspaceId, 2);

    return NextResponse.json({
      success: true,
      plan,
      auditSummary: auditChecklist.summary,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof QuotaExceededError) {
      return error.toResponse();
    }
    console.error("Website plan generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate website plan", details: String(error) },
      { status: 500 }
    );
  }
}
