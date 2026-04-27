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
import { checkRateLimit, LIMITS, rateLimitResponse } from "@/lib/ratelimit";
import { getAnalyzeQueue } from "@/lib/queues";
import { logger } from "@/lib/logger";

// Single-lead path calls Gemini inline (can take 10-30s on cold start).
// Bulk path just enqueues, but we keep the same config so cold starts don't
// get truncated by the Hobby tier's 10s default.
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { workspaceId } = await requireUser();

    const rl = await checkRateLimit(workspaceId, LIMITS.analyze);
    if (!rl.ok) return rateLimitResponse(rl);

    const body = await request.json();
    const { leadId, analyzeAll = false } = body;

    // Bulk analyze moved to the worker queue. Previously ran up to 50
    // Gemini calls sequentially inside one HTTP request.
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
        select: { id: true },
        take: 200,
      });

      const queue = getAnalyzeQueue();
      let enqueued = 0;
      for (const lead of pendingLeads) {
        await queue.add(
          "analyze",
          { leadId: lead.id, workspaceId },
          { removeOnComplete: 100, removeOnFail: 50, attempts: 2 },
        );
        enqueued++;
      }
      return NextResponse.json(
        { success: true, enqueued, total: pendingLeads.length },
        { status: 202 },
      );
    }

    if (!leadId) {
      return NextResponse.json({ error: "leadId is required" }, { status: 400 });
    }

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, workspaceId },
      select: { id: true },
    });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    await assertCanUseAi(workspaceId, 1);
    const result = await analyzeSingleLead(workspaceId, leadId);
    await recordAiUsed(workspaceId, 1);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof QuotaExceededError) {
      return error.toResponse();
    }
    logger.error("api.analyze.error", { err: error });
    return NextResponse.json(
      { error: "Analysis failed", details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Always scope reads and writes by workspaceId so this helper stays safe
 * when called from worker code or future bulk paths. A stray caller that
 * passed only `leadId` previously could write across tenants.
 */
async function analyzeSingleLead(workspaceId: string, leadId: string) {
  await prisma.lead.updateMany({
    where: { id: leadId, workspaceId },
    data: { analyzeStatus: "ANALYZING" },
  });

  try {
    const lead = await prisma.lead.findFirstOrThrow({
      where: { id: leadId, workspaceId },
      include: {
        websiteAudit: true,
        workspace: {
          select: {
            niche: true,
            offerName: true,
            valueProposition: true,
            language: true,
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
      // Confidence gate (P0.4): pass the child sub-niche only when
      // MANUAL or classifier confidence ≥ 0.7. Below that we fall
      // back to the parent niche so a low-confidence misclass doesn't
      // drive a wrong-vertical pitch through this legacy path either.
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
      logger.warn("api.analyze.gemini_fallback", { leadId, err: aiError });
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

    // Scope the upsert by leadId + workspace via a two-step pattern: check
    // the lead belongs to this workspace, then upsert. Prisma's upsert
    // doesn't support compound scope in `where` when the target column has
    // a unique constraint on leadId alone.
    const owned = await prisma.lead.findFirst({
      where: { id: leadId, workspaceId },
      select: { id: true },
    });
    if (!owned) {
      throw new Error("Lead not found in workspace");
    }

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

    await prisma.lead.updateMany({
      where: { id: leadId, workspaceId },
      data: { analyzeStatus: "ANALYZED" },
    });

    return { score: finalScore, offer: finalOffer };
  } catch (error) {
    await prisma.lead.updateMany({
      where: { id: leadId, workspaceId },
      data: { analyzeStatus: "FAILED" },
    });
    throw error;
  }
}
