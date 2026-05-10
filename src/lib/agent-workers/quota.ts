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
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { PLANS } from "@/lib/plans";
import { logger } from "@/lib/logger";
import { PermanentError } from "./errors";
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
  // SUBVERTICAL_CLASSIFIER is rule-first with a Gemini fallback only
  // for the ~25% ambiguous tail. The cap matches WEBSITE_AUDITOR
  // because we run one classifier per F&B / hybrid-niche lead.
  SUBVERTICAL_CLASSIFIER: { FREE: 50, PRO: 500, PRO_TEAM: 2000, AGENCY: UNLIMITED },
  SOCIAL_SCRAPER: { FREE: 20, PRO: 300, PRO_TEAM: 1500, AGENCY: UNLIMITED },
  EMAIL_VERIFIER: { FREE: 0, PRO: 500, PRO_TEAM: 2000, AGENCY: UNLIMITED },
  // GOOGLE_PLACES_REVIEWS is a thin Places API call (no Gemini, no
  // Apify). FREE gets a generous cap because the cost is a single
  // upstream API call already paid for by GOOGLE_PLACES_API_KEY.
  GOOGLE_PLACES_REVIEWS: { FREE: 100, PRO: 1000, PRO_TEAM: 5000, AGENCY: UNLIMITED },

  // Grup B - Pitch
  WEBSITE_PLAN_GENERATOR: { FREE: 5, PRO: 50, PRO_TEAM: 200, AGENCY: UNLIMITED },
  // WEBSITE_MOCKUP_GENERATOR is now part of the BALANCED preset so a
  // typical FREE workspace expects every newly ingested lead to get
  // one. Bumped from 3/30/150 so the cap matches the chain default —
  // a 4th lead silently skipping its mockup would be confusing.
  WEBSITE_MOCKUP_GENERATOR: { FREE: 20, PRO: 100, PRO_TEAM: 500, AGENCY: UNLIMITED },
  OPENER_WRITER: { FREE: 20, PRO: 300, PRO_TEAM: 1500, AGENCY: UNLIMITED },
  VIDEO_SCRIPT_WRITER: { FREE: 0, PRO: 50, PRO_TEAM: 200, AGENCY: UNLIMITED },
  VOICE_NOTE_TRANSCRIBER: { FREE: 10, PRO: 100, PRO_TEAM: 500, AGENCY: UNLIMITED },
  // LEAD_DOSSIER_GENERATOR is one Gemini call per lead but the worker
  // is cached on AgentRun, so re-clicks are free. FREE gets enough
  // headroom to dossier-up every lead in the pipeline once.
  LEAD_DOSSIER_GENERATOR: { FREE: 30, PRO: 300, PRO_TEAM: 1500, AGENCY: UNLIMITED },
  // LEAD_INTELLIGENCE_BRIEF runs once per lead at chain end; quota
  // mirrors the dossier limit because they fire 1:1 in BALANCED.
  LEAD_INTELLIGENCE_BRIEF: { FREE: 30, PRO: 300, PRO_TEAM: 1500, AGENCY: UNLIMITED },

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

  // SDR Brain v2 — T1 deterministic enrichers run on every lead so caps
  // mirror WEBSITE_AUDITOR. Pure-rule workers are cheap (no Gemini).
  ICP_SCORER: { FREE: 50, PRO: 500, PRO_TEAM: 2000, AGENCY: UNLIMITED },
  STAKEHOLDER_DISCOVERER: { FREE: 0, PRO: 100, PRO_TEAM: 500, AGENCY: UNLIMITED },
  ACCOUNT_TIER_RANKER: { FREE: 50, PRO: 500, PRO_TEAM: 2000, AGENCY: UNLIMITED },
  BANT_INFERRER: { FREE: 50, PRO: 500, PRO_TEAM: 2000, AGENCY: UNLIMITED },
  // T2 reasoners use one Gemini call each; cap matches OPENER_WRITER.
  TRIGGER_DETECTOR: { FREE: 30, PRO: 300, PRO_TEAM: 1500, AGENCY: UNLIMITED },
  COMMERCIAL_INSIGHT_MATCHER: { FREE: 50, PRO: 500, PRO_TEAM: 2000, AGENCY: UNLIMITED },
  WHY_NOW_SYNTHESIZER: { FREE: 30, PRO: 300, PRO_TEAM: 1500, AGENCY: UNLIMITED },
  BUYING_COMMITTEE_MAPPER: { FREE: 20, PRO: 200, PRO_TEAM: 1000, AGENCY: UNLIMITED },
  OBJECTION_PREDICTOR: { FREE: 30, PRO: 300, PRO_TEAM: 1500, AGENCY: UNLIMITED },
  // T5 event-driven extractors fire only on user actions (voice notes,
  // pipeline stage changes) so the cap reflects "active deals", not
  // "every lead in the workspace".
  MEDDPICC_EXTRACTOR: { FREE: 10, PRO: 100, PRO_TEAM: 500, AGENCY: UNLIMITED },
  SPIN_EXTRACTOR: { FREE: 10, PRO: 100, PRO_TEAM: 500, AGENCY: UNLIMITED },
  // Closed-loop attribution is event-driven and very cheap (no Gemini).
  OUTCOME_ATTRIBUTOR: { FREE: UNLIMITED, PRO: UNLIMITED, PRO_TEAM: UNLIMITED, AGENCY: UNLIMITED },
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
  SUBVERTICAL_CLASSIFIER: { FREE: 100, PRO: 1000, PRO_TEAM: 5000, AGENCY: UNLIMITED },
  SOCIAL_SCRAPER: { FREE: 50, PRO: 500, PRO_TEAM: 2000, AGENCY: UNLIMITED },
  EMAIL_VERIFIER: { FREE: 50, PRO: 500, PRO_TEAM: 2000, AGENCY: UNLIMITED },
  GOOGLE_PLACES_REVIEWS: { FREE: 200, PRO: 2000, PRO_TEAM: 10000, AGENCY: UNLIMITED },

  WEBSITE_PLAN_GENERATOR: { FREE: 10, PRO: 50, PRO_TEAM: 200, AGENCY: UNLIMITED },
  // BALANCED preset auto-generates a mockup per lead (see
  // `getDefaultChain`), so the FREE cap needs to comfortably cover a
  // small evaluation cohort without users hitting "skipped: quota".
  WEBSITE_MOCKUP_GENERATOR: { FREE: 20, PRO: 100, PRO_TEAM: 500, AGENCY: UNLIMITED },
  OPENER_WRITER: { FREE: 50, PRO: 500, PRO_TEAM: 2000, AGENCY: UNLIMITED },
  VIDEO_SCRIPT_WRITER: { FREE: 10, PRO: 100, PRO_TEAM: 500, AGENCY: UNLIMITED },
  VOICE_NOTE_TRANSCRIBER: { FREE: 30, PRO: 300, PRO_TEAM: 1000, AGENCY: UNLIMITED },
  LEAD_DOSSIER_GENERATOR: { FREE: 50, PRO: 500, PRO_TEAM: 2000, AGENCY: UNLIMITED },
  LEAD_INTELLIGENCE_BRIEF: { FREE: 50, PRO: 500, PRO_TEAM: 2000, AGENCY: UNLIMITED },

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

  // SDR Brain v2 launch caps. Generous on FREE so design partners can
  // exercise the brain end-to-end without hitting WORKER_DISABLED.
  ICP_SCORER: { FREE: 100, PRO: 1000, PRO_TEAM: 5000, AGENCY: UNLIMITED },
  STAKEHOLDER_DISCOVERER: { FREE: 30, PRO: 200, PRO_TEAM: 1000, AGENCY: UNLIMITED },
  ACCOUNT_TIER_RANKER: { FREE: 100, PRO: 1000, PRO_TEAM: 5000, AGENCY: UNLIMITED },
  BANT_INFERRER: { FREE: 100, PRO: 1000, PRO_TEAM: 5000, AGENCY: UNLIMITED },
  TRIGGER_DETECTOR: { FREE: 50, PRO: 500, PRO_TEAM: 2000, AGENCY: UNLIMITED },
  COMMERCIAL_INSIGHT_MATCHER: { FREE: 100, PRO: 1000, PRO_TEAM: 5000, AGENCY: UNLIMITED },
  WHY_NOW_SYNTHESIZER: { FREE: 50, PRO: 500, PRO_TEAM: 2000, AGENCY: UNLIMITED },
  BUYING_COMMITTEE_MAPPER: { FREE: 30, PRO: 300, PRO_TEAM: 1500, AGENCY: UNLIMITED },
  OBJECTION_PREDICTOR: { FREE: 50, PRO: 500, PRO_TEAM: 2000, AGENCY: UNLIMITED },
  MEDDPICC_EXTRACTOR: { FREE: 20, PRO: 200, PRO_TEAM: 1000, AGENCY: UNLIMITED },
  SPIN_EXTRACTOR: { FREE: 20, PRO: 200, PRO_TEAM: 1000, AGENCY: UNLIMITED },
  OUTCOME_ATTRIBUTOR: { FREE: UNLIMITED, PRO: UNLIMITED, PRO_TEAM: UNLIMITED, AGENCY: UNLIMITED },
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

