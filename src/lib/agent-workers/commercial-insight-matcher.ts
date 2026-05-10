/**
 * COMMERCIAL_INSIGHT_MATCHER worker (T2 deterministic + win-rate rerank).
 *
 * Picks the top-K commercial insights for a lead based on:
 *   1. Niche match (insight.applicableSubNiches contains the lead's
 *      subNicheSlug or nicheSlug).
 *   2. Trigger match (insight.applicableTriggers ∩ activeTriggers ≠ ∅).
 *   3. Wilson lower-bound score from InsightPerformance — insights
 *      with a proven track record (replyPositive / applied) outrank
 *      insights with no data, but a brand-new insight gets a
 *      Bayesian prior so it can compete on its baseline priority.
 *
 * Why Wilson lower bound: a new insight (0 applications, 0 positives)
 * shouldn't outrank an insight with 47/200 just because the unknown
 * one has "infinite" potential — but it also shouldn't be permanently
 * frozen out. Wilson 95% lower bound interpolates correctly.
 *
 * Pure ranking: no Gemini call. Output is the ordered list with the
 * top pick's id. SDR_BRAIN consumes this and the OPENER_WRITER may
 * use the top pick's reframe as the opener angle (writing an
 * `InsightApplication` row at that point).
 */
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { CommercialInsight, LeadTriggerType } from "@/generated/prisma/client";
import type {
  AgentWorkerContext,
  AgentWorkerOutput,
  AgentWorkerRun,
  MemoryWrite,
} from "./types";
import { REASONING_SUMMARY_REF_TYPES } from "./reasoning-ref-types";

const TOP_K = 3;

/**
 * Wilson lower bound for a Bernoulli proportion at 95% confidence.
 * Returns 0 when n=0. Standard formula; see e.g. evanmiller.org.
 */
function wilsonLowerBound(positive: number, n: number, z = 1.96): number {
  if (n === 0) return 0;
  const phat = positive / n;
  const denom = 1 + (z * z) / n;
  const center = phat + (z * z) / (2 * n);
  const margin = z * Math.sqrt((phat * (1 - phat) + (z * z) / (4 * n)) / n);
  return (center - margin) / denom;
}

interface RankedInsight {
  insight: Pick<
    CommercialInsight,
    "id" | "industryMyth" | "reframe" | "economicImpact" | "basePriority" | "evidenceUrl"
  > & { applicableTriggers: LeadTriggerType[]; applicableSubNiches: string[] };
  rankScore: number;
  matchedTriggers: LeadTriggerType[];
  appliedCount: number;
  positiveCount: number;
  wilsonLowerBound: number;
}

