/**
 * AI Workers - tier-based quota gating.
 *
 * Each Phase 1 worker has a per-workspace monthly quota keyed by plan.
 * The gate is checked in TWO places:
 *   1. API endpoint (POST /api/leads/:id/workers/:kind) - early 402
 *      response so the UI can upsell the plan.
 *   2. Worker process (agent-run-worker.ts at job start) - prevents
 *      bypass if someone enqueues a job through a different path.
 *
 * Counter semantics: we count `AgentRun` rows in a terminal billable
 * state (SUCCEEDED) plus currently-enqueued work (PENDING/RUNNING) up
 * to a short grace window; older PENDING/RUNNING rows that have been
 * stuck are ignored so a crashed worker cannot silently drain a
 * workspace's quota. Scoped to `(workspaceId, workerKind)` and created
 * within the current Stripe billing cycle. Cycle reset is aligned with
 * `workspace.cycleResetAt` so users see one consistent "resets on X"
 * message across every meter.
 *
 * Why not just count SUCCEEDED: that races with in-flight runs --
 * between assertWorkerQuota() and the actual run finishing the same
 * workspace can double-book capacity. We therefore also count
 * PENDING/RUNNING rows younger than `PENDING_GRACE_MS`.
 */
import type { AgentWorkerKind, Plan } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getWorker, planMeetsMinimum } from "./registry";

/**
 * Special sentinel meaning "no monthly cap, usage is effectively
 * unlimited for this tier". UI shows as "Unlimited".
 */
export const UNLIMITED = -1;

/**
 * Per-plan monthly limits. `0` means the worker is hidden / locked at
 * that tier (UI shows an upgrade CTA). `UNLIMITED` is soft-capped at
 * a very high number server-side to prevent runaway abuse.
 *
 * LAUNCH POLICY (temporary, revisit after 30 days of production
 * telemetry): every tier gets access to every worker. The per-tier
 * numbers still apply as monthly caps but nothing is 0. This lets us
 * ship the AI Workers feature to existing FREE users without an
 * upsell wall so they can experience the value and self-upgrade. Flip
 * LAUNCH_POLICY to false to restore the conservative matrix (FREE = 0
 * for deliverables, 0 for email verifier, 0 for video scripts, etc.).
 */
const LAUNCH_POLICY = true;

