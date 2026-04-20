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
 * Counter semantics: we count `AgentRun` rows with status != FAILED
 * and status != CANCELLED, scoped to `(workspaceId, workerKind)` and
 * created within the current Stripe billing cycle. Cycle reset is
 * aligned with `workspace.cycleResetAt` (already tracked for the
 * lead-discovery quota) so users see one consistent "resets on X"
 * message across every meter.
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
};

const LIMITS: Record<AgentWorkerKind, Record<Plan, number>> = LAUNCH_POLICY
  ? LAUNCH_LIMITS
  : CONSERVATIVE_LIMITS;

// Upper bound for UNLIMITED - real quota check still counts but this
// keeps one runaway workspace from exhausting Gemini quota. Above this
// we start throttling and alert. 50k per month per worker is safely
// beyond any legitimate agency usage.
const UNLIMITED_HARD_CAP = 50_000;

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
}

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

  const used = await prisma.agentRun.count({
    where: {
      workspaceId: args.workspaceId,
      workerKind: args.kind,
      status: { notIn: ["FAILED", "CANCELLED"] },
      createdAt: { gte: ws.cycleResetAt },
    },
  });

  return {
    allowed: used < limit,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    resetAt: ws.cycleResetAt,
  };
}

/**
 * Throws PlanTooLowError or QuotaExceededError if the request cannot
 * proceed. Used by the API route to return a 402 response.
 */
export async function assertWorkerQuota(args: {
  workspaceId: string;
  plan: Plan;
  kind: AgentWorkerKind;
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
    throw new QuotaExceededError(quota.used, quota.limit, args.kind);
  }
  return quota;
}
