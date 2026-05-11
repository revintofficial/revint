/**
 * REVIEW_ANALYST worker wrapper for AI Core.
 *
 * Registry adapter over the existing `analyzeReviewsWithGemini`
 * function in `src/lib/gemini.ts` + the ReviewAnalysis upsert from
 * `src/workers/review-analysis-worker.ts`.
 *
 * The orchestrator calls this twice in the `user_deep_research`
 * chain: once for the initial ingestion-time analysis, once after
 * APIFY_GMAPS_DEEP imports 500+ reviews. Both runs write to the
 * same ReviewAnalysis row; idempotent.
 *
 * Memory writes: each pain phrase becomes a REVIEW_CHUNK row so the
 * copilot and opener writer can retrieve them semantically ("leads
 * where reviewers complain about wait times" works).
 */
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { analyzeReviewsWithGemini } from "@/lib/gemini";
import {
  filterReviewKpis,
  normalizeForGrounding,
  isGroundedInCorpus,
} from "@/lib/review-analysis/kpi-filter";
import type {
  AgentWorkerContext,
  AgentWorkerOutput,
  AgentWorkerRun,
  MemoryWrite,
} from "./types";

export const run: AgentWorkerRun = async (ctx): Promise<AgentWorkerOutput> => {
  if (!ctx.lead) throw new Error("REVIEW_ANALYST requires a lead context");
  const leadId = ctx.lead.id;

  await prisma.lead.update({
    where: { id: leadId },
    data: { reviewAnalysisStatus: "ANALYZING" },
  });

  try {
    const lead = await prisma.lead.findUniqueOrThrow({
      where: { id: leadId },
      include: {
        // `niche` is needed by the F&B label-whitelist gate in
        // analyzeReviewsWithGemini (Beta finding §3). Workspaces with
        // niche=RESTAURANT_TECH get the canonical KPI label enum
        // injected at both prompt + responseSchema layer; other
        // niches keep the legacy free-form clustering.
        workspace: { select: { offerName: true, valueProposition: true, niche: true } },
        // 220 is the Gemini KPI-bar context cap — empirically the
        // largest corpus that fits gemini-2.5-flash's input budget +
        // 32k output + thinking pass without tripping MAX_TOKENS or
        // INTERNAL context-overflow errors on F&B label-whitelist
        // schemas. APIFY_GMAPS_DEEP still ingests up to 500 reviews;
        // the trigger-detector's review-volume rule + the decision-
        // surface badge math both still see the full 500 via
        // `execute.ts` (workers) and the aggregator's own `take`.
        // Only THIS Gemini-bound path is narrowed.
        googleReviews: { orderBy: { publishTime: "desc" }, take: 220 },
      },
    });

    if (lead.googleReviews.length === 0) {
      await prisma.lead.update({
        where: { id: leadId },
        data: { reviewAnalysisStatus: "NO_REVIEWS" },
      });
      return { output: { skipped: true, reason: "no_reviews" }, costTokens: 0 };
    }

    const ourOffer = lead.workspace.valueProposition
      ? `${lead.workspace.offerName ?? "Web Sitesi Hizmeti"}: ${lead.workspace.valueProposition}`
      : null;

    const analysis = await analyzeReviewsWithGemini({
      businessName: lead.businessName,
      address: lead.formattedAddress,
      rating: lead.rating,
      reviewCount: lead.reviewCount,
      reviews: lead.googleReviews.map((r) => ({
        authorName: r.authorName,
        rating: r.rating,
        text: r.text,
        relativeTime: r.relativeTime,
      })),
      ourOffer,
      workspaceNiche: lead.workspace.niche,
    });

    // Beta findings §2/§3: filter KPIs that fall below the
    // 2-distinct-reviews threshold, drop examples that aren't grounded
    // in any actual review (Gemini sometimes paraphrases), and re-derive
    // `percent` from the true negative/positive pool size so a
    // hallucinated 50% on a 5-review sample becomes the honest 20%.
    // The same `corpusNormalized` is reused below for painPhrases
    // grounding, which keeps the AI Core path and legacy run-job
    // behaviour aligned.
    const corpusNormalized = lead.googleReviews
      .map((r) => normalizeForGrounding(r.text ?? ""))
      .filter(Boolean);
    const negativePoolCount = lead.googleReviews.filter(
      (r) => r.rating > 0 && r.rating <= 2,
    ).length;
    const positivePoolCount = lead.googleReviews.filter(
      (r) => r.rating >= 4,
    ).length;
    const weaknessFiltered = filterReviewKpis(
      analysis.weaknessKpis,
      negativePoolCount,
      corpusNormalized,
      { kind: "weakness" },
    );
    const strengthFiltered = filterReviewKpis(
      analysis.strengthKpis,
      positivePoolCount,
      corpusNormalized,
      { kind: "strength" },
    );
    logger.info("agent_workers.review_analyst.kpi_filter", {
      leadId,
      weaknessIn: weaknessFiltered.stats.inCount,
      weaknessOut: weaknessFiltered.stats.outCount,
      weaknessDroppedLowCount: weaknessFiltered.stats.droppedForLowCount,
      weaknessDroppedUngrounded: weaknessFiltered.stats.droppedForUngroundedExamples,
      weaknessDroppedPoolFloor: weaknessFiltered.stats.droppedForPoolFloor,
      weaknessDroppedCountInflation: weaknessFiltered.stats.droppedForCountInflation,
      weaknessDroppedLabelFusion: weaknessFiltered.stats.droppedForLabelFusion,
      strengthIn: strengthFiltered.stats.inCount,
      strengthOut: strengthFiltered.stats.outCount,
      strengthDroppedPoolFloor: strengthFiltered.stats.droppedForPoolFloor,
      negativePool: negativePoolCount,
      positivePool: positivePoolCount,
      reviewsAnalyzedCount: analysis.reviewsAnalyzedCount,
    });
    analysis.weaknessKpis = weaknessFiltered.kpis;
    analysis.strengthKpis = strengthFiltered.kpis;

    await prisma.reviewAnalysis.upsert({
      where: { leadId },
      create: {
        leadId,
        reviewsAnalyzedCount: analysis.reviewsAnalyzedCount,
        weaknessKpis: analysis.weaknessKpis,
        strengthKpis: analysis.strengthKpis,
        sentimentBreakdown: analysis.sentimentBreakdown,
        painPhrases: analysis.painPhrases,
        strengthPhrases: analysis.strengthPhrases,
        switchSignals: analysis.switchSignals,
        leadScore: analysis.leadScore,
        summary: analysis.summary,
      },
      update: {
        reviewsAnalyzedCount: analysis.reviewsAnalyzedCount,
        weaknessKpis: analysis.weaknessKpis,
        strengthKpis: analysis.strengthKpis,
        sentimentBreakdown: analysis.sentimentBreakdown,
        painPhrases: analysis.painPhrases,
        strengthPhrases: analysis.strengthPhrases,
        switchSignals: analysis.switchSignals,
        leadScore: analysis.leadScore,
        summary: analysis.summary,
        analyzedAt: new Date(),
      },
    });

    await prisma.lead.update({
      where: { id: leadId },
      data: { reviewAnalysisStatus: "ANALYZED" },
    });

    logger.info("agent_workers.review_analyst.done", {
      leadId,
      leadScore: analysis.leadScore,
    });

    // Ground the pain/strength phrases against the source review
    // text. Gemini occasionally paraphrases or invents phrases that
    // don't appear in any review, and poisoned memory is worse than
    // missing memory (OPENER_WRITER then uses the fabricated phrase
    // in cold outreach). We normalize both sides (lowercase, strip
    // punctuation, collapse whitespace) and require at least 3
    // consecutive words of the phrase to appear in at least one
    // review. Phrases that fail are dropped from memoryWrites with a
    // log line; the ReviewAnalysis row still holds the raw Gemini
    // output because the UI shows them separately.
    //
    // (The same `corpusNormalized` already drives KPI example
    // grounding above; we reuse the captured list rather than
    // recomputing it.)
    const painsGrounded = (analysis.painPhrases as unknown[])
      .filter((x): x is string => typeof x === "string")
      .filter((p) => isGroundedInCorpus(p, corpusNormalized));
    const strengthsGrounded = (analysis.strengthPhrases as unknown[])
      .filter((x): x is string => typeof x === "string")
      .filter((p) => isGroundedInCorpus(p, corpusNormalized));

    logger.info("agent_workers.review_analyst.grounding", {
      leadId,
      painTotal: (analysis.painPhrases ?? []).length,
      painGrounded: painsGrounded.length,
      strengthTotal: (analysis.strengthPhrases ?? []).length,
      strengthGrounded: strengthsGrounded.length,
    });

    return {
      output: {
        leadScore: analysis.leadScore,
        // The *grounded* arrays are what flows into memoryWrites; the
        // UI-facing ReviewAnalysis row still carries raw Gemini data.
        painPhrases: painsGrounded,
        strengthPhrases: strengthsGrounded,
        summary: analysis.summary,
        reviewsAnalyzedCount: analysis.reviewsAnalyzedCount,
      },
      costTokens: Math.ceil(JSON.stringify(analysis).length / 4),
    };
  } catch (error) {
    await prisma.lead.update({
      where: { id: leadId },
      data: { reviewAnalysisStatus: "FAILED" },
    });
    const msg = error instanceof Error ? error.message : String(error);
    // The no-reviews path above is preserved (early return before the
    // Gemini call). This catch handles the actual failure modes:
    // Gemini timeouts, JSON-parse failures, or upstream API errors.
    // Per Bug #5 in research/finedine/discovery-bugs.md, returning a
    // skipped output keeps `review` SKIPPED-but-optional in the
    // orchestrator instead of hardFailing the chain. The
    // ReviewAnalysis row stays unwritten; the lead surfaces
    // reviewAnalysisStatus=FAILED in the UI.
    //
    // The April-26 beta diagnostic showed REVIEW_ANALYST's dominant
    // failure bucket today is the post-worker embedding step, not
    // Gemini analysis itself — that's handled at the executor layer
    // (see persistMemoryWrites). No bucket here warrants a
    // RetryableError carve-out today; if a future diagnostic surfaces
    // genuine Gemini 429/5xx clusters worth retrying, wrap them
    // before this catch with `if (/429|503/.test(msg)) throw new
    // RetryableError(msg)`.
    logger.warn("agent_workers.review_analyst.failed_skipping", {
      leadId,
      err: msg,
    });
    return {
      output: { skipped: true, reason: "analysis_failed", errorMsg: msg },
      costTokens: 0,
    };
  }
};