const CONSERVATIVE_LIMITS: Record<AgentWorkerKind, Record<Plan, number>> = {
  // Grup A - Intelligence run outside AgentRun in Phase 1; quotas here
  // reflect what they will be when consolidated in Phase 2.
  WEBSITE_AUDITOR: { FREE: 50, PRO: 500, PRO_TEAM: 2000, AGENCY: UNLIMITED },
  REVIEW_ANALYST: { FREE: 20, PRO: 300, PRO_TEAM: 1500, AGENCY: UNLIMITED },
  SALES_OPPORTUNITY_SCORER: { FREE: 50, PRO: 500, PRO_TEAM: 2000, AGENCY: UNLIMITED },
  SOCIAL_SCRAPER: { FREE: 20, PRO: 300, PRO_TEAM: 1500, AGENCY: UNLIMITED },
  EMAIL_VERIFIER: { FREE: 0, PRO: 500, PRO_TEAM: 2000, AGENCY: UNLIMITED },

  // Grup B - Pitch
  WEBSITE_PLAN_GENERATOR: { FREE: 5, PRO: 50, PRO_TEAM: 200, AGENCY: UNLIMITED },
  WEBSITE_MOCKUP_GENERATOR: { FREE: 3, PRO: 30, PRO_TEAM: 150, AGENCY: UNLIMITED },
  OPENER_WRITER: { FREE: 20, PRO: 300, PRO_TEAM: 1500, AGENCY: UNLIMITED },
  VIDEO_SCRIPT_WRITER: { FREE: 0, PRO: 50, PRO_TEAM: 200, AGENCY: UNLIMITED },
  VOICE_NOTE_TRANSCRIBER: { FREE: 10, PRO: 100, PRO_TEAM: 500, AGENCY: UNLIMITED },

  // Grup C - Deliverable (prospect install packs)
  AI_RECEPTIONIST_BUILDER: { FREE: 0, PRO: 20, PRO_TEAM: 100, AGENCY: UNLIMITED },
  REVIEW_REPLY_AGENT: { FREE: 0, PRO: 30, PRO_TEAM: 150, AGENCY: UNLIMITED },
  LEAD_RESPONSE_AGENT: { FREE: 0, PRO: 30, PRO_TEAM: 150, AGENCY: UNLIMITED },
  BOOKING_WIDGET_BUILDER: { FREE: 0, PRO: 20, PRO_TEAM: 100, AGENCY: UNLIMITED },
  GBP_AUTOPOST_AGENT: { FREE: 0, PRO: 0, PRO_TEAM: 30, AGENCY: UNLIMITED },

  // Grup D - Ops
  COPILOT_CHAT: { FREE: 5, PRO: 50, PRO_TEAM: 200, AGENCY: UNLIMITED },
  INBOX_REPLY_ATTRIBUTOR: { FREE: 0, PRO: UNLIMITED, PRO_TEAM: UNLIMITED, AGENCY: UNLIMITED },
  OUTREACH_SENDER: { FREE: 0, PRO: 500, PRO_TEAM: 2000, AGENCY: UNLIMITED },
  CONTAINMENT_RATE_TRACKER: { FREE: 0, PRO: 0, PRO_TEAM: UNLIMITED, AGENCY: UNLIMITED },

  // Apify enrichment. Per-workspace monthly run count. A separate USD
  // cost cap lives in `MONTHLY_APIFY_USD_LIMIT` below and is enforced
  // independently; whichever fires first stops the workspace.
  APIFY_GMAPS_DEEP: { FREE: 0, PRO: 30, PRO_TEAM: 150, AGENCY: UNLIMITED },
  APIFY_WEB_CRAWL_DEEP: { FREE: 0, PRO: 30, PRO_TEAM: 150, AGENCY: UNLIMITED },
  APIFY_INSTAGRAM_DEEP: { FREE: 0, PRO: 20, PRO_TEAM: 100, AGENCY: UNLIMITED },
  APIFY_FACEBOOK_DEEP: { FREE: 0, PRO: 20, PRO_TEAM: 100, AGENCY: UNLIMITED },
  APIFY_TIKTOK_DEEP: { FREE: 0, PRO: 20, PRO_TEAM: 100, AGENCY: UNLIMITED },
  APIFY_SERP_RANK: { FREE: 0, PRO: 50, PRO_TEAM: 250, AGENCY: UNLIMITED },
  APIFY_COMPETITOR_ADS: { FREE: 0, PRO: 20, PRO_TEAM: 100, AGENCY: UNLIMITED },
  APIFY_LINKEDIN_COMPANY: { FREE: 0, PRO: 0, PRO_TEAM: 50, AGENCY: UNLIMITED },
  APIFY_REDDIT_MENTIONS: { FREE: 0, PRO: 20, PRO_TEAM: 100, AGENCY: UNLIMITED },
};

/**
 * Launch-policy limits. Every worker is available to every tier with
 * graduated monthly caps so FREE can test the product. Absolute caps
 * still protect against runaway Gemini spend.
 */
