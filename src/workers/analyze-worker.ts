import { Worker, type Job } from "bullmq";
import { analyzeLeadWithGemini } from "../lib/gemini";
import { calculateDeterministicScore } from "../lib/scoring";
import type { WebsiteFeatures } from "../types";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { notifyHotLead } from "../lib/email/notifications";
import { pingIndexNowForLead } from "../lib/seo/indexnow";
import IORedis from "ioredis";

interface AnalyzeJobData {
  leadId: string;
}

async function processAnalyze(job: Job<AnalyzeJobData>) {
  const { leadId } = job.data;

  logger.info("worker.analyze.starting", { leadId });

  await prisma.lead.update({
    where: { id: leadId },
    data: { analyzeStatus: "ANALYZING" },
  });

  try {
    const lead = await prisma.lead.findUniqueOrThrow({
      where: { id: leadId },
      include: {
        websiteAudit: true,
        workspace: {
          select: {
            language: true,
            niche: true,
            offerName: true,
            valueProposition: true,
          },
        },
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
      // Confidence gate (P0.4): only pass the child sub-niche slug to
      // Gemini when the classifier was confident enough (≥0.7) or the
      // rep manually overrode the slug. Below that we fall back to the
      // parent F&B framing so a low-confidence misclass doesn't ship a
      // wrong-vertical pitch.
      const subNicheTrusted =
        lead.subNicheSlug != null &&
        (lead.subNicheSource === "MANUAL" ||
          (lead.subNicheConfidence ?? 0) >= 0.7);

      analysis = await analyzeLeadWithGemini(
        lead.businessName,
        lead.formattedAddress,
        lead.rating,
        lead.reviewCount,
        lead.websiteUrl,
        features,
        lead.workspace.language ?? "en",
        {
          niche: lead.workspace.niche,
          offerName: lead.workspace.offerName,
          valueProposition: lead.workspace.valueProposition,
          language: lead.workspace.language,
          subNicheSlug: subNicheTrusted ? lead.subNicheSlug : null,
          subNicheConfidence: subNicheTrusted
            ? lead.subNicheSource === "MANUAL"
              ? 1.0
              : lead.subNicheConfidence ?? null
            : null,
        },
      );
    } catch (aiError) {
      logger.warn("worker.analyze.gemini_failed", { leadId, err: aiError });
      // Hard-coded STARTER/GROWTH/SALES is gone (P0.4). The legacy
      // worker still produces a deterministic-only fallback so the
      // standalone /api/analyze entry point keeps working, but the
      // package recommendation is left blank — the dossier (or the
      // workspace owner) fills it in.
      analysis = {
        opportunity_score: deterministicScore,
        reason_codes: reasons,
        why_good_target: "AI analysis was unavailable; falling back to the deterministic score.",
        likely_pain_points: reasons.map(reasonToEnglish),
        best_sales_angle: "Offer to strengthen their digital presence where the deterministic signals are weakest.",
        personalized_first_message: `Hi ${lead.businessName} team - would you be open to a quick look at a modern website concept we put together for a business like yours?`,
      };
    }

    const finalScore = Math.round(
      deterministicScore * 0.4 + analysis.opportunity_score * 0.6
    );

    const mergedReasons = [
      ...new Set([...reasons, ...analysis.reason_codes]),
    ];

    await prisma.salesOpportunity.upsert({
      where: { leadId },
      create: {
        leadId,
        opportunityScore: Math.min(finalScore, 100),
        reasonCodes: mergedReasons,
        whyGoodTarget: analysis.why_good_target,
        likelyPainPoints: analysis.likely_pain_points,
        bestSalesAngle: analysis.best_sales_angle,
        personalizedFirstMessage: analysis.personalized_first_message,
        status: "NEW",
      },
      update: {
        opportunityScore: Math.min(finalScore, 100),
        reasonCodes: mergedReasons,
        whyGoodTarget: analysis.why_good_target,
        likelyPainPoints: analysis.likely_pain_points,
        bestSalesAngle: analysis.best_sales_angle,
        personalizedFirstMessage: analysis.personalized_first_message,
      },
    });

    await prisma.lead.update({
      where: { id: leadId },
      data: { analyzeStatus: "ANALYZED" },
    });

    // Fire hot-lead alert. Cooldowns are enforced in the notifier so a bulk
    // discovery run doesn't email the owner once per lead. Failures are
    // swallowed via sendEmailAsync — analyze pipeline must not be blocked.
    try {
      await notifyHotLead({
        workspaceId: lead.workspaceId,
        leadId,
        businessName: lead.businessName,
        score: Math.min(finalScore, 100),
        city: lead.borough ?? null,
        reasonSummary: mergedReasons.slice(0, 3).map(reasonToEnglish).join(", ") || null,
      });
    } catch (notifyErr) {
      logger.warn("worker.analyze.notify_failed", { leadId, err: notifyErr });
    }

    // Enterprise SEO: push the new /b/{city}/{business} URL (plus parent
    // city/niche hubs) to IndexNow so Bing and Yandex reindex within
    // minutes. Fire-and-forget, gated inside the helper on the public
    // profile flag + evidence floor.
    void pingIndexNowForLead(leadId);

    logger.info("worker.analyze.done", {
      leadId,
      businessName: lead.businessName,
      score: finalScore,
    });
    return { leadId, score: finalScore };
  } catch (error) {
    await prisma.lead.update({
      where: { id: leadId },
      data: { analyzeStatus: "FAILED" },
    });
    throw error;
  }
}

function reasonToEnglish(code: string): string {
  const map: Record<string, string> = {
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
    logger.info("worker.analyze.job_completed", { jobId: job.id });
  });

  worker.on("failed", (job, err) => {
    logger.error("worker.analyze.job_failed", { jobId: job?.id, err });
  });

  return worker;
}
