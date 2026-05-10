/**
 * SDR Brain v2 — BANT (Budget, Authority, Need, Timing) deriver.
 *
 * BANT is intentionally NOT a persistent table. Each component is a
 * pure function of inputs the system already stores (Lead.priceLevel,
 * Stakeholder rows, LeadTrigger rows, audit signals). Caching it would
 * force a tricky invalidation contract on every upstream change; the
 * function is fast enough to call on every render.
 *
 * Use sites:
 *   1. `BANT_INFERRER` worker (T1) — calls this synchronously after
 *      the audit + ICP_SCORER complete and writes a preliminary
 *      `LeadNextAction` so the UI can render an NBA card within ~3-5s.
 *   2. `SDR_BRAIN` (T3) — calls this inside `loadT2Snapshot` so the
 *      arbitration prompt can read BANT alongside the other reasoners.
 *   3. UI lead detail page — calls this in a React `cache()` so the
 *      "Buying Readiness" card hydrates on first paint.
 *
 * Outputs:
 *   - Each dimension is 0..100 (whole number).
 *   - `overall` is a weighted blend (need + timing weighted higher
 *     because they're more actionable than budget/authority for cold
 *     outreach scoring).
 *   - `reasoning` is a short prose breakdown the UI surfaces in a
 *     tooltip + drives the `bant` snapshot fed to the contradiction
 *     detector.
 */
import type { LeadTriggerType } from "@/generated/prisma/client";

export interface BuyingReadinessInput {
  lead: {
    priceLevel: number | null;
    reviewCount: number | null;
    rating: number | null;
    hasWebsite: boolean;
    icpFitScore: number | null;
  };
  audit: {
    checklistScorePct: number | null;
    hasBookingSystem: boolean | null;
    hasEcommerce: boolean | null;
    mobileFriendlyGuess: boolean | null;
  } | null;
  triggers: Array<{
    type: LeadTriggerType;
    severity: number;
    confidence: number;
    detectedAt: Date;
    urgencyWindowDays: number | null;
  }>;
  stakeholders: Array<{
    isEconomicBuyer: boolean;
    championLikelihood: number | null;
    influence: number | null;
  }>;
  /** Recent intent signals — voice notes, replies. Just the count. */
  recentIntentSignalCount: number;
  /**
   * Workspace-level expected price band so a $50/mo SaaS doesn't score
   * the same lead the same way a $5k/mo enterprise pitch does. Free-form;
   * we only branch on rough magnitude.
   */
  workspaceExpectedDealSize?: "low" | "medium" | "high";
}

export interface BuyingReadinessReasoning {
  budget: string[];
  authority: string[];
  need: string[];
  timing: string[];
}

export interface BuyingReadiness {
  budget: number;
  authority: number;
  need: number;
  timing: number;
  overall: number;
  reasoning: BuyingReadinessReasoning;
}

const TRIGGER_NEED_WEIGHTS: Partial<Record<LeadTriggerType, number>> = {
  BAD_SERVICE_REVIEWS: 22,
  RATING_DROP: 18,
  COMPETITOR_PRESSURE: 14,
  MENU_REDESIGN_SIGNAL: 18,
  BOOKING_PROVIDER_CHANGE: 25,
  HIRING_MARKETING: 12,
  HIRING_OPS: 8,
  REBRANDING: 12,
};

const TRIGGER_TIMING_WEIGHTS: Partial<Record<LeadTriggerType, number>> = {
  NEW_LOCATION_OPENING: 30,
  CHAIN_EXPANSION: 24,
  FUNDING_RAISED: 24,
  EXEC_CHANGE: 20,
  REBRANDING: 22,
  SEASONAL_TOURISM: 14,
  DELIVERY_EXPANSION: 18,
  INTERNATIONAL_AUDIENCE_GROWTH: 14,
  HIRING_MARKETING: 14,
  HIRING_TECH: 10,
};

function clamp(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function deriveBudget(input: BuyingReadinessInput): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 30; // baseline — nothing known
  const { lead } = input;

  if (lead.priceLevel != null) {
    // Google Places priceLevel 0..4. 3+ ≈ premium establishments,
    // who tend to have larger marketing budgets.
    const delta = lead.priceLevel * 12; // 0/12/24/36/48
    score += delta;
    reasons.push(`priceLevel=${lead.priceLevel} (+${delta})`);
  }
  if (lead.reviewCount != null && lead.reviewCount >= 100) {
    score += 8;
    reasons.push(`${lead.reviewCount} reviews → established footfall (+8)`);
  }
  if (lead.icpFitScore != null && lead.icpFitScore >= 70) {
    score += 6;
    reasons.push(`ICP fit ${lead.icpFitScore} → matches workspace target (+6)`);
  }
  if (input.workspaceExpectedDealSize === "low") {
    // Low-ACV pitches don't need a big budget signal — flatten the
    // distribution upward so a corner cafe doesn't show 30 just
    // because its priceLevel is null.
    score += 10;
  }
  return { score: clamp(score), reasons };
}