const LAUNCH_LIMITS: Record<AgentWorkerKind, Record<Plan, number>> = {
  WEBSITE_AUDITOR: { FREE: 100, PRO: 1000, PRO_TEAM: 5000, AGENCY: UNLIMITED },
  REVIEW_ANALYST: { FREE: 50, PRO: 500, PRO_TEAM: 2000, AGENCY: UNLIMITED },
  SALES_OPPORTUNITY_SCORER: { FREE: 100, PRO: 1000, PRO_TEAM: 5000, AGENCY: UNLIMITED },
  SOCIAL_SCRAPER: { FREE: 50, PRO: 500, PRO_TEAM: 2000, AGENCY: UNLIMITED },
  EMAIL_VERIFIER: { FREE: 50, PRO: 500, PRO_TEAM: 2000, AGENCY: UNLIMITED },

  WEBSITE_PLAN_GENERATOR: { FREE: 10, PRO: 50, PRO_TEAM: 200, AGENCY: UNLIMITED },
  WEBSITE_MOCKUP_GENERATOR: { FREE: 10, PRO: 50, PRO_TEAM: 200, AGENCY: UNLIMITED },
  OPENER_WRITER: { FREE: 50, PRO: 500, PRO_TEAM: 2000, AGENCY: UNLIMITED },
  VIDEO_SCRIPT_WRITER: { FREE: 10, PRO: 100, PRO_TEAM: 500, AGENCY: UNLIMITED },
  VOICE_NOTE_TRANSCRIBER: { FREE: 30, PRO: 300, PRO_TEAM: 1000, AGENCY: UNLIMITED },

  AI_RECEPTIONIST_BUILDER: { FREE: 5, PRO: 30, PRO_TEAM: 150, AGENCY: UNLIMITED },
  REVIEW_REPLY_AGENT: { FREE: 5, PRO: 30, PRO_TEAM: 150, AGENCY: UNLIMITED },
  LEAD_RESPONSE_AGENT: { FREE: 5, PRO: 30, PRO_TEAM: 150, AGENCY: UNLIMITED },
  BOOKING_WIDGET_BUILDER: { FREE: 5, PRO: 30, PRO_TEAM: 150, AGENCY: UNLIMITED },
  GBP_AUTOPOST_AGENT: { FREE: 3, PRO: 20, PRO_TEAM: 50, AGENCY: UNLIMITED },

  COPILOT_CHAT: { FREE: 20, PRO: 200, PRO_TEAM: 1000, AGENCY: UNLIMITED },
  INBOX_REPLY_ATTRIBUTOR: { FREE: UNLIMITED, PRO: UNLIMITED, PRO_TEAM: UNLIMITED, AGENCY: UNLIMITED },
  OUTREACH_SENDER: { FREE: 50, PRO: 500, PRO_TEAM: 2000, AGENCY: UNLIMITED },
  CONTAINMENT_RATE_TRACKER: { FREE: UNLIMITED, PRO: UNLIMITED, PRO_TEAM: UNLIMITED, AGENCY: UNLIMITED },

  // Apify enrichment at launch - still gated to paid plans because
  // each run costs real USD. FREE stays at 0; the button is disabled
  // at the UI layer with an upgrade CTA.
  APIFY_GMAPS_DEEP: { FREE: 0, PRO: 50, PRO_TEAM: 250, AGENCY: UNLIMITED },
  APIFY_WEB_CRAWL_DEEP: { FREE: 0, PRO: 50, PRO_TEAM: 250, AGENCY: UNLIMITED },
  APIFY_INSTAGRAM_DEEP: { FREE: 0, PRO: 30, PRO_TEAM: 200, AGENCY: UNLIMITED },
  APIFY_FACEBOOK_DEEP: { FREE: 0, PRO: 30, PRO_TEAM: 200, AGENCY: UNLIMITED },
  APIFY_TIKTOK_DEEP: { FREE: 0, PRO: 30, PRO_TEAM: 200, AGENCY: UNLIMITED },
  APIFY_SERP_RANK: { FREE: 0, PRO: 100, PRO_TEAM: 500, AGENCY: UNLIMITED },
  APIFY_COMPETITOR_ADS: { FREE: 0, PRO: 30, PRO_TEAM: 200, AGENCY: UNLIMITED },
  APIFY_LINKEDIN_COMPANY: { FREE: 0, PRO: 0, PRO_TEAM: 100, AGENCY: UNLIMITED },
  APIFY_REDDIT_MENTIONS: { FREE: 0, PRO: 30, PRO_TEAM: 200, AGENCY: UNLIMITED },
};

const LIMITS: Record<AgentWorkerKind, Record<Plan, number>> = LAUNCH_POLICY
  ? LAUNCH_LIMITS
  : CONSERVATIVE_LIMITS;

/**
 * Grace window for counting in-flight (PENDING/RUNNING) agent runs
 * against the quota. Rows older than this are assumed to be stuck
 * (queue or worker crashed without cleaning up) and excluded from the
 * counter, so a crashed worker cannot silently drain a workspace's
 * monthly budget. One hour is safely larger than any single worker's
 * wall clock time (Apify actors top out at ~15 minutes).
 */
const PENDING_GRACE_MS = 60 * 60 * 1000;

// Upper bound for UNLIMITED - real quota check still counts but this
// keeps one runaway workspace from exhausting Gemini quota. Above this
// we start throttling and alert. 50k per month per worker is safely
// beyond any legitimate agency usage.
const UNLIMITED_HARD_CAP = 50_000;

/**
 * Monthly per-workspace USD ceiling for Apify-backed enrichment
 * workers. Expressed in cents for integer arithmetic. Applied as a
 * second gate alongside the per-worker monthly count cap above; the
 * tighter one wins. Agency tier has a very generous cap rather than
 * unlimited to prevent a single account from blowing the whole Apify
 * bill if something goes wrong.
 */
const MONTHLY_APIFY_USD_CENTS: Record<Plan, number> = {
  FREE: 0,        // $0.00
  PRO: 500,       // $5.00
  PRO_TEAM: 2500, // $25.00
  AGENCY: 10000,  // $100.00
};

/**
 * All enrichment worker kinds whose cost rolls up into the shared
 * Apify USD cap. Kept as a constant array so adding a new Apify
 * worker in one place (registry) and one here flips the budget gate
 * on for it.
 */