export const memoryWrites = (
  output: unknown,
  ctx: AgentWorkerContext,
): MemoryWrite[] => {
  if (!ctx.leadId) return [];
  const o = output as {
    skipped?: boolean;
    painPhrases?: unknown;
    strengthPhrases?: unknown;
    summary?: string;
    leadScore?: number;
  };
  // Skipped runs (no reviews / Gemini failure / embedding fallback)
  // have no grounded phrases to embed; emitting empty REVIEW_CHUNK
  // rows would just be noise in semantic search.
  if (o.skipped) return [];
  const writes: MemoryWrite[] = [];

  if (o.summary && typeof o.summary === "string") {
    writes.push({
      kind: "REVIEW_CHUNK",
      text: `Review summary: ${o.summary}`,
      leadId: ctx.leadId,
      refType: "review_summary",
      refId: ctx.leadId,
      metadata: { leadScore: o.leadScore ?? null, source: "review_analyst" },
    });
  }

  const pains = Array.isArray(o.painPhrases)
    ? (o.painPhrases as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  pains.slice(0, 8).forEach((phrase, i) => {
    writes.push({
      kind: "REVIEW_CHUNK",
      text: phrase,
      leadId: ctx.leadId,
      refType: "pain_phrase",
      refId: `${ctx.leadId}:pain:${i}`,
      metadata: { polarity: "negative", source: "review_analyst" },
    });
  });

  const strengths = Array.isArray(o.strengthPhrases)
    ? (o.strengthPhrases as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  strengths.slice(0, 6).forEach((phrase, i) => {
    writes.push({
      kind: "REVIEW_CHUNK",
      text: phrase,
      leadId: ctx.leadId,
      refType: "strength_phrase",
      refId: `${ctx.leadId}:strength:${i}`,
      metadata: { polarity: "positive", source: "review_analyst" },
    });
  });

  return writes;
};