function deriveAuthority(input: BuyingReadinessInput): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 25;
  const ec = input.stakeholders.find((s) => s.isEconomicBuyer);
  if (ec) {
    score += 35;
    reasons.push(`Economic buyer mapped (+35)`);
  }
  const champ = input.stakeholders
    .map((s) => s.championLikelihood ?? 0)
    .reduce((m, v) => Math.max(m, v), 0);
  if (champ > 0) {
    const champDelta = Math.round(champ * 0.3); // championLikelihood 0..100 → +0..30
    score += champDelta;
    reasons.push(`Strongest champion likelihood ${champ} (+${champDelta})`);
  }
  if (input.stakeholders.length === 0) {
    reasons.push(`No stakeholders mapped — authority unknown`);
    score = Math.min(score, 35);
  }
  return { score: clamp(score), reasons };
}

function deriveNeed(input: BuyingReadinessInput): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 20;
  const { audit, lead, triggers } = input;

  // Audit gaps → unmet need.
  if (audit && audit.checklistScorePct != null) {
    const gap = 100 - audit.checklistScorePct;
    const delta = Math.round(gap * 0.3); // 0..30
    score += delta;
    reasons.push(`Audit gap ${gap}% (+${delta})`);
  }
  if (audit?.hasBookingSystem === false) {
    score += 8;
    reasons.push(`No booking system on site (+8)`);
  }
  if (audit?.mobileFriendlyGuess === false) {
    score += 6;
    reasons.push(`Not mobile-friendly (+6)`);
  }
  if (lead.rating != null && lead.rating < 3.8 && (lead.reviewCount ?? 0) >= 20) {
    const delta = Math.round((4.5 - lead.rating) * 8);
    score += delta;
    reasons.push(`Rating ${lead.rating} below 4★ floor (+${delta})`);
  }

  // Triggers contribute weighted need.
  for (const t of triggers) {
    const weight = TRIGGER_NEED_WEIGHTS[t.type];
    if (!weight) continue;
    // Severity 0..100 scales the contribution; confidence dampens it
    // so a low-confidence trigger doesn't run away with the score.
    const delta = Math.round((weight * (t.severity / 100)) * t.confidence);
    if (delta <= 0) continue;
    score += delta;
    reasons.push(`Trigger ${t.type} (sev=${t.severity}, conf=${t.confidence.toFixed(2)}) (+${delta})`);
  }
  return { score: clamp(score), reasons };
}

function deriveTiming(input: BuyingReadinessInput): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 15;
  const { triggers } = input;

  // Time-decay each trigger's contribution: a 30-day-old trigger with
  // a 60-day urgency window still adds half what a fresh one would.
  const now = Date.now();
  for (const t of triggers) {
    const weight = TRIGGER_TIMING_WEIGHTS[t.type];
    if (!weight) continue;
    const ageDays = Math.max(0, (now - t.detectedAt.getTime()) / (24 * 60 * 60 * 1000));
    const window = t.urgencyWindowDays ?? 60;
    const decay = Math.max(0, 1 - ageDays / window);
    const delta = Math.round(weight * decay * t.confidence);
    if (delta <= 0) continue;
    score += delta;
    reasons.push(`Trigger ${t.type} (decay=${decay.toFixed(2)}) (+${delta})`);
  }
  if (input.recentIntentSignalCount > 0) {
    const delta = Math.min(20, input.recentIntentSignalCount * 6);
    score += delta;
    reasons.push(`${input.recentIntentSignalCount} recent intent signals (+${delta})`);
  }
  return { score: clamp(score), reasons };
}

/**
 * Pure function — same input always produces same output. Used in
 * production AND in unit tests AND in the React Server Component for
 * the lead detail page (wrapped in `cache()`).
 */
export function deriveBuyingReadiness(input: BuyingReadinessInput): BuyingReadiness {
  const budget = deriveBudget(input);
  const authority = deriveAuthority(input);
  const need = deriveNeed(input);
  const timing = deriveTiming(input);

  // Need + timing weighted higher because they drive the "should I
  // outreach NOW" decision more than budget/authority do for cold
  // outreach. SDR_BRAIN may override this for warm leads.
  const overall = clamp(
    budget.score * 0.2 +
      authority.score * 0.2 +
      need.score * 0.3 +
      timing.score * 0.3,
  );

  return {
    budget: budget.score,
    authority: authority.score,
    need: need.score,
    timing: timing.score,
    overall,
    reasoning: {
      budget: budget.reasons,
      authority: authority.reasons,
      need: need.reasons,
      timing: timing.reasons,
    },
  };
}