// Round 2 §3.6 — quota error taxonomy. All four extend PermanentError
// so BullMQ's `agent-runs` worker treats them as terminal (1 attempt
// instead of the default 3). Burning two extra retries on a quota
// failure is wasted Gemini / Apify cost; the user has to upgrade or
// wait for cycle reset before any retry can succeed anyway.
export class QuotaExceededError extends PermanentError {
  used: number;
  limit: number;
  kind: AgentWorkerKind;
  status = 402;
  constructor(used: number, limit: number, kind: AgentWorkerKind) {
    super(`Quota exceeded for ${kind}: ${used}/${limit}`, "quota");
    this.name = "QuotaExceededError";
    this.used = used;
    this.limit = limit;
    this.kind = kind;
  }
}

export class PlanTooLowError extends PermanentError {
  kind: AgentWorkerKind;
  minPlan: Plan;
  status = 402;
  constructor(kind: AgentWorkerKind, minPlan: Plan) {
    super(`Worker ${kind} requires plan ${minPlan} or higher`, "plan");
    this.name = "PlanTooLowError";
    this.kind = kind;
    this.minPlan = minPlan;
  }
}

export class ApifyBudgetExceededError extends PermanentError {
  usedCents: number;
  limitCents: number;
  status = 402;
  constructor(usedCents: number, limitCents: number) {
    super(
      `Apify monthly USD budget exhausted: ${usedCents}¢/${limitCents}¢`,
      "quota",
    );
    this.name = "ApifyBudgetExceededError";
    this.usedCents = usedCents;
    this.limitCents = limitCents;
  }
}

