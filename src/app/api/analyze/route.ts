import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeLeadWithGemini } from "@/lib/gemini";
import {
  calculateDeterministicScore,
  suggestOffer,
  estimatePriceBand,
} from "@/lib/scoring";
import type { WebsiteFeatures } from "@/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { leadId, analyzeAll = false } = body;

    if (analyzeAll) {
      const pendingLeads = await prisma.lead.findMany({
        where: {
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

      for (const lead of pendingLeads) {
        try {
          await analyzeSingleLead(lead.id);
          analyzed++;
        } catch (err) {
          console.error(`Analyze failed for ${lead.businessName}:`, err);
          failed++;
        }
      }

      return NextResponse.json({ success: true, analyzed, failed, total: pendingLeads.length });
    }

    if (!leadId) {
      return NextResponse.json({ error: "leadId is required" }, { status: 400 });
    }

    const result = await analyzeSingleLead(leadId);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
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
    } catch {
      const offer = suggestOffer(deterministicScore, reasons);
      analysis = {
        opportunity_score: deterministicScore,
        reason_codes: reasons,
        why_good_target: "AI analiz yapilamadi. Deterministik skor kullanildi.",
        likely_pain_points: reasons,
        best_sales_angle: "Dijital varliklarini guclendirebilecekleri bir teklif sunun.",
        suggested_offer: offer,
        personalized_first_message: `Merhaba, ${lead.businessName} icin profesyonel bir web sitesi olusturmak ister misiniz?`,
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
