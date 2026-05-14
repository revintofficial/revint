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
import type { Prisma } from "@/generated/prisma/client";
import { analyzeReviewsWithGemini } from "@/lib/gemini";
import {
  filterReviewKpis,
  normalizeForGrounding,
  isGroundedInCorpus,
} from "@/lib/review-analysis/kpi-filter";
import {
  normalizeSeverity,
  type SwitchDirection,
  type SwitchSignal,
} from "@/lib/sdr-brain/contracts";
import { isTruthLayerFlagEnabled } from "@/lib/feature-flags";
import type {
  AgentWorkerContext,
  AgentWorkerOutput,
  AgentWorkerRun,
  MemoryWrite,
} from "./types";

/**
 * Truth Layer v1 (T-C Evidence Calibration) — typed extensions to the
 * persisted KPI shape. Each KPI now carries a `severity` (0..100,
 * base-rate-normalised when `TRUTH_LAYER_SEVERITY_V2` is on) and a
 * `percentBase` discriminator so T-G's UI can render either
 * "% of negative reviews" or "% of total reviews" without re-doing
 * the math at read time.
 *
 * `percentBase` defaults to `"negative_reviews"` for weakness KPIs and
 * `"negative_reviews"` for strength KPIs too — the legacy denominator
 * choice is preserved so existing dashboards keep matching pre-Truth-
 * Layer numbers. T-G's UI flip toggles individual rows; the writer
 * only stamps the default.
 */
type EnrichedReviewKpi = {
  label: string;
  count: number;
  percent: number;
  examples: string[];
  /** 0..100 severity from `normalizeSeverity` (or legacy `percent` when flag is off). */
  severity: number;
  /**
   * Which denominator the `percent` was computed against. T-G UI ride-along
   * (master plan §5): `"negative_reviews"` is the legacy default;
   * `"total_reviews"` is the alternate frame.
   */
  percentBase: "negative_reviews" | "total_reviews";
};

/**
 * Legacy severity formula — used when `TRUTH_LAYER_SEVERITY_V2` is off.
 * Pre-Truth-Layer the writer effectively used `percent` as the severity
 * proxy (i.e. raw share of the negative pool, no base-rate adjustment),
 * which over-stated severity on high-traffic operators with a small
 * concentrated negative pool. We preserve it here as a private function
 * so the flag-off branch is a pure fallback to historical behaviour.
 *
 * Bounds clamped to 0..100 to match the `normalizeSeverity` contract
 * range — even if `percent` ever exceeds 100 we don't poison
 * downstream consumers.
 */
function legacySeverityFromPercent(percent: number): number {
  const safe = Number.isFinite(percent) ? percent : 0;
  return Math.max(0, Math.min(100, Math.round(safe)));
}

/**
 * Compute a 0..100 severity for one review-KPI under the Truth Layer
 * v1 normaliser. Wraps `normalizeSeverity` so call sites stay readable
 * — the contract takes generic `SeverityCalcInput` fields, but the
 * KPI-level call always wants the same defaults (`baseSeverity = 100`,
 * `recentDaysOld = 0` because we don't have per-mention timestamps,
 * `visibilityFactor` derived from total review count).
 */
function severityForKpi(opts: {
  count: number;
  pool: number;
  total: number;
  baseSeverity?: number;
  recentDaysOld?: number;
  visibilityFactor?: number;
}): number {
  return normalizeSeverity({
    baseSeverity: opts.baseSeverity ?? 100,
    mentionCount: opts.count,
    negCount: opts.pool,
    totalCount: opts.total,
    recentDaysOld: opts.recentDaysOld ?? 0,
    visibilityFactor: opts.visibilityFactor,
  });
}

/**
 * Visibility multiplier — `1.5` for high-traffic operators
 * (>1k reviews) per the `severity@v1` contract. Higher review surface
 * = more prospects see the negative signal, so the same negRatio
 * matters more.
 */
function visibilityFactorFor(totalCount: number): number {
  return totalCount >= 1000 ? 1.5 : 1.0;
}

/**
 * Classify a Gemini-extracted switch signal `{from, to, reason}` into
 * a typed `SwitchDirection`.
 *
 *   - `inbound`            — the reviewer moved *toward* the prospect
 *                            (e.g. "way better than the place I used to go").
 *                            `to` matches the businessName.
 *   - `outbound`           — the reviewer left the prospect's brand
 *                            ("we used to go to <us> but moved").
 *                            `from` matches the businessName.
 *   - `comparison_neutral` — the reviewer compared two third parties
 *                            ("Resy is instant in other places") with
 *                            no clear in/out vector relative to the lead.
 *
 * The matcher tolerates partial / cased variations of the business name
 * because Gemini sometimes paraphrases ("Casa" instead of
 * "Casa Polanco"). We keep it deliberately conservative: when neither
 * side maps to the prospect, we return `comparison_neutral` rather
 * than guessing — guessing direction is the entire bug class T-C is
 * fixing.
 */
