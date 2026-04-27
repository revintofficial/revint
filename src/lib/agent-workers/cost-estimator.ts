/**
 * Pipeline cost estimator.
 *
 * Powers the "100 lead için tahmini X token + $Y · lead başına ~Zs"
 * footer in `Settings → Lead Pipeline`. The estimator answers:
 *
 *   "If this workspace runs N leads through the configured chain,
 *    how much Gemini and Apify will it cost, and how long will it
 *    take per lead?"
 *
 * Strategy
 * --------
 * 1. Pull the last 30 days of SUCCEEDED AgentRuns for this workspace,
 *    grouped by workerKind. Take the AVG of costTokens + costUsdCents
 *    across those rows. This is the *empirical* per-run cost for that
 *    workspace's actual lead distribution and is the most accurate
 *    signal we have.
 *
 * 2. Where a worker has no recent runs (brand-new workspace, or a
 *    worker that's never been scheduled), fall back to seed values
 *    keyed by worker kind. The seeds are conservative — slight
 *    over-estimation is preferred to under-estimation so the UI never
 *    surprises the user with a higher real bill.
 *
 * 3. Optional steps in the chain are weighted by an
 *    `optionalRunRate` — empirical "how often does this optional
 *    worker actually run" measured across the workspace. Sentinels
 *    (EMBED_LEAD_PROFILE, WRITE_OPENER_OUTCOME) are zero-cost and
 *    excluded from the sum.
 *
 * 4. Duration-per-lead uses `estimatedDurationMs` from the registry
 *    plus a topological pass over the DAG so parallel branches don't
 *    inflate wall-clock time. We approximate longest-path with
 *    Kahn's algorithm + per-node duration.
 */
import type { AgentWorkerKind, Plan } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getWorker } from "./registry";
import type { Chain, ChainStep } from "@/lib/ai-core/chains";

/**
 * Conservative seed cost values per worker kind. Used when the
 * workspace has no recent SUCCEEDED runs to learn from. Token and
 * cent figures are intentionally rounded UP from observed averages
 * so the UI does not understate the bill on a fresh workspace.
 *
 * Updated: 2026-04-26 from production telemetry. Re-derive with
 * `prisma.agentRun.groupBy({ by: ["workerKind"], _avg: ... })` if
 * the assumptions drift more than ~25%.
 */
interface CostSeed {
  /** Average tokens consumed per run. 0 for non-Gemini workers. */
  tokens: number;
  /** Average USD cents per run. 0 for Gemini-only workers. */
  cents: number;
}

const COST_SEEDS: Partial<Record<AgentWorkerKind, CostSeed>> = {
  // Intelligence
  WEBSITE_AUDITOR: { tokens: 1200, cents: 0 },
  REVIEW_ANALYST: { tokens: 4500, cents: 0 },
  GOOGLE_PLACES_REVIEWS: { tokens: 0, cents: 0 },
  SALES_OPPORTUNITY_SCORER: { tokens: 3500, cents: 0 },
  SOCIAL_SCRAPER: { tokens: 800, cents: 0 },
  EMAIL_VERIFIER: { tokens: 0, cents: 1 },

  // Pitch
  WEBSITE_MOCKUP_GENERATOR: { tokens: 18000, cents: 0 },
  OPENER_WRITER: { tokens: 4000, cents: 0 },
  LEAD_DOSSIER_GENERATOR: { tokens: 9000, cents: 0 },
  WEBSITE_PLAN_GENERATOR: { tokens: 22000, cents: 0 },
  VIDEO_SCRIPT_WRITER: { tokens: 5000, cents: 0 },
  VOICE_NOTE_TRANSCRIBER: { tokens: 1500, cents: 0 },

  // Deliverables
  AI_RECEPTIONIST_BUILDER: { tokens: 25000, cents: 0 },
  REVIEW_REPLY_AGENT: { tokens: 12000, cents: 0 },
  LEAD_RESPONSE_AGENT: { tokens: 8000, cents: 0 },

  // Apify enrichment (USD-denominated; tokens negligible)
  APIFY_GMAPS_DEEP: { tokens: 0, cents: 150 },
  APIFY_WEB_CRAWL_DEEP: { tokens: 0, cents: 50 },
  APIFY_INSTAGRAM_DEEP: { tokens: 0, cents: 30 },
  APIFY_FACEBOOK_DEEP: { tokens: 0, cents: 20 },
  APIFY_TIKTOK_DEEP: { tokens: 0, cents: 30 },
  APIFY_SERP_RANK: { tokens: 0, cents: 10 },
  APIFY_COMPETITOR_ADS: { tokens: 0, cents: 30 },
  APIFY_LINKEDIN_COMPANY: { tokens: 0, cents: 80 },
  APIFY_REDDIT_MENTIONS: { tokens: 0, cents: 20 },

  // Ops / sentinels — no per-lead cost
  COPILOT_CHAT: { tokens: 1500, cents: 0 },
  INBOX_REPLY_ATTRIBUTOR: { tokens: 500, cents: 0 },
  OUTREACH_SENDER: { tokens: 0, cents: 0 },
  CONTAINMENT_RATE_TRACKER: { tokens: 0, cents: 0 },
  GBP_AUTOPOST_AGENT: { tokens: 6000, cents: 0 },
  BOOKING_WIDGET_BUILDER: { tokens: 4000, cents: 0 },
};

const RECENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_SAMPLE_SIZE = 3;

export interface PerWorkerCostStats {
  kind: AgentWorkerKind;
  /** Average Gemini tokens per SUCCEEDED run (0 for non-Gemini). */
  avgTokens: number;
  /** Average USD cents per SUCCEEDED run. */
  avgCents: number;
  /** Number of historical runs that fed this average. 0 = seed only. */
  sampleSize: number;
  /** Empirical "how often does this run" 0..1 — used to discount optional steps. */
  optionalRunRate: number;
}

export interface PipelineEstimate {
  /** Per-lead total Gemini tokens. */
  perLeadTokens: number;
  /** Per-lead USD cents (Apify + any other USD-denominated workers). */
  perLeadCents: number;
  /** Wall-clock estimate for one lead in milliseconds (longest path). */
  perLeadDurationMs: number;
  /**
   * "Real" tokens for `leadCount` leads. The UI multiplies by
   * `leadCount` (default 100 in settings).
   */
  totalTokens: number;
  totalCents: number;
  /**
   * Per-step breakdown so the UI can build a tooltip / detail row:
   * `WEBSITE_AUDITOR · 1.2k tok · 14s`.
   */
  steps: Array<{
    stepId: string;
    workerKind: AgentWorkerKind;
    tokens: number;
    cents: number;
    durationMs: number;
    optional: boolean;
    /** True when no recent SUCCEEDED run for this kind in this workspace. */
    seeded: boolean;
  }>;
}

/**
 * Returns a workspace-scoped per-worker cost map. Rows with fewer
 * than `MIN_SAMPLE_SIZE` historical runs fall back to seeds; the
 * `sampleSize` field tells the UI which rows are estimated vs
 * measured so we can render an "estimate" badge.
 */
export async function loadWorkspaceCostStats(
  workspaceId: string,
): Promise<Record<AgentWorkerKind, PerWorkerCostStats>> {
  const since = new Date(Date.now() - RECENT_WINDOW_MS);

  // Single round-trip: average + count, plus total scheduled runs
  // (SUCCEEDED + FAILED + SKIPPED) so we can compute optionalRunRate
  // = SUCCEEDED / scheduled.
  const [averages, totalRuns] = await Promise.all([
    prisma.agentRun.groupBy({
      by: ["workerKind"],
      where: {
        workspaceId,
        status: "SUCCEEDED",
        createdAt: { gte: since },
      },
      _avg: { costTokens: true, costUsdCents: true },
      _count: { _all: true },
    }),
    prisma.agentRun.groupBy({
      by: ["workerKind"],
      where: {
        workspaceId,
        createdAt: { gte: since },
      },
      _count: { _all: true },
    }),
  ]);

  const totalByKind = new Map<AgentWorkerKind, number>();
  for (const t of totalRuns) {
    totalByKind.set(t.workerKind, t._count._all);
  }

  const out: Partial<Record<AgentWorkerKind, PerWorkerCostStats>> = {};
  for (const a of averages) {
    const total = totalByKind.get(a.workerKind) ?? a._count._all;
    out[a.workerKind] = {
      kind: a.workerKind,
      avgTokens: Math.round(a._avg.costTokens ?? 0),
      avgCents: Math.round(a._avg.costUsdCents ?? 0),
      sampleSize: a._count._all,
      optionalRunRate: total > 0 ? a._count._all / total : 1,
    };
  }
  return out as Record<AgentWorkerKind, PerWorkerCostStats>;
}

/**
 * Returns the cost estimate for running `leadCount` leads through
 * the supplied chain, using empirical workspace data where
 * available and seeds elsewhere.
 *
 * The function is pure aside from the prisma read inside
 * loadWorkspaceCostStats; safe to call from API handlers without
 * caching.
 */