const APIFY_KINDS: Set<AgentWorkerKind> = new Set([
  "APIFY_GMAPS_DEEP",
  "APIFY_WEB_CRAWL_DEEP",
  "APIFY_INSTAGRAM_DEEP",
  "APIFY_FACEBOOK_DEEP",
  "APIFY_TIKTOK_DEEP",
  "APIFY_SERP_RANK",
  "APIFY_COMPETITOR_ADS",
  "APIFY_LINKEDIN_COMPANY",
  "APIFY_REDDIT_MENTIONS",
]);

export function isApifyKind(kind: AgentWorkerKind): boolean {
  return APIFY_KINDS.has(kind);
}

export class QuotaExceededError extends Error {
  used: number;
  limit: number;
  kind: AgentWorkerKind;
  status = 402;
  constructor(used: number, limit: number, kind: AgentWorkerKind) {
    super(`Quota exceeded for ${kind}: ${used}/${limit}`);
    this.used = used;
    this.limit = limit;
    this.kind = kind;
  }
}

export class PlanTooLowError extends Error {
  kind: AgentWorkerKind;
  minPlan: Plan;
  status = 402;
  constructor(kind: AgentWorkerKind, minPlan: Plan) {
    super(`Worker ${kind} requires plan ${minPlan} or higher`);
    this.kind = kind;
    this.minPlan = minPlan;
  }
}

export interface QuotaCheckResult {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  resetAt: Date | null;
  /**
   * Populated only for Apify kinds: the current USD cents spent this
   * billing cycle and the per-plan ceiling. UI surfaces this as a
   * "Remaining enrichment budget: $4.25" indicator next to the deep
   * research button.
   */
  apifyCentsUsed?: number;
  apifyCentsLimit?: number;
}

export class ApifyBudgetExceededError extends Error {
  usedCents: number;
  limitCents: number;
  status = 402;
  constructor(usedCents: number, limitCents: number) {
    super(`Apify monthly USD budget exhausted: ${usedCents}¢/${limitCents}¢`);
    this.usedCents = usedCents;
    this.limitCents = limitCents;
  }
}

export class PerLeadDailyCapExceededError extends Error {
  leadId: string;
  used: number;
  limit: number;
  status = 402;
  constructor(leadId: string, used: number, limit: number) {
    super(`Daily per-lead cap exceeded for lead ${leadId}: ${used}/${limit}`);
    this.leadId = leadId;
    this.used = used;
    this.limit = limit;
  }
}

/**
 * Per-lead per-day AI run cap. Protects against a single lead
 * getting stuck in a retry loop or a UI bug firing the same chain
 * repeatedly, draining the workspace's monthly Apify/Gemini budget.
 * Gemini-only workers share this cap because a runaway loop on them
 * still costs real tokens.
 */
const PER_LEAD_DAILY_CAP = 50;

/**
 * Returns the monthly limit for a worker at the given plan, resolving
 * UNLIMITED to the soft hard cap.
 */
export function getLimit(kind: AgentWorkerKind, plan: Plan): number {
  const raw = LIMITS[kind]?.[plan] ?? 0;
  if (raw === UNLIMITED) return UNLIMITED_HARD_CAP;
  return raw;
}

/**
 * Returns current cycle usage + whether a new run is allowed. Does not
 * throw; callers decide how to respond (402 in API, error in worker).
 */