function classifySwitchDirection(opts: {
  from?: string | null;
  to?: string | null;
  businessName: string;
}): SwitchDirection {
  const norm = (s: string): string =>
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  const business = norm(opts.businessName ?? "");
  if (!business) return "comparison_neutral";
  const from = opts.from ? norm(opts.from) : "";
  const to = opts.to ? norm(opts.to) : "";

  const matches = (s: string): boolean => {
    if (!s) return false;
    if (s === business) return true;
    // Soft contains for multi-word business names. Both sides need to
    // be at least 4 chars to avoid trivial-substring false positives
    // ("a" matching "alphabet").
    if (s.length >= 4 && business.length >= 4) {
      if (s.includes(business)) return true;
      if (business.includes(s)) return true;
    }
    return false;
  };

  const fromIsBusiness = matches(from);
  const toIsBusiness = matches(to);

  if (fromIsBusiness && !toIsBusiness) return "outbound";
  if (toIsBusiness && !fromIsBusiness) return "inbound";
  return "comparison_neutral";
}

/**
 * Pick the competitor side of a switch signal given its direction.
 * For `outbound` signals the competitor is the destination (`to`);
 * for `inbound` the competitor is where the reviewer came from
 * (`from`); for `comparison_neutral` we surface whichever side is
 * non-empty (preferring `to` because Gemini tends to put the named
 * brand there).
 */
function competitorFromSignal(opts: {
  from?: string | null;
  to?: string | null;
  direction: SwitchDirection;
}): string {
  const f = (opts.from ?? "").trim();
  const t = (opts.to ?? "").trim();
  switch (opts.direction) {
    case "outbound":
      return t || f || "";
    case "inbound":
      return f || t || "";
    case "comparison_neutral":
    default:
      return t || f || "";
  }
}

/** Test surface re-exports — keep these here so the helpers are reachable
 *  from `src/__tests__/agent-workers/*.test.ts` without extracting the
 *  worker into a sibling module (the file-touched envelope only allows
 *  edits to this file). */
