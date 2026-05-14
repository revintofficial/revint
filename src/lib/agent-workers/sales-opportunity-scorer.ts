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
import {
  analyzeLeadWithGemini,
  type AnalysisActiveCampaign,
  type ReviewContextForAnalysis,
} from "@/lib/gemini";
import { calculateDeterministicScore } from "@/lib/scoring";
import { selectPackage } from "./package-selector";
import type { WebsiteFeatures } from "@/types";
import type {
  AgentWorkerContext,
  AgentWorkerOutput,
  AgentWorkerRun,
  MemoryWrite,
} from "./types";

/**
 * Loose case-insensitive match between a lead's niche slugs and a
 * workspace's target / campaign niche tag. We compare both child
 * slug and parent slug because reps often filter by parent ("fnb")
 * while leads land with a child slug ("fnb-bar-club"), and vice
 * versa.
 */
function matchesNiche(
  lead: { nicheSlug: string | null; subNicheSlug: string | null },
  candidate: string | null,
): boolean {
  if (!candidate) return false;
  const c = candidate.toLowerCase().trim();
  if (!c) return false;
  const a = (lead.subNicheSlug ?? "").toLowerCase();
  const b = (lead.nicheSlug ?? "").toLowerCase();
  if (!a && !b) return false;
  // Direct match either way.
  if (a === c || b === c) return true;
  // Hierarchy match — e.g. campaign tag "fnb" should match lead
  // sub-niche "fnb-bar-club", and campaign tag "fnb-bar-club"
  // should match a lead whose parent niche is "fnb" only when
  // the parent is identical to the campaign root.
  if (a && (a.startsWith(`${c}-`) || c.startsWith(`${a}-`))) return true;
  if (b && (b.startsWith(`${c}-`) || c.startsWith(`${b}-`))) return true;
  return false;
}

/**
 * Deterministic ICP-fit adjustment — sits next to the prompt-level
 * rule so a misbehaving Gemini output cannot drop the signal. Returns
 * the bonus/penalty + the reason code that callers should merge into
 * `reason_codes`.
 *
 * Bonus  : +5  when the lead matches an active campaign niche OR is
 *              in `targetSubNiches`.
 * Penalty: -8  when `targetSubNiches` is non-empty AND the lead is
 *              outside it (and no campaign matches it either).
 * Neutral:  0  when targetSubNiches is empty AND no campaign matches.
 */
function computeIcpFitAdjustment(
  lead: { nicheSlug: string | null; subNicheSlug: string | null },
  targetSubNiches: string[],
  activeCampaigns: AnalysisActiveCampaign[],
): { delta: number; code: "icp_fit" | "outside_icp" | null; matchedCampaignId: string | null } {
  const matchedCampaign = activeCampaigns.find((c) => matchesNiche(lead, c.niche));
  const inTargetList =
    targetSubNiches.length > 0 &&
    targetSubNiches.some((slug) => matchesNiche(lead, slug));

  if (matchedCampaign || inTargetList) {
    return {
      delta: +5,
      code: "icp_fit",
      matchedCampaignId: matchedCampaign?.id ?? null,
    };
  }
  if (targetSubNiches.length > 0) {
    return { delta: -8, code: "outside_icp", matchedCampaignId: null };
  }
  return { delta: 0, code: null, matchedCampaignId: null };
}

/**
 * Idempotency window. A scorer run costs ~1 Gemini call which is the
 * single most expensive worker we ship; re-running it within minutes
 * of a fresh result (e.g. user clicks "pitch pack" twice in a row)
 * burns budget for no signal change. We treat any row written within
 * the last 24h as authoritative unless the caller passes
 * `inputs.force = true` (manual "Re-score" button).
 *
 * The window is intentionally generous because the scorer's inputs
 * (audit, review analysis, workspace targetSubNiches) change at most
 * daily — a re-run inside 24h almost never produces a different
 * score, and when it does the rep can hit Re-score manually.
 *
 * The 24h check is bypassed automatically when the upstream signal
 * actually changed: `lead_reviews_updated` and `user_deep_research`
 * chains pass `force: true` in their step inputs so a fresh review
 * corpus re-scores instantly.
 */