export async function checkWorkerQuota(args: {
  workspaceId: string;
  plan: Plan;
  kind: AgentWorkerKind;
  /**
   * When provided, the per-lead daily cap is also evaluated. Callers
   * from lead-scoped flows (planner chains, lead detail buttons) pass
   * this; workspace-scoped flows (copilot) leave it out.
   */
  leadId?: string | null;
}): Promise<QuotaCheckResult> {
  const worker = getWorker(args.kind);
  if (!worker) {
    return { allowed: false, used: 0, limit: 0, remaining: 0, resetAt: null };
  }
  if (!planMeetsMinimum(args.plan, worker.minPlan)) {
    return { allowed: false, used: 0, limit: 0, remaining: 0, resetAt: null };
  }
  const limit = getLimit(args.kind, args.plan);
  if (limit === 0) {
    return { allowed: false, used: 0, limit: 0, remaining: 0, resetAt: null };
  }

  const ws = await prisma.workspace.findUniqueOrThrow({
    where: { id: args.workspaceId },
    select: { cycleResetAt: true },
  });

  const pendingCutoff = new Date(Date.now() - PENDING_GRACE_MS);
  const used = await prisma.agentRun.count({
    where: {
      workspaceId: args.workspaceId,
      workerKind: args.kind,
      createdAt: { gte: ws.cycleResetAt },
      OR: [
        { status: "SUCCEEDED" },
        // In-flight work counts only while fresh. Stuck PENDING/RUNNING
        // rows (worker crashed, queue paused) are ignored so the same
        // stuck row cannot burn the quota forever.
        { status: { in: ["PENDING", "RUNNING"] }, createdAt: { gte: pendingCutoff } },
      ],
    },
  });

  const base: QuotaCheckResult = {
    allowed: used < limit,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    resetAt: ws.cycleResetAt,
  };

  // Per-lead daily cap. A runaway retry loop or UI bug firing the
  // same chain repeatedly on one lead would otherwise burn the whole
  // workspace monthly budget on a single place. Counted across ALL
  // worker kinds for the lead (not per-kind) so spreading runs
  // across kinds cannot bypass it.
  if (args.leadId) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const leadUsed = await prisma.agentRun.count({
      where: {
        workspaceId: args.workspaceId,
        leadId: args.leadId,
        status: { in: ["PENDING", "RUNNING", "SUCCEEDED"] },
        createdAt: { gte: since },
      },
    });
    if (leadUsed >= PER_LEAD_DAILY_CAP) {
      base.allowed = false;
    }
  }

  // Apify kinds: second gate on USD budget. Summed across ALL Apify
  // kinds in the same cycle; one workspace cannot bypass the cap by
  // spreading runs across actor types. Only SUCCEEDED rows carry a
  // real costUsdCents value (set on completion), so restricting to
  // SUCCEEDED both aligns with billing truth and avoids the stuck-row
  // quota drain described above.
  if (isApifyKind(args.kind)) {
    const apifyLimitCents = MONTHLY_APIFY_USD_CENTS[args.plan] ?? 0;
    const sum = await prisma.agentRun.aggregate({
      where: {
        workspaceId: args.workspaceId,
        workerKind: { in: Array.from(APIFY_KINDS) },
        status: "SUCCEEDED",
        createdAt: { gte: ws.cycleResetAt },
      },
      _sum: { costUsdCents: true },
    });
    const usedCents = sum._sum.costUsdCents ?? 0;
    base.apifyCentsUsed = usedCents;
    base.apifyCentsLimit = apifyLimitCents;
    if (usedCents >= apifyLimitCents) {
      base.allowed = false;
    }
  }

  return base;
}

/**
 * Throws PlanTooLowError or QuotaExceededError if the request cannot
 * proceed. Used by the API route to return a 402 response.
 */
export async function assertWorkerQuota(args: {
  workspaceId: string;
  plan: Plan;
  kind: AgentWorkerKind;
  leadId?: string | null;
}): Promise<QuotaCheckResult> {
  const worker = getWorker(args.kind);
  if (!worker) {
    throw new Error(`Unknown worker kind: ${args.kind}`);
  }
  if (!planMeetsMinimum(args.plan, worker.minPlan)) {
    throw new PlanTooLowError(args.kind, worker.minPlan);
  }
  const quota = await checkWorkerQuota(args);
  if (!quota.allowed) {
    // Distinguish Apify budget exhaustion so the UI can prompt the
    // user to upgrade or wait for cycle reset rather than a generic
    // "quota exceeded" message.
    if (
      isApifyKind(args.kind) &&
      quota.apifyCentsLimit !== undefined &&
      quota.apifyCentsUsed !== undefined &&
      quota.apifyCentsUsed >= quota.apifyCentsLimit
    ) {
      throw new ApifyBudgetExceededError(quota.apifyCentsUsed, quota.apifyCentsLimit);
    }
    // Distinguish per-lead daily cap so the UI can say "this lead
    // reached its daily AI budget; try another one or wait 24h".
    if (args.leadId) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const leadUsed = await prisma.agentRun.count({
        where: {
          workspaceId: args.workspaceId,
          leadId: args.leadId,
          status: { in: ["PENDING", "RUNNING", "SUCCEEDED"] },
          createdAt: { gte: since },
        },
      });
      if (leadUsed >= PER_LEAD_DAILY_CAP) {
        throw new PerLeadDailyCapExceededError(
          args.leadId,
          leadUsed,
          PER_LEAD_DAILY_CAP,
        );
      }
    }
    throw new QuotaExceededError(quota.used, quota.limit, args.kind);
  }
  return quota;
}