export const run: AgentWorkerRun = async (
  ctx: AgentWorkerContext,
): Promise<AgentWorkerOutput> => {
  if (!ctx.lead) throw new Error("COMMERCIAL_INSIGHT_MATCHER requires a lead context");
  const lead = ctx.lead;
  const workspaceId = ctx.workspaceId;

  const subNicheSlug = lead.subNicheSlug;
  const nicheSlug = lead.nicheSlug;

  // 1. Pull active triggers — these are the heart of the match score.
  const triggers = await prisma.leadTrigger.findMany({
    where: { workspaceId, leadId: lead.id, decayedAt: null },
    select: { id: true, type: true },
  });
  const activeTriggerTypes = new Set(triggers.map((t) => t.type));

  // 2. Pull candidate insights — workspace seeds + system seeds (workspaceId null).
  const insights = await prisma.commercialInsight.findMany({
    where: {
      OR: [{ workspaceId }, { workspaceId: null }],
    },
    select: {
      id: true,
      industryMyth: true,
      reframe: true,
      economicImpact: true,
      basePriority: true,
      evidenceUrl: true,
      applicableTriggers: true,
      applicableSubNiches: true,
    },
  });

  if (insights.length === 0) {
    logger.info("agent_workers.commercial_insight_matcher.no_insights", {
      workspaceId,
      leadId: lead.id,
    });
    return { output: { picks: [], topPickId: null }, costTokens: 0 };
  }

  // 3. Pull InsightPerformance rows for the candidate insights so we
  // can compute Wilson lower bounds at consumer site. Bucket by
  // insightId; the UI / reranker may further filter by niche/trigger
  // tier downstream.
  const performance = await prisma.insightPerformance.findMany({
    where: {
      workspaceId,
      insightId: { in: insights.map((i) => i.id) },
    },
    select: {
      insightId: true,
      applied: true,
      replyPositive: true,
    },
  });

  const performanceByInsight = new Map<string, { applied: number; positive: number }>();
  for (const p of performance) {
    const existing = performanceByInsight.get(p.insightId) ?? { applied: 0, positive: 0 };
    performanceByInsight.set(p.insightId, {
      applied: existing.applied + p.applied,
      positive: existing.positive + p.replyPositive,
    });
  }

  // 4. Score each insight.
  const ranked: RankedInsight[] = [];
  for (const ins of insights) {
    // Niche gate — if the insight has applicableSubNiches and the
    // lead's slug isn't in them, skip. Empty list = niche-agnostic.
    if (ins.applicableSubNiches.length > 0) {
      const lcCandidates = ins.applicableSubNiches.map((s) => s.toLowerCase());
      const lcSub = (subNicheSlug ?? "").toLowerCase();
      const lcParent = (nicheSlug ?? "").toLowerCase();
      const matches = lcCandidates.includes(lcSub) || lcCandidates.includes(lcParent);
      if (!matches) continue;
    }

    const matchedTriggers = ins.applicableTriggers.filter((t) =>
      activeTriggerTypes.has(t),
    );

    const perf = performanceByInsight.get(ins.id) ?? { applied: 0, positive: 0 };
    const wilson = wilsonLowerBound(perf.positive, perf.applied);

    // Final rank: basePriority + matched-trigger boost + Wilson * 50
    // (Wilson ranges 0..1, so this caps the win-rate contribution
    // around 50 points). New insights with no data get the basePriority
    // unblemished — they compete on their default weight until they
    // accrue evidence.
    const triggerBoost = matchedTriggers.length * 15;
    const rankScore = ins.basePriority + triggerBoost + wilson * 50;

    ranked.push({
      insight: ins,
      rankScore,
      matchedTriggers,
      appliedCount: perf.applied,
      positiveCount: perf.positive,
      wilsonLowerBound: wilson,
    });
  }

  ranked.sort((a, b) => b.rankScore - a.rankScore);
  const picks = ranked.slice(0, TOP_K);
  const topPickId = picks[0]?.insight.id ?? null;

  logger.info("agent_workers.commercial_insight_matcher.done", {
    leadId: lead.id,
    workspaceId,
    candidateCount: insights.length,
    rankedCount: ranked.length,
    topPickId,
    topRankScore: picks[0]?.rankScore ?? null,
  });

  return {
    output: {
      picks: picks.map((r) => ({
        id: r.insight.id,
        industryMyth: r.insight.industryMyth,
        reframe: r.insight.reframe,
        economicImpact: r.insight.economicImpact,
        evidenceUrl: r.insight.evidenceUrl,
        basePriority: r.insight.basePriority,
        rankScore: Math.round(r.rankScore),
        matchedTriggers: r.matchedTriggers,
        appliedCount: r.appliedCount,
        positiveCount: r.positiveCount,
        wilsonLowerBound: Number(r.wilsonLowerBound.toFixed(3)),
      })),
      topPickId,
    },
    costTokens: 0,
  };
};

export function memoryWrites(output: unknown, ctx: AgentWorkerContext): MemoryWrite[] {
  if (!ctx.leadId) return [];
  const o = output as { picks: Array<{ id: string; reframe: string }>; topPickId: string | null };
  if (!o.topPickId || o.picks.length === 0) return [];
  const top = o.picks[0];
  return [
    {
      kind: "REASONING_SUMMARY",
      text: `Top commercial insight match: "${top.reframe.slice(0, 200)}".`,
      leadId: ctx.leadId,
      // Phase 0 hot-fix — see `reasoning-ref-types.ts`. Was
      // SCREAMING_SNAKE_CASE; reader expects PascalCase.
      refType: REASONING_SUMMARY_REF_TYPES.CommercialInsightMatcher,
      refId: ctx.runId,
      metadata: { topPickId: o.topPickId, candidates: o.picks.map((p) => p.id) },
      skipEmbed: true,
    },
  ];
}