const SCORER_TTL_MS = 24 * 60 * 60 * 1000;

export const run: AgentWorkerRun = async (ctx): Promise<AgentWorkerOutput> => {
  if (!ctx.lead) throw new Error("SALES_OPPORTUNITY_SCORER requires a lead context");
  const leadId = ctx.lead.id;

  // Idempotency gate: short-circuit when we already have a fresh
  // SalesOpportunity row and the caller didn't ask for a force
  // refresh. Returning the persisted row keeps the chain DAG happy
  // (downstream `mockup` step still has its sales-opportunity
  // inputs) without paying for another Gemini round-trip.
  const force = (ctx.runInputs?.force as boolean | undefined) === true;
  if (!force) {
    const existing = await prisma.salesOpportunity.findUnique({
      where: { leadId },
      select: {
        updatedAt: true,
        opportunityScore: true,
        reasonCodes: true,
        whyGoodTarget: true,
        likelyPainPoints: true,
        bestSalesAngle: true,
        personalizedFirstMessage: true,
        recommendedPackageId: true,
        recommendedPackageReason: true,
      },
    });
    const ageMs = existing
      ? Date.now() - existing.updatedAt.getTime()
      : Number.POSITIVE_INFINITY;
    if (existing && ageMs < SCORER_TTL_MS) {
      logger.info("agent_workers.scorer.idempotent_skip", {
        leadId,
        ageMs,
        score: existing.opportunityScore,
      });
      // Ensure the lead row is in the consistent post-analyze state
      // even though we didn't run Gemini — older versions may have
      // landed on ANALYZING / FAILED while the row already existed.
      await prisma.lead.updateMany({
        where: { id: leadId, workspaceId: ctx.workspaceId },
        data: { analyzeStatus: "ANALYZED" },
      });
      return {
        output: {
          opportunityScore: existing.opportunityScore,
          reasonCodes: existing.reasonCodes as unknown as string[],
          whyGoodTarget: existing.whyGoodTarget,
          likelyPainPoints: existing.likelyPainPoints as unknown as string[],
          bestSalesAngle: existing.bestSalesAngle,
          personalizedFirstMessage: existing.personalizedFirstMessage,
          recommendedPackageId: existing.recommendedPackageId,
          recommendedPackageReason: existing.recommendedPackageReason,
          icpFit: { delta: 0, code: null, matchedCampaignId: null },
          cached: true,
        },
        costTokens: 0,
      };
    }
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: { analyzeStatus: "ANALYZING" },
  });

  try {
    const lead = await prisma.lead.findUniqueOrThrow({
      where: { id: leadId },
      include: { websiteAudit: true, reviewAnalysis: true },
    });
    const features = lead.websiteAudit?.rawFeaturesJson as unknown as WebsiteFeatures | null;

    const { score: deterministicScore, reasons } = calculateDeterministicScore(
      lead.hasWebsite,
      lead.rating,
      lead.reviewCount,
      features,
    );

    // Build the grounded review context for Gemini. ReviewAnalysis
    // arrays are stored as JSON on Postgres, so coerce them to
    // string[] defensively. Empty arrays + null summary are
    // tolerated downstream and trigger the "no review data" branch
    // in the prompt builder.
    const ra = lead.reviewAnalysis;
    const reviewContext: ReviewContextForAnalysis | null = ra
      ? {
          summary: ra.summary ?? null,
          painPhrases: Array.isArray(ra.painPhrases)
            ? (ra.painPhrases as unknown[]).filter(
                (x): x is string => typeof x === "string",
              )
            : [],
          strengthPhrases: Array.isArray(ra.strengthPhrases)
            ? (ra.strengthPhrases as unknown[]).filter(
                (x): x is string => typeof x === "string",
              )
            : [],
          reviewsAnalyzedCount: ra.reviewsAnalyzedCount ?? 0,
        }
      : null;

    // When Gemini fails we must NOT silently substitute a fake "AI
    // analysis" with canned copy - that fake analysis then flows into
    // SalesOpportunity, UI surfaces, memory writes, and downstream
    // workers (OPENER_WRITER reads bestSalesAngle + painPoints) as if
    // it were real. Instead, the run fails, the pipeline records the
    // failure, and the existing SalesOpportunity row (if any) stays
    // intact. The deterministic score is logged for observability.
    // Confidence gate (P0.4): below 0.7 from an AUTO classification we
    // pass `subNicheSlug = null` so the prompt falls back to the parent
    // F&B framing instead of writing "we'll set up your <wrong-vertical>"
    // claims. MANUAL overrides skip the gate (rep is gold-standard) by
    // sending confidence 1.0 regardless of the stored value.
    const subNicheTrusted =
      lead.subNicheSlug != null &&
      (lead.subNicheSource === "MANUAL" ||
        (lead.subNicheConfidence ?? 0) >= 0.7);
    const effectiveSubNiche = subNicheTrusted ? lead.subNicheSlug : null;
    const effectiveSubNicheConfidence = subNicheTrusted
      ? lead.subNicheSource === "MANUAL"
        ? 1.0
        : lead.subNicheConfidence ?? null
      : null;

    // Pre-load the workspace's priced tiers so Gemini can pick a
    // package_id from the rep's actual price card instead of inventing
    // generic STARTER/GROWTH/SALES copy. Empty list -> prompt falls
    // back to the legacy enum, so non-FineDine tenants stay unaffected.
    // Also load the workspace's full personalization context (target
    // sub-niches) and the live sales campaigns (Sequences) so the
    // analyst can reward leads that fit what THIS team actually sells
    // and is currently running outbound for.
    const [servicePackages, workspaceFull, activeSequences] = await Promise.all([
      prisma.servicePackage.findMany({
        where: { workspaceId: ctx.workspace.id },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          priceLabel: true,
          features: true,
          isPopular: true,
        },
      }),
      prisma.workspace.findUnique({
        where: { id: ctx.workspace.id },
        select: { targetSubNiches: true },
      }),
      prisma.sequence.findMany({
        where: { workspaceId: ctx.workspace.id, archivedAt: null },
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: { id: true, name: true, niche: true, description: true },
      }),
    ]);

    const targetSubNiches = workspaceFull?.targetSubNiches ?? [];
    const activeCampaigns: AnalysisActiveCampaign[] = activeSequences.map((s) => ({
      id: s.id,
      name: s.name,
      niche: s.niche ?? null,
      description: s.description ?? null,
    }));

    const analysis = await analyzeLeadWithGemini(
      lead.businessName,
      lead.formattedAddress,
      lead.rating,
      lead.reviewCount,
      lead.websiteUrl,
      features,
      ctx.workspace.language ?? "en",
      {
        niche: ctx.workspace.niche ?? null,
        offerName: ctx.workspace.offerName ?? null,
        valueProposition: ctx.workspace.valueProposition ?? null,
        language: ctx.workspace.language ?? null,
        subNicheSlug: effectiveSubNiche,
        subNicheConfidence: effectiveSubNicheConfidence,
        servicePackages,
        // Personalization signals — see `AnalysisWorkspaceContext`.
        objective: ctx.workspace.objective ?? null,
        tone: ctx.workspace.tone ?? null,
        offerHook: ctx.workspace.offerHook ?? null,
        socialProof: ctx.workspace.socialProof ?? null,
        senderName: ctx.workspace.senderName ?? null,
        targetSubNiches,
        activeCampaigns,
      },
      reviewContext,
    );

    // Deterministic ICP-fit adjustment. Sits next to the prompt-level
    // rule so reps see the same bonus/penalty regardless of Gemini's
    // mood. Applied to the BLENDED final score (after the 0.4/0.6
    // blend) and merged into reason_codes so the UI can render a
    // chip ("ICP fit" / "Outside ICP") off a single signal.
    const icpAdjustment = computeIcpFitAdjustment(
      { nicheSlug: lead.nicheSlug, subNicheSlug: lead.subNicheSlug },
      targetSubNiches,
      activeCampaigns,
    );

    // Beta finding §4 — DETERMINISTIC package selection.
    //
    // Tier id no longer comes from Gemini; we compute it from the
    // lead's structural signals via `selectPackage()`. The reasons:
    //   - removes the popular-tier anchor bias surfaced in beta
    //     (Gemini converged on `isPopular` ~60% of the time);
    //   - guarantees reproducibility — two reps looking at the same
    //     lead see the same tier;
    //   - lets us unit-test the boundary cases without mocking Gemini.
    //
    // Inputs:
    //   - isHotel: derived from sub-niche slug or Places primaryType.
    //     The `fnb-hotel-restaurant` slug is the trusted signal; a
    //     primaryType of "lodging" / containing "hotel" is the
    //     fallback when classification hasn't run yet.
    //   - hasMultipleLocations: derived from Gemini's `chain_detected`
    //     reason code. We trust Gemini's pattern recognition here
    //     because chain status comes from website / business-name
    //     analysis the model already does, but we bound the impact
    //     by capping it at the tier choice (it cannot move the
    //     opportunity_score directly).
    //   - painPointCount: post-filter `likely_pain_points` length.
    const isHotelByNiche = lead.subNicheSlug === "fnb-hotel-restaurant";
    const primaryTypeLc = (lead.primaryType ?? "").toLowerCase();
    const isHotelByPrimaryType =
      primaryTypeLc.includes("hotel") || primaryTypeLc === "lodging";
    const hasMultipleLocations = analysis.reason_codes.some(
      (c) => typeof c === "string" && /chain_detected/i.test(c),
    );
    const painPointCount = Array.isArray(analysis.likely_pain_points)
      ? analysis.likely_pain_points.length
      : 0;
    const packageSelection = selectPackage({
      reviewCount: lead.reviewCount ?? 0,
      rating: lead.rating ?? 0,
      hasMultipleLocations,
      isHotel: isHotelByNiche || isHotelByPrimaryType,
      // Prisma findMany already sorted by sortOrder ASC, so we hand
      // the selector the position-indexed sortOrder it expects: idx 0
      // is the cheapest tier (base), idx 1 is premium, idx 2 is
      // enterprise. Workspaces with fewer than 3 packages reuse the
      // last entry inside the selector.
      servicePackages: servicePackages.map((p, idx) => ({
        id: p.id,
        name: p.name,
        sortOrder: idx,
      })),
      painPointCount,
    });
    const sortedById = new Map(servicePackages.map((p) => [p.id, p]));
    const recommendedPackageId = packageSelection.id ?? null;
    // Keep Gemini's prose reason when the deterministic tier was
    // picked. The prompt no longer asks for `recommended_package_id`
    // (we silently ignore it if the model still returns one for
    // backwards compatibility), but `recommended_package_reason` is
    // still produced and surfaces verbatim in the UI.
    const geminiReason =
      typeof analysis.recommended_package_reason === "string"
        ? analysis.recommended_package_reason.slice(0, 600)
        : null;
    const recommendedPackageReason = recommendedPackageId ? geminiReason : null;
    if (recommendedPackageId) {
      logger.info("agent_workers.scorer.package_selected", {
        leadId,
        packageId: recommendedPackageId,
        packageName: sortedById.get(recommendedPackageId)?.name ?? null,
        tier: packageSelection.tier,
        reason: packageSelection.reason,
        painPointCount,
        hasMultipleLocations,
        isHotel: isHotelByNiche || isHotelByPrimaryType,
        reviewCount: lead.reviewCount ?? 0,
      });
    }

    const blendedScore = Math.round(
      deterministicScore * 0.4 + analysis.opportunity_score * 0.6,
    );
    // Apply the deterministic ICP-fit delta on top of the blend, then
    // clamp to [0, 100]. Gemini may also have applied its own bonus
    // via the prompt rule — that double-counts intentionally, since
    // it represents "the analyst chose this lead because it fits the
    // ICP" PLUS "math says it does", which is the exact intent.
    const finalScore = Math.max(
      0,
      Math.min(100, blendedScore + icpAdjustment.delta),
    );
    const mergedReasons = Array.from(
      new Set([
        ...reasons,
        ...analysis.reason_codes,
        ...(icpAdjustment.code ? [icpAdjustment.code] : []),
      ]),
    );

    // suggestedOffer + expectedPriceBand are deprecated (P0.4). The
    // dossier owns the package recommendation now; the column survives
    // for legacy data but the write path leaves it at the schema
    // default (STARTER) on first create and untouched on update so we
    // can't accidentally pin a stale tier on a re-analyze.
    await prisma.salesOpportunity.upsert({
      where: { leadId },
      create: {
        leadId,
        opportunityScore: finalScore,
        reasonCodes: mergedReasons,
        whyGoodTarget: analysis.why_good_target,
        likelyPainPoints: analysis.likely_pain_points,
        bestSalesAngle: analysis.best_sales_angle,
        personalizedFirstMessage: analysis.personalized_first_message,
        recommendedPackageId,
        recommendedPackageReason,
        status: "NEW",
      },
      update: {
        opportunityScore: finalScore,
        reasonCodes: mergedReasons,
        whyGoodTarget: analysis.why_good_target,
        likelyPainPoints: analysis.likely_pain_points,
        bestSalesAngle: analysis.best_sales_angle,
        personalizedFirstMessage: analysis.personalized_first_message,
        recommendedPackageId,
        recommendedPackageReason,
      },
    });

    await prisma.lead.update({
      where: { id: leadId },
      data: { analyzeStatus: "ANALYZED" },
    });

    logger.info("agent_workers.scorer.done", {
      leadId,
      score: finalScore,
      blendedScore,
      icpDelta: icpAdjustment.delta,
      icpCode: icpAdjustment.code,
      matchedCampaignId: icpAdjustment.matchedCampaignId,
    });

    return {
      output: {
        opportunityScore: finalScore,
        reasonCodes: mergedReasons,
        whyGoodTarget: analysis.why_good_target,
        likelyPainPoints: analysis.likely_pain_points,
        bestSalesAngle: analysis.best_sales_angle,
        personalizedFirstMessage: analysis.personalized_first_message,
        recommendedPackageId,
        recommendedPackageReason,
        // Surface ICP fit so the UI can render "Enroll in <campaign>"
        // and the leads list can filter on icp_fit / outside_icp.
        icpFit: {
          delta: icpAdjustment.delta,
          code: icpAdjustment.code,
          matchedCampaignId: icpAdjustment.matchedCampaignId,
        },
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

/**
 * SALES_OPPORTUNITY_SCORER intentionally does NOT produce a
 * LEAD_PROFILE memory write: the `embedLeadProfile` sentinel runs at
 * the tail of both `lead_created` and `user_deep_research` chains and
 * writes a richer profile (with review + audit context) keyed on
 * `refType: "lead", refId: leadId`. A second scorer-emitted write
 * keyed on `refType: "sales_opportunity"` would not collide at the
 * DB level but would surface two LEAD_PROFILE rows for the same lead
 * in retrieval (memory.ts query returns both), poisoning few-shot
 * slots with an older + newer version of the same lead. Keeping the
 * sentinel as the single writer is the correct invariant.
 */
export const memoryWrites = (
  _output: unknown,
  _ctx: AgentWorkerContext,
): MemoryWrite[] => [];