export async function estimateChainCost(args: {
  workspaceId: string;
  plan: Plan;
  chain: Chain;
  leadCount?: number;
}): Promise<PipelineEstimate> {
  const leadCount = args.leadCount ?? 100;
  const stats = await loadWorkspaceCostStats(args.workspaceId);

  const steps: PipelineEstimate["steps"] = [];
  let perLeadTokens = 0;
  let perLeadCents = 0;

  for (const step of args.chain) {
    if (isSentinelStep(step)) continue;
    const seed = COST_SEEDS[step.workerKind] ?? { tokens: 0, cents: 0 };
    const empirical = stats[step.workerKind];
    const useEmpirical = empirical && empirical.sampleSize >= MIN_SAMPLE_SIZE;
    const tokens = useEmpirical ? empirical.avgTokens : seed.tokens;
    const cents = useEmpirical ? empirical.avgCents : seed.cents;
    // Optional steps are discounted by the empirical run rate so e.g.
    // SOCIAL_SCRAPER (which runs ~70% of the time because some leads
    // have no socials) doesn't get billed at 100%.
    const runRate = step.optional && empirical
      ? Math.max(0.1, empirical.optionalRunRate)
      : 1;

    const stepTokens = Math.round(tokens * runRate);
    const stepCents = Math.round(cents * runRate);

    perLeadTokens += stepTokens;
    perLeadCents += stepCents;

    const worker = getWorker(step.workerKind);
    const durationMs = Math.round(
      (worker?.estimatedDurationMs ?? 0) * runRate,
    );

    steps.push({
      stepId: step.stepId,
      workerKind: step.workerKind,
      tokens: stepTokens,
      cents: stepCents,
      durationMs,
      optional: !!step.optional,
      seeded: !useEmpirical,
    });
  }

  const perLeadDurationMs = computeLongestPathMs(args.chain);

  return {
    perLeadTokens,
    perLeadCents,
    perLeadDurationMs,
    totalTokens: perLeadTokens * leadCount,
    totalCents: perLeadCents * leadCount,
    steps,
  };
}

/**
 * True for orchestrator sentinel steps (EMBED_LEAD_PROFILE etc.).
 * Sentinels reuse a worker kind but their runtime cost is a single
 * SQL upsert; surfacing them in the cost footer would add noise
 * with no signal.
 */
function isSentinelStep(step: ChainStep): boolean {
  const sentinel = step.inputs?.__sentinel;
  return typeof sentinel === "string" && sentinel.length > 0;
}

/**
 * Approximates per-lead wall-clock duration as the longest path
 * through the DAG, where each step's weight is its registered
 * `estimatedDurationMs`. Independent branches run in parallel so
 * total wall-clock is bounded by the slowest path, not the sum.
 *
 * Sentinel steps and unknown workers contribute 0ms.
 */
function computeLongestPathMs(chain: Chain): number {
  if (chain.length === 0) return 0;

  const stepById = new Map(chain.map((s) => [s.stepId, s] as const));
  const longestEnding = new Map<string, number>();

  // Topological order via Kahn's algorithm. The DAG was already
  // validated for cycles upstream so we trust the input here.
  const incoming = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const s of chain) {
    incoming.set(s.stepId, s.dependsOn.length);
    for (const d of s.dependsOn) {
      const list = dependents.get(d) ?? [];
      list.push(s.stepId);
      dependents.set(d, list);
    }
  }

  const ready: string[] = [];
  for (const [id, n] of incoming) if (n === 0) ready.push(id);

  let max = 0;
  while (ready.length > 0) {
    const id = ready.shift()!;
    const step = stepById.get(id);
    if (!step) continue;
    const self = isSentinelStep(step)
      ? 0
      : getWorker(step.workerKind)?.estimatedDurationMs ?? 0;
    let upstream = 0;
    for (const d of step.dependsOn) {
      upstream = Math.max(upstream, longestEnding.get(d) ?? 0);
    }
    const total = upstream + self;
    longestEnding.set(id, total);
    if (total > max) max = total;

    for (const dep of dependents.get(id) ?? []) {
      const next = (incoming.get(dep) ?? 0) - 1;
      incoming.set(dep, next);
      if (next === 0) ready.push(dep);
    }
  }

  if (longestEnding.size !== chain.length) {
    logger.warn("cost_estimator.path_truncated", {
      visited: longestEnding.size,
      total: chain.length,
    });
  }

  return max;
}