export class PerLeadDailyCapExceededError extends PermanentError {
  leadId: string;
  used: number;
  limit: number;
  status = 402;
  constructor(leadId: string, used: number, limit: number) {
    super(
      `Daily per-lead cap exceeded for lead ${leadId}: ${used}/${limit}`,
      "quota",
    );
    this.name = "PerLeadDailyCapExceededError";
    this.leadId = leadId;
    this.used = used;
    this.limit = limit;
  }
}

/**
 * Round 2 §3.6 — discriminated reason for a quota block. Surfaced on
 * `QuotaCheckResult.blockReason` so `assertWorkerQuota` can fan out
 * into the right error class (and the UI can render the right copy)
 * without re-running the same SQL again. `null` means the request is
 * allowed.
 */
export type QuotaBlockReason =
  | "WORKER_MONTHLY_QUOTA"
  | "PER_LEAD_DAILY_CAP"
  | "APIFY_USD_BUDGET"
  | "PLAN_TOO_LOW"
  | "WORKER_DISABLED"
  | null;

export interface QuotaCheckResult {
  allowed: boolean;
  /**
   * Round 2 §3.6 — the specific gate that fired (or `null` when
   * allowed). Distinct from the legacy `allowed` flag because the UI
   * needs separate copy for "your account is on the wrong plan" vs
   * "this lead has hit its daily AI budget" vs "your $25 Apify
   * envelope for this cycle is empty".
   */
  blockReason: QuotaBlockReason;
  /** Worker-monthly counter (legacy `used` / `limit`). */
  used: number;
  limit: number;
  remaining: number;
  resetAt: Date | null;
  /**
   * Round 2 §3.6 — explicit field aliases so the UI / API doesn't have
   * to know which counter was the binding constraint. `workerMonthly*`
   * mirrors `used` / `limit`; `perLeadDaily*` is populated when the
   * call carries `leadId`.
   */
  workerMonthlyUsed: number;
  workerMonthlyLimit: number;
  perLeadDailyUsed: number | null;
  perLeadDailyLimit: number | null;
  /**
   * Populated only for Apify kinds: the current USD cents spent this
   * billing cycle and the per-plan ceiling. UI surfaces this as a
   * "Remaining enrichment budget: $4.25" indicator next to the deep
   * research button.
   */
  apifyCentsUsed?: number;
  apifyCentsLimit?: number;
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
 *
 * M4 - WEBSITE_MOCKUP_GENERATOR's monthly cap is the customer-facing
 * "X website mockups / month" number on the pricing page, which lives
 * in PLANS[plan].mockupsPerCycle. The two used to drift (this table
 * said 20/100/500 while pricing copy said 3/50/150/300), letting users
 * generate ~3x what they paid for. We now derive the limit from PLANS
 * so the pricing page is the single source of truth and any future
 * tier change only has to be made in one place.
 */
export function getLimit(kind: AgentWorkerKind, plan: Plan): number {
  if (kind === "WEBSITE_MOCKUP_GENERATOR") {
    const raw = PLANS[plan]?.mockupsPerCycle ?? 0;
    if (raw === UNLIMITED) return UNLIMITED_HARD_CAP;
    return raw;
  }
  const raw = LIMITS[kind]?.[plan] ?? 0;
  if (raw === UNLIMITED) return UNLIMITED_HARD_CAP;
  return raw;
}

/**
 * Round 2 §3.6 — terminal counts that consume monthly / per-lead /
 * Apify-USD quota. Both completion variants (`SUCCEEDED` and
 * `SUCCEEDED_NO_MEMORY`) get charged: a degraded run still produced a
 * Gemini call and may have spent Apify cents, so excluding it would
 * let a workspace silently burn double its budget by repeatedly
 * triggering the embedding-degraded path.
 */
const TERMINAL_BILLABLE_STATUSES = ["SUCCEEDED", "SUCCEEDED_NO_MEMORY"] as const;

const PER_LEAD_BILLABLE_STATUSES = [
  "PENDING",
  "RUNNING",
  "SUCCEEDED",
  "SUCCEEDED_NO_MEMORY",
] as const;

/**
 * Returns current cycle usage + whether a new run is allowed. Does not
 * throw; callers decide how to respond (402 in API, error in worker).
 *
 * Round 2 §3.6 — every counter is now resolved inside a single
 * `RepeatableRead` snapshot so two concurrent calls cannot both see
 * `used = limit - 1` and both succeed (the legacy implementation read
 * each counter via a separate query and was vulnerable to that race).
 *
 * pgBouncer note: the project uses Supabase + pgBouncer in
 * transaction-pool mode. RepeatableRead works across multiple
 * statements within a single Prisma `$transaction(async tx => {...})`
 * because Prisma pins the underlying connection for the whole
 * callback. If the deploy environment ever switches to "session" mode
 * pooler with a different proxy, fall back to the sequential reads
 * path — the snapshot semantics are nice-to-have, not load-bearing
 * (the per-lead cap is the primary defense against runaway loops).
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
    return blockedResult("WORKER_DISABLED");
  }
  if (!planMeetsMinimum(args.plan, worker.minPlan)) {
    return blockedResult("PLAN_TOO_LOW");
  }
  const limit = getLimit(args.kind, args.plan);
  if (limit === 0) {
    return blockedResult("WORKER_DISABLED");
  }

  const ws = await prisma.workspace.findUniqueOrThrow({
    where: { id: args.workspaceId },
    select: { cycleResetAt: true },
  });

  const pendingCutoff = new Date(Date.now() - PENDING_GRACE_MS);
  const dayCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const isApify = isApifyKind(args.kind);
  const apifyLimitCents = isApify
    ? MONTHLY_APIFY_USD_CENTS[args.plan] ?? 0
    : 0;

  // Round 2 §3.6 — single transaction snapshot. We build all 3
  // counters (worker-monthly, per-lead-daily, apify-cents-cycle)
  // against the same MVCC snapshot so concurrent calls cannot both
  // observe usage one row below the limit. Each counter is conditional
  // on its own input (`leadId`, `isApify`) but the transaction body
  // unconditionally returns the tuple shape so TypeScript can destructure.
  const snapshot = await prisma.$transaction(
    async (tx) => {
      const monthly = await tx.agentRun.count({
        where: {
          workspaceId: args.workspaceId,
          workerKind: args.kind,
          createdAt: { gte: ws.cycleResetAt },
          OR: [
            { status: { in: [...TERMINAL_BILLABLE_STATUSES] } },
            // In-flight work counts only while fresh. Stuck PENDING/RUNNING
            // rows (worker crashed, queue paused) are ignored so the same
            // stuck row cannot burn the quota forever.
            {
              status: { in: ["PENDING", "RUNNING"] },
              createdAt: { gte: pendingCutoff },
            },
          ],
        },
      });

      const perLead = args.leadId
        ? await tx.agentRun.count({
            where: {
              workspaceId: args.workspaceId,
              leadId: args.leadId,
              // Round 2 §3.6 — include `SUCCEEDED_NO_MEMORY` so a
              // runaway loop that repeatedly hits the embedding-
              // degraded path can no longer hide from the per-lead
              // cap (was the main "44/50000 quota exceeded" UX bug).
              status: { in: [...PER_LEAD_BILLABLE_STATUSES] },
              createdAt: { gte: dayCutoff },
            },
          })
        : null;

      const apifyCents = isApify
        ? (
            await tx.agentRun.aggregate({
              where: {
                workspaceId: args.workspaceId,
                workerKind: { in: Array.from(APIFY_KINDS) },
                createdAt: { gte: ws.cycleResetAt },
                OR: [
                  { status: { in: [...TERMINAL_BILLABLE_STATUSES] } },
                  {
                    status: { in: ["PENDING", "RUNNING"] },
                    createdAt: { gte: pendingCutoff },
                  },
                ],
              },
              _sum: { costUsdCents: true },
            })
          )._sum.costUsdCents ?? 0
        : 0;

      return { monthly, perLead, apifyCents };
    },
    {
      // Race-free snapshot of the three counters. See doc above for
      // the pgBouncer caveat.
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    },
  ).catch((err) => {
    // pgBouncer transaction-pool mode rejects RepeatableRead with
    // SQLSTATE 0A000 ("feature not supported"). Fall back to the
    // sequential reads path so the deploy environment doesn't break
    // the gate entirely. We log so we know if the fallback fires more
    // than expected.
    if (err instanceof Error && /isolation/i.test(err.message)) {
      logger.warn("quota.snapshot.isolation_unsupported", {
        message: err.message,
        kind: args.kind,
      });
      return null;
    }
    throw err;
  });

  let monthly: number;
  let perLead: number | null;
  let apifyCents: number;

  if (snapshot) {
    ({ monthly, perLead, apifyCents } = snapshot);
  } else {
    // Sequential fallback (see catch above).
    monthly = await prisma.agentRun.count({
      where: {
        workspaceId: args.workspaceId,
        workerKind: args.kind,
        createdAt: { gte: ws.cycleResetAt },
        OR: [
          { status: { in: [...TERMINAL_BILLABLE_STATUSES] } },
          {
            status: { in: ["PENDING", "RUNNING"] },
            createdAt: { gte: pendingCutoff },
          },
        ],
      },
    });
    perLead = args.leadId
      ? await prisma.agentRun.count({
          where: {
            workspaceId: args.workspaceId,
            leadId: args.leadId,
            status: { in: [...PER_LEAD_BILLABLE_STATUSES] },
            createdAt: { gte: dayCutoff },
          },
        })
      : null;
    apifyCents = isApify
      ? (
          await prisma.agentRun.aggregate({
            where: {
              workspaceId: args.workspaceId,
              workerKind: { in: Array.from(APIFY_KINDS) },
              createdAt: { gte: ws.cycleResetAt },
              OR: [
                { status: { in: [...TERMINAL_BILLABLE_STATUSES] } },
                {
                  status: { in: ["PENDING", "RUNNING"] },
                  createdAt: { gte: pendingCutoff },
                },
              ],
            },
            _sum: { costUsdCents: true },
          })
        )._sum.costUsdCents ?? 0
      : 0;
  }

  // Resolve the binding constraint. Order matters: per-lead cap binds
  // first because it's the user-facing "this lead burned its budget"
  // copy; Apify USD next; worker-monthly last. A request that would
  // fail multiple gates reports the most specific (most-narrowly-
  // scoped) one so the UI's upgrade CTA matches the actual blocker.
  let blockReason: QuotaBlockReason = null;
  if (perLead != null && perLead >= PER_LEAD_DAILY_CAP) {
    blockReason = "PER_LEAD_DAILY_CAP";
  } else if (isApify && apifyCents >= apifyLimitCents) {
    blockReason = "APIFY_USD_BUDGET";
  } else if (monthly >= limit) {
    blockReason = "WORKER_MONTHLY_QUOTA";
  }

  const result: QuotaCheckResult = {
    allowed: blockReason === null,
    blockReason,
    used: monthly,
    limit,
    remaining: Math.max(0, limit - monthly),
    resetAt: ws.cycleResetAt,
    workerMonthlyUsed: monthly,
    workerMonthlyLimit: limit,
    perLeadDailyUsed: perLead,
    perLeadDailyLimit: args.leadId ? PER_LEAD_DAILY_CAP : null,
  };
  if (isApify) {
    result.apifyCentsUsed = apifyCents;
    result.apifyCentsLimit = apifyLimitCents;
  }
  return result;
}

function blockedResult(reason: QuotaBlockReason): QuotaCheckResult {
  return {
    allowed: false,
    blockReason: reason,
    used: 0,
    limit: 0,
    remaining: 0,
    resetAt: null,
    workerMonthlyUsed: 0,
    workerMonthlyLimit: 0,
    perLeadDailyUsed: null,
    perLeadDailyLimit: null,
  };
}

/**
 * Round 2 §3.6 — fans `checkWorkerQuota` out into the right error
 * class via the `blockReason` discriminator. Every quota class is now
 * a `PermanentError` (defined above), so BullMQ's agent-runs worker
 * skips retries for these and the caller's HTTP layer can map them to
 * 402 with the correct upgrade copy.
 *
 * No extra DB queries: `checkWorkerQuota` already populated
 * `perLeadDailyUsed` / `apifyCentsUsed` inside the snapshot, so we
 * read them directly from the result rather than re-running the same
 * count (which was the legacy bug — the second count could observe a
 * different value and disagree with the gate).
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
  if (quota.allowed) return quota;

  switch (quota.blockReason) {
    case "PLAN_TOO_LOW":
      throw new PlanTooLowError(args.kind, worker.minPlan);
    case "PER_LEAD_DAILY_CAP":
      throw new PerLeadDailyCapExceededError(
        args.leadId ?? "unknown",
        quota.perLeadDailyUsed ?? 0,
        quota.perLeadDailyLimit ?? PER_LEAD_DAILY_CAP,
      );
    case "APIFY_USD_BUDGET":
      throw new ApifyBudgetExceededError(
        quota.apifyCentsUsed ?? 0,
        quota.apifyCentsLimit ?? 0,
      );
    case "WORKER_MONTHLY_QUOTA":
      throw new QuotaExceededError(
        quota.workerMonthlyUsed,
        quota.workerMonthlyLimit,
        args.kind,
      );
    case "WORKER_DISABLED":
      // Worker is locked at this plan (limit = 0). Surface as a plan
      // upgrade prompt rather than a generic quota error.
      throw new PlanTooLowError(args.kind, worker.minPlan);
    case null:
      // checkWorkerQuota disagreed with itself (allowed=false +
      // blockReason=null). This is a bug in this file, not user
      // error — fail closed with the legacy quota error so we still
      // refuse the request.
      logger.error("quota.assert.allowed_false_no_reason", {
        kind: args.kind,
        used: quota.workerMonthlyUsed,
        limit: quota.workerMonthlyLimit,
      });
      throw new QuotaExceededError(
        quota.workerMonthlyUsed,
        quota.workerMonthlyLimit,
        args.kind,
      );
  }
}
