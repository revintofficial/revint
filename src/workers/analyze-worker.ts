import { Worker, type Job } from "bullmq";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { analyzeLeadWithGemini } from "../lib/gemini";
import {
  calculateDeterministicScore,
  suggestOffer,
  estimatePriceBand,
} from "../lib/scoring";
import type { WebsiteFeatures } from "../types";
import IORedis from "ioredis";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

interface AnalyzeJobData {
  leadId: string;
}

async function processAnalyze(job: Job<AnalyzeJobData>) {
  const { leadId } = job.data;

  console.log(`[Analyze] Starting lead: ${leadId}`);

  await prisma.lead.update({
    where: { id: leadId },
    data: { analyzeStatus: "ANALYZING" },
  });

  try {
    const lead = await prisma.lead.findUniqueOrThrow({
      where: { id: leadId },
      include: {
        websiteAudit: true,
        // P2.3 - read workspace.language so AI analysis answers in the right language.
        workspace: { select: { language: true } },
      },
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
        features,
        lead.workspace.language ?? "tr",
      );
    } catch (aiError) {
      console.warn(`[Analyze] Gemini failed for ${leadId}, using deterministic only:`, aiError);
      const offer = suggestOffer(deterministicScore, reasons);
      analysis = {
        opportunity_score: deterministicScore,
        reason_codes: reasons,
        why_good_target: "AI analiz yapilamadi. Deterministik skor kullanildi.",
        likely_pain_points: reasons.map(reasonToTurkish),
        best_sales_angle: "Dijital varliklarini guclendirebilecekleri bir teklif sunun.",
        suggested_offer: offer,
        personalized_first_message: `Merhaba, ${lead.businessName} icin profesyonel bir web sitesi olusturmak ister misiniz?`,
        expected_price_band: estimatePriceBand(offer),
      };
    }

    const finalScore = Math.round(
      deterministicScore * 0.4 + analysis.opportunity_score * 0.6
    );

    const mergedReasons = [
      ...new Set([...reasons, ...analysis.reason_codes]),
    ];

    const finalOffer =
      analysis.suggested_offer || suggestOffer(finalScore, mergedReasons);

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

    console.log(`[Analyze] Done: ${lead.businessName} (score: ${finalScore})`);
    return { leadId, score: finalScore };
  } catch (error) {
    await prisma.lead.update({
      where: { id: leadId },
      data: { analyzeStatus: "FAILED" },
    });
    throw error;
  }
}

function reasonToTurkish(code: string): string {
  const map: Record<string, string> = {
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
  return map[code] || code;
}

export function startAnalyzeWorker() {
  const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });

  const worker = new Worker<AnalyzeJobData>("analyze", processAnalyze, {
    connection,
    concurrency: 5,
    limiter: { max: 20, duration: 60000 },
  });

  worker.on("completed", (job) => {
    console.log(`[Analyze] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Analyze] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
