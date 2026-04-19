import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateWebsitePlan } from "@/lib/gemini";
import { runAuditChecklist } from "@/lib/audit-checklist";
import type { WebsiteFeatures } from "@/types";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { assertCanUseAi, recordAiUsed, QuotaExceededError } from "@/lib/quotas";
import { generateMockupSlug } from "@/lib/mockup";
import { getNicheByQuery } from "@/lib/niches";

export async function POST(
  request: Request,
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
        // P0.3 - Mockup × Review Intelligence sinerjisi: review KPI verisi
        // mockup hero/services/CTA shape eder.
        reviewAnalysis: true,
        // P0.2 - Workspace "My Offer" context inject.
        workspace: {
          select: {
            offerName: true,
            valueProposition: true,
            socialProof: true,
            offerHook: true,
            objective: true,
            tone: true,
            length: true,
            language: true,
            senderName: true,
            conversionLink: true,
          },
        },
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Auto-add to watchlist if missing. The plan is persisted on
    // WatchlistItem.websitePlan, and forcing the user to add the lead
    // manually before generating a plan was a silent UX dead-end.
    let watchlistItem = lead.watchlistItem;
    if (!watchlistItem) {
      watchlistItem = await prisma.watchlistItem.create({
        data: { leadId: lead.id },
      });
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
      // P0.3 - feed Review Intelligence into the mockup prompt
      reviewIntelligence: lead.reviewAnalysis
        ? {
            weaknessKpis: lead.reviewAnalysis.weaknessKpis as Array<{
              label: string;
              percent: number;
              examples: string[];
            }>,
            strengthKpis: lead.reviewAnalysis.strengthKpis as Array<{
              label: string;
              percent: number;
              examples: string[];
            }>,
            painPhrases: lead.reviewAnalysis.painPhrases as string[],
            strengthPhrases: lead.reviewAnalysis.strengthPhrases as string[],
            switchSignals: lead.reviewAnalysis.switchSignals as Array<{
              from: string;
              to: string;
              reason: string;
            }>,
            sentimentBreakdown: lead.reviewAnalysis.sentimentBreakdown as {
              positive: number;
              neutral: number;
              negative: number;
            },
            leadScore: lead.reviewAnalysis.leadScore,
            summary: lead.reviewAnalysis.summary ?? "",
          }
        : null,
      // P0.2 - workspace "My Offer" context
      offer: lead.workspace,
    });

    // Create a public mockup so we can hand the prospect a clickable link
    // in the cold email. Default expiry: 30 days. Workspaces can republish or
    // disable later via the settings UI.
    let mockupUrl: string | null = null;
    try {
      const slug = generateMockupSlug();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const niche = lead.sourceQuery ? getNicheByQuery(lead.sourceQuery.split(" in ")[0]) : undefined;
      const mockup = await prisma.mockup.create({
        data: {
          slug,
          leadId,
          workspaceId,
          htmlContent: plan,
          templateId: niche?.mockupTemplateId ?? null,
          expiresAt,
          isPublic: true,
        },
      });
      const proto = request.headers.get("x-forwarded-proto") || "https";
      const host = request.headers.get("host") || "leadengine.app";
      mockupUrl = `${proto}://${host}/m/${mockup.slug}`;
    } catch (mockupErr) {
      console.error("Failed to create mockup; plan saved without public URL:", mockupErr);
    }

    // Persist plan to watchlist, with the public mockup link appended as a
    // footer so the user can grab it alongside the plan when copying the
    // opener. The mockup itself doesn't include this footer (would be
    // recursive); only the watchlist copy does.
    const planWithLink = mockupUrl
      ? `${plan}\n\n---\n\n**Share this draft:** [${mockupUrl}](${mockupUrl})`
      : plan;

    try {
      await prisma.watchlistItem.update({
        where: { id: watchlistItem.id },
        data: { websitePlan: planWithLink },
      });
    } catch (saveErr) {
      console.error("Failed to save plan to DB, returning anyway:", saveErr);
    }

    await recordAiUsed(workspaceId, 2);

    return NextResponse.json({
      success: true,
      plan: planWithLink,
      mockupUrl,
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