export {
  classifySwitchDirection,
  competitorFromSignal,
  legacySeverityFromPercent,
  severityForKpi,
  visibilityFactorFor,
};
export type { EnrichedReviewKpi };

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
        // 200 is the Gemini KPI-bar context cap — PLAN §Phase 5
        // tightened from 220 to relieve context-window pressure on
        // high-volume leads (Bianco43: 1572 reviews) that were
        // tripping the 60s outer deadline before the deadline bump.
        // 200 still gives KPI bars enough signal to be statistically
        // stable. APIFY_GMAPS_DEEP still ingests up to 500 reviews;
        // the trigger-detector's review-volume rule + the decision-
        // surface badge math both still see the full 500 via
        // `execute.ts` (workers) and the aggregator's own `take`.
        // Only THIS Gemini-bound path is narrowed. Pair with the
        // registry bump to 30 000 ms estimatedDurationMs so the
        // outer deadline gets 90s of runway.
        googleReviews: { orderBy: { publishTime: "desc" }, take: 200 },
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

    // ============================================================
    // Truth Layer v1 (T-C Evidence Calibration) enrichment.
    //
    // 1. Severity normalisation — every KPI + switch signal severity
    //    runs through `normalizeSeverity()` from
    //    `@/lib/sdr-brain/contracts` so a 9-of-11-negatives concentration
    //    on a 397-review operator collapses to "low base-rate" severity
    //    (~2/100) instead of the misleading 82% raw share. Gated behind
    //    `TRUTH_LAYER_SEVERITY_V2`; off-flag falls back to
    //    `legacySeverityFromPercent` for shadow-run comparison.
    //
    // 2. Switch direction labelling (master plan §3 T-C) — Gemini emits
    //    `{from, to, reason}`; we classify each entry into
    //    `inbound | outbound | comparison_neutral` and persist the
    //    typed `SwitchSignal` shape declared by `switch-signal@v1`.
    //    Direction labelling ships unconditionally (additive — legacy
    //    consumers reading the Json column see strict-superset shapes).
    //
    // 3. `percentBase` ride-along (master plan §5 T-G) — every KPI
    //    carries `percentBase: "negative_reviews" | "total_reviews"`
    //    so the surface UI can render the denominator the user
    //    selected without a second math pass. Default
    //    `"negative_reviews"` preserves pre-Truth-Layer wire compat.
    // ============================================================

    // Re-derive workspaceId from the lead row (per
    // `multi-tenant-scope.mdc` worker rule) — never trust the job
    // payload as the authoritative source.
    const workspaceId = lead.workspaceId;
    const totalCount = Math.max(
      lead.reviewCount ?? 0,
      lead.googleReviews.length,
      1,
    );
    const visibilityFactor = visibilityFactorFor(totalCount);
    const useV2 = isTruthLayerFlagEnabled("TRUTH_LAYER_SEVERITY_V2", {
      workspaceId,
    });
    const negRatio =
      totalCount > 0 ? negativePoolCount / totalCount : 0;

    type IncomingKpi = { label: string; count: number; percent: number; examples?: string[] };
    const enrichKpis = (
      kpis: IncomingKpi[],
      pool: number,
      kind: "weakness" | "strength",
    ): EnrichedReviewKpi[] =>
      kpis.map((kpi) => {
        const baseExamples = Array.isArray(kpi.examples) ? kpi.examples : [];
        const severity = useV2
          ? severityForKpi({
              count: kpi.count,
              pool,
              total: totalCount,
              visibilityFactor,
            })
          : legacySeverityFromPercent(kpi.percent);
        // Verbose telemetry per the master-plan §8 R4 mitigation:
        // global severity distribution is the Wave-1 shadow-gate
        // metric, so the Release Manager needs every transformed
        // value logged with both pre- and post-normalisation values.
        logger.info("truth.severity.normalized", {
          leadId,
          workspaceId,
          rawSeverity: legacySeverityFromPercent(kpi.percent),
          normalizedSeverity: severity,
          negRatio: Number(negRatio.toFixed(4)),
          kpiKind: kind,
          kpiLabel: kpi.label,
          mentionCount: kpi.count,
          pool,
          total: totalCount,
          visibilityFactor,
          severityFlagOn: useV2,
        });
        return {
          label: kpi.label,
          count: kpi.count,
          percent: kpi.percent,
          examples: baseExamples,
          severity,
          percentBase: "negative_reviews",
        };
      });

    const enrichedWeaknessKpis = enrichKpis(
      analysis.weaknessKpis as IncomingKpi[],
      negativePoolCount,
      "weakness",
    );
    const enrichedStrengthKpis = enrichKpis(
      analysis.strengthKpis as IncomingKpi[],
      positivePoolCount,
      "strength",
    );

    // ---- Switch signal direction labelling ----
    // Gemini's structured output is `Array<{from, to, reason}>` per
    // `review-analysis-prompt.ts` schema. v1 wrote a flat string array
    // here; we now write `SwitchSignal[]` (Option B in
    // `prisma/deltas/truth-layer-v1.md` row W1-T-C-001 — Json shape
    // change, no DDL).
    type IncomingSwitchSignal =
      | { from?: string | null; to?: string | null; reason?: string | null }
      | string;
    const incomingSwitchSignals: IncomingSwitchSignal[] = Array.isArray(
      analysis.switchSignals,
    )
      ? (analysis.switchSignals as unknown as IncomingSwitchSignal[])
      : [];
    const enrichedSwitchSignals: SwitchSignal[] = incomingSwitchSignals.map(
      (sig, idx) => {
        // Tolerate the legacy shape (flat string) — older Gemini calls
        // and seed fixtures may still emit one. We treat it as
        // comparison_neutral with the string as the quote.
        const isString = typeof sig === "string";
        const from = isString ? null : sig.from ?? null;
        const to = isString ? null : sig.to ?? null;
        const reason = isString ? sig : sig.reason ?? "";
        const direction = classifySwitchDirection({
          from,
          to,
          businessName: lead.businessName,
        });
        const competitor = competitorFromSignal({ from, to, direction });
        // Per the contract: switch signals come out of positive reviews,
        // so the natural denominator is the positive pool. We treat
        // this exactly the same as a single-mention KPI for severity
        // purposes (the competitor mention IS the evidence).
        const severity = useV2
          ? severityForKpi({
              count: 1,
              pool: Math.max(positivePoolCount, 1),
              total: totalCount,
              visibilityFactor,
              baseSeverity: 60,
            })
          : 50;
        logger.info("truth.switch_signal.direction_assigned", {
          leadId,
          workspaceId,
          direction,
          competitor,
          quote: reason.slice(0, 200),
        });
        return {
          competitor,
          direction,
          quote: reason,
          reviewId: `${leadId}:switch:${idx}`,
          severity,
        };
      },
    );

    // The contract type `SwitchSignal` is an `interface` with named
    // members (per `switch-signal@v1`) — it doesn't satisfy Prisma's
    // `InputJsonValue` string-index-signature constraint as-is. Cast
    // through `unknown` at the column boundary; the runtime shape IS
    // valid JSON, the cast is only there to bridge two structural-type
    // worlds. The KPI types are declared as `type` aliases above so
    // they don't need this dance.
    const switchSignalsJson = enrichedSwitchSignals as unknown as Prisma.InputJsonValue;

    await prisma.reviewAnalysis.upsert({
      where: { leadId },
      create: {
        leadId,
        reviewsAnalyzedCount: analysis.reviewsAnalyzedCount,
        weaknessKpis: enrichedWeaknessKpis,
        strengthKpis: enrichedStrengthKpis,
        sentimentBreakdown: analysis.sentimentBreakdown,
        painPhrases: analysis.painPhrases,
        strengthPhrases: analysis.strengthPhrases,
        switchSignals: switchSignalsJson,
        leadScore: analysis.leadScore,
        summary: analysis.summary,
      },
      update: {
        reviewsAnalyzedCount: analysis.reviewsAnalyzedCount,
        weaknessKpis: enrichedWeaknessKpis,
        strengthKpis: enrichedStrengthKpis,
        sentimentBreakdown: analysis.sentimentBreakdown,
        painPhrases: analysis.painPhrases,
        strengthPhrases: analysis.strengthPhrases,
        switchSignals: switchSignalsJson,
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
