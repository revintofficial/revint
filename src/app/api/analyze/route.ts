import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeLeadWithGemini } from "@/lib/gemini";
import {
  calculateDeterministicScore,
  suggestOffer,
  estimatePriceBand,
} from "@/lib/scoring";
import type { WebsiteFeatures } from "@/types";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import {
  assertCanUseAi,
  recordAiUsed,
  QuotaExceededError,
} from "@/lib/quotas";

export async function POST(request: Request) {
  try {
    const { workspaceId } = await requireUser();
    const body = await request.json();
    const { leadId, analyzeAll = false } = body;

    if (analyzeAll) {
      const pendingLeads = await prisma.lead.findMany({
        where: {
          workspaceId,
          analyzeStatus: "PENDING",
          OR: [
            { crawlStatus: "CRAWLED" },
            { crawlStatus: "NO_WEBSITE" },
            { crawlStatus: "FAILED" },
          ],
        },
        include: { websiteAudit: true },
        take: 50,
      });

      let analyzed = 0;
      let failed = 0;
      let quotaHit: string | null = null;

      for (const lead of pendingLeads) {
        try {
          await assertCanUseAi(workspaceId, 1);
        } catch (e) {
          if (e instanceof QuotaExceededError) {
            quotaHit = e.message;
            break;
          }
          throw e;
        }
        try {
          await analyzeSingleLead(lead.id);
          await recordAiUsed(workspaceId, 1);
          analyzed++;
        } catch (err) {
          console.error(`Analyze failed for ${lead.businessName}:`, err);
          failed++;
        }
      }

      return NextResponse.json({
        success: true,
        analyzed,
        failed,
        total: pendingLeads.length,
        ...(quotaHit ? { quota: quotaHit } : {}),
      });
    }

    if (!leadId) {
      return NextResponse.json({ error: "leadId is required" }, { status: 400 });
    }

    // Verify lead belongs to workspace
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, workspaceId },
      select: { id: true },
    });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    await assertCanUseAi(workspaceId, 1);
    const result = await analyzeSingleLead(leadId);
    await recordAiUsed(workspaceId, 1);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof QuotaExceededError) {
      return error.toResponse();
    }
    console.error("Analyze error:", error);
    return NextResponse.json(
      { error: "Analysis failed", details: String(error) },
      { status: 500 }
    );
  }
}

async function analyzeSingleLead(leadId: string) {
  await prisma.lead.update({
    where: { id: leadId },
    data: { analyzeStatus: "ANALYZING" },
  });

  try {
    const lead = await prisma.lead.findUniqueOrThrow({
      where: { id: leadId },
      include: { websiteAudit: true },
    });

    const features = lead.websiteAudit?.rawFeaturesJson as unknown as WebsiteFeatures | null;

    const { score: deterministicScore, reasons } = calculateDeterministicScore(
      lead.hasWebsite,
      lead.rating,
      lead.reviewCount,
      features
    );

    let analysis;
    try {
      analysis = await analyzeLeadWithGemini(
        lead.businessName,
        lead.formattedAddress,
        lead.rating,
        lead.reviewCount,
        lead.websiteUrl,
        features
      );
    } catch (aiError) {
      console.error(`[Analyze] Gemini failed for ${leadId}:`, aiError);
      const offer = suggestOffer(deterministicScore, reasons);
      analysis = {
        opportunity_score: deterministicScore,
        reason_codes: reasons,
        why_good_target: "AI analysis unavailable. Falling back to deterministic score.",
        likely_pain_points: reasons,
        best_sales_angle: "Pitch a focused upgrade that closes their biggest gap.",
        suggested_offer: offer,
        personalized_first_message: `Hi, would ${lead.businessName} be interested in a quick chat about a faster, more conversion-focused website?`,
        expected_price_band: estimatePriceBand(offer),
      };
    }

    const finalScore = Math.round(
      deterministicScore * 0.4 + analysis.opportunity_score * 0.6
    );

    const mergedReasons = [...new Set([...reasons, ...analysis.reason_codes])];
    const finalOffer = analysis.suggested_offer || suggestOffer(finalScore, mergedReasons);

    await prisma.salesOpportunity.upsert({
      where: { leadId },
      create: {
        leadId,
        opportunityScore: Math.min(finalScore, 100),
        reasonCodes: mergedReasons,
        whyGoodTarget: analysis.why_good_target,
        likelyPainPoints: analysis.likely_pain_points,
        bestSalesAngle: analysis.best_sales_angle,
        suggestedOffer: finalOffer.toUpperCase() as "STARTER" | "GROWTH" | "SALES",
        personalizedFirstMessage: analysis.personalized_first_message,
        expectedPriceBand: analysis.expected_price_band || estimatePriceBand(finalOffer),
        status: "NEW",
      },
      update: {
        opportunityScore: Math.min(finalScore, 100),
        reasonCodes: mergedReasons,
        whyGoodTarget: analysis.why_good_target,
        likelyPainPoints: analysis.likely_pain_points,
        bestSalesAngle: analysis.best_sales_angle,
        suggestedOffer: finalOffer.toUpperCase() as "STARTER" | "GROWTH" | "SALES",
        personalizedFirstMessage: analysis.personalized_first_message,
        expectedPriceBand: analysis.expected_price_band || estimatePriceBand(finalOffer),
      },
    });

    await prisma.lead.update({
      where: { id: leadId },
      data: { analyzeStatus: "ANALYZED" },
    });

    return { score: finalScore, offer: finalOffer };
  } catch (error) {
    await prisma.lead.update({
      where: { id: leadId },
      data: { analyzeStatus: "FAILED" },
    });
    throw error;
  }
}
