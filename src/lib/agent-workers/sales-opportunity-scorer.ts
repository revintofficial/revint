/**
 * SALES_OPPORTUNITY_SCORER worker wrapper for AI Core.
 *
 * Registry adapter over the existing analyze pipeline. Computes the
 * deterministic score, calls Gemini for the qualitative analysis,
 * blends the two into a 0-100 opportunity score and persists into
 * `SalesOpportunity`.
 *
 * Re-entrant: the `user_deep_research` chain calls this a second
 * time after Apify enrichment has updated review + competitor data.
 * Each run overwrites the row (last-write-wins).
 */
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { analyzeLeadWithGemini } from "@/lib/gemini";
import {
  calculateDeterministicScore,
  suggestOffer,
  estimatePriceBand,
} from "@/lib/scoring";
import type { WebsiteFeatures } from "@/types";
import type {
  AgentWorkerContext,
  AgentWorkerOutput,
  AgentWorkerRun,
  MemoryWrite,
} from "./types";

const REASON_TR: Record<string, string> = {
  no_website: "Web sitesi bulunmuyor",
  poor_mobile: "Mobil uyumluluk zayif",
  no_booking: "Online randevu sistemi yok",
  no_whatsapp: "WhatsApp iletisim butonu yok",
  no_https: "SSL sertifikasi (HTTPS) eksik",
  weak_seo: "SEO optimizasyonu zayif",
  slow_site: "Site yuklenmesi cok yavas",
  no_ecommerce: "Online satis altyapisi yok",
  site_unreachable: "Web sitesine ulasilamiyor",
  services_unclear: "Sunulan hizmetler net degil",
  high_rating_weak_site: "Yuksek puanli ama dijital varligi zayif",
  good_rating: "Iyi puanli isletme",
  uncrawled_website: "Web sitesi henuz analiz edilmedi",
};

const REASON_EN: Record<string, string> = {
  no_website: "No website found",
  poor_mobile: "Poor mobile experience",
  no_booking: "No online booking system",
  no_whatsapp: "No WhatsApp contact button",
  no_https: "Missing SSL certificate (HTTPS)",
  weak_seo: "Weak SEO optimization",
  slow_site: "Site loads very slowly",
  no_ecommerce: "No online sales infrastructure",
  site_unreachable: "Website is unreachable",
  services_unclear: "Services offered are unclear",
  high_rating_weak_site: "High ratings but weak digital presence",
  good_rating: "Well-reviewed business",
  uncrawled_website: "Website has not been crawled yet",
};
const reasonToEnglish = (code: string): string => REASON_EN[code] ?? code;

export const run: AgentWorkerRun = async (ctx): Promise<AgentWorkerOutput> => {
  if (!ctx.lead) throw new Error("SALES_OPPORTUNITY_SCORER requires a lead context");
  const leadId = ctx.lead.id;

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
      features,
    );

    let analysis;
    try {
      analysis = await analyzeLeadWithGemini(
        lead.businessName,
        lead.formattedAddress,
        lead.rating,
        lead.reviewCount,
        lead.websiteUrl,
        features,
        ctx.workspace.language ?? "en",
      );
    } catch (aiError) {
      logger.warn("agent_workers.scorer.gemini_failed", { leadId, err: aiError });
      const offer = suggestOffer(deterministicScore, reasons);
      analysis = {
        opportunity_score: deterministicScore,
        reason_codes: reasons,
        why_good_target: "AI analysis was unavailable; falling back to the deterministic score.",
        likely_pain_points: reasons.map(reasonToEnglish),
        best_sales_angle: "Offer to strengthen their digital presence where the deterministic signals are weakest.",
        suggested_offer: offer,
        personalized_first_message: `Hi ${lead.businessName} team - would you be open to a quick look at a modern website concept we put together for a business like yours?`,
        expected_price_band: estimatePriceBand(offer),
      };
    }

    const finalScore = Math.min(
      100,
      Math.round(deterministicScore * 0.4 + analysis.opportunity_score * 0.6),
    );
    const mergedReasons = Array.from(new Set([...reasons, ...analysis.reason_codes]));
    const finalOffer = analysis.suggested_offer || suggestOffer(finalScore, mergedReasons);

    await prisma.salesOpportunity.upsert({
      where: { leadId },
      create: {
        leadId,
        opportunityScore: finalScore,
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
        opportunityScore: finalScore,
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

    logger.info("agent_workers.scorer.done", { leadId, score: finalScore });

    return {
      output: {
        opportunityScore: finalScore,
        reasonCodes: mergedReasons,
        whyGoodTarget: analysis.why_good_target,
        likelyPainPoints: analysis.likely_pain_points,
        bestSalesAngle: analysis.best_sales_angle,
        suggestedOffer: finalOffer,
        expectedPriceBand: analysis.expected_price_band,
        personalizedFirstMessage: analysis.personalized_first_message,
      },
      costTokens: Math.ceil(JSON.stringify(analysis).length / 4),
    };
  } catch (error) {
    await prisma.lead.update({
      where: { id: leadId },
      data: { analyzeStatus: "FAILED" },
    });
    throw error;
  }
};

export const memoryWrites = (
  output: unknown,
  ctx: AgentWorkerContext,
): MemoryWrite[] => {
  if (!ctx.leadId) return [];
  const o = output as {
    opportunityScore?: number;
    bestSalesAngle?: string;
    whyGoodTarget?: string;
    likelyPainPoints?: unknown;
    suggestedOffer?: string;
    personalizedFirstMessage?: string;
  };
  if (!o) return [];

  const lines: string[] = [];
  if (typeof o.opportunityScore === "number") lines.push(`Score: ${o.opportunityScore}/100`);
  if (o.bestSalesAngle) lines.push(`Sales angle: ${o.bestSalesAngle}`);
  if (o.whyGoodTarget) lines.push(`Why: ${o.whyGoodTarget}`);
  const pains = Array.isArray(o.likelyPainPoints)
    ? (o.likelyPainPoints as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  if (pains.length) lines.push(`Pains: ${pains.slice(0, 6).join("; ")}`);
  if (o.suggestedOffer) lines.push(`Offer: ${o.suggestedOffer}`);

  const writes: MemoryWrite[] = [];
  if (lines.length > 0) {
    writes.push({
      kind: "LEAD_PROFILE",
      text: lines.join("\n"),
      leadId: ctx.leadId,
      refType: "sales_opportunity",
      refId: ctx.leadId,
      metadata: {
        opportunityScore: o.opportunityScore ?? null,
        suggestedOffer: o.suggestedOffer ?? null,
      },
    });
  }
  return writes;
};
