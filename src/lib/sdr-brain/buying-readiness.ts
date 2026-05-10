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
import type {
  AccountTier,
  LeadTriggerType,
  SuggestedOffer,
} from "@/generated/prisma/client";

/**
 * SDR-Brain v2 Phase 3 — `BuyingReadinessInput` carries the v1 intel
 * narrative (ReviewAnalysis, SalesOpportunity, Account) so the BANT
 * dimensions are computed against the *full* signal set, not the
 * thin Lead-only baseline. Every new top-level field is optional so
 * Phase-1 call sites (and the tests that exercise the BALANCED chain
 * without enriched input) keep working unchanged.
 */
export interface BuyingReadinessInput {
  lead: {
    priceLevel: number | null;
    reviewCount: number | null;
    rating: number | null;
    hasWebsite: boolean;
    icpFitScore: number | null;
    /** Phase 3 — denormalised rollup from LEAD_INTELLIGENCE_BRIEF. */
    salesConfidence?: number | null;
    /** Phase 3 — ICP_SCORER reason narrative; opaque shape, only `length` is used. */
    icpReasons?: ReadonlyArray<unknown>;
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
  /**
   * Phase 3 — `ReviewAnalysis` intel. The pain phrases drive Need,
   * weaknessKpis percent-weighted-sum reinforces it, switchSignals
   * (operators publicly considering a vendor switch) drive Timing.
   * Null when the lead has no review corpus yet — the deriver treats
   * that as "no signal", not "no need".
   */
  reviewIntel?: {
    painPhrases: string[];
    weaknessKpis: Array<{ label: string; count?: number; percent?: number }>;
    switchSignals: string[];
    leadScore: number;
  } | null;
  /**
   * Phase 3 — `SalesOpportunity` intel. `likelyPainPoints` drives
   * Need, `reasonCodes` drives Timing (e.g. RECENTLY_OPENED →
   * timing boost), `suggestedOffer` drives Budget (SALES tier =
   * bigger budget signal), `opportunityScore` is a reasoning fallback.
   */
  salesOpportunity?: {
    likelyPainPoints: string[];
    reasonCodes: string[];
    opportunityScore: number;
    suggestedOffer: SuggestedOffer | null;
  } | null;
  /**
   * Phase 3 — `Account` rollup. Multi-location accounts have larger
   * budgets (Budget +) and clearer authority paths (Authority +).
   * `locationsCount` 0/1 = single-location operator; 3+ = chain.
   */
  account?: {
    locationsCount: number | null;
    tier: AccountTier | null;
  } | null;
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

  // Phase 3 — multi-location accounts have measurably higher
  // marketing/ops spend per dollar of revenue (the IT team can
  // amortise across sites).
  if (input.account?.locationsCount != null && input.account.locationsCount >= 3) {
    score += 15;
    reasons.push(`account spans ${input.account.locationsCount} locations (+15)`);
  }
  // Phase 3 — analyst-picked SuggestedOffer tier. SALES = boutique
  // multi-location pitch; GROWTH = mid-market; STARTER = entry. We
  // only reward the higher tiers because STARTER is the default and
  // shouldn't add signal.
  const offer = input.salesOpportunity?.suggestedOffer;
  if (offer === "SALES") {
    score += 10;
    reasons.push(`SuggestedOffer=SALES (premium tier) (+10)`);
  } else if (offer === "GROWTH") {
    score += 5;
    reasons.push(`SuggestedOffer=GROWTH (mid-market) (+5)`);
  }
  // Phase 3 — high review volume is a proxy for footfall, which is a
  // proxy for revenue, which is a proxy for budget. Gate to >= 200
  // so it sits above the existing >= 100 "established footfall"
  // bump (additive, both fire on busy operators).
  if (lead.reviewCount != null && lead.reviewCount >= 200) {
    score += 8;
    reasons.push(`${lead.reviewCount} reviews → high-volume operator (+8)`);
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

  // Phase 3 — Tier-1 accounts are known brands. Authority paths are
  // more legible (there's a real Marketing Director / Head of Digital
  // we can hunt for) even when the stakeholder map is empty.
  if (input.account?.tier === "TIER_1") {
    score += 15;
    reasons.push(`Tier-1 account — clearer authority path (+15)`);
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

  // ---- Phase 3 — v1 review intel ----
  // `painPhrases` and `weaknessKpis` are the structured customer-side
  // narrative for unmet need. They reinforce the trigger-driven
  // score without overwhelming it — each capped so a wall of negative
  // reviews can't single-handedly push need to 100.
  const review = input.reviewIntel;
  if (review) {
    const phraseDelta = Math.min(30, review.painPhrases.length * 4);
    if (phraseDelta > 0) {
      score += phraseDelta;
      reasons.push(
        `${review.painPhrases.length} pain phrases extracted from reviews (+${phraseDelta})`,
      );
    }
    const kpiPercentSum = review.weaknessKpis.reduce(
      (sum, k) => sum + (typeof k.percent === "number" ? k.percent : 0),
      0,
    );
    if (kpiPercentSum > 0) {
      const delta = Math.min(25, Math.round(kpiPercentSum * 0.4));
      if (delta > 0) {
        score += delta;
        reasons.push(
          `weakness KPIs sum-of-percent ${kpiPercentSum} (+${delta})`,
        );
      }
    }
  }

  // ---- Phase 3 — analyst-derived pain points ----
  const opp = input.salesOpportunity;
  if (opp && opp.likelyPainPoints.length > 0) {
    const delta = Math.min(18, opp.likelyPainPoints.length * 3);
    score += delta;
    reasons.push(
      `${opp.likelyPainPoints.length} likely pain points from analyst (+${delta})`,
    );
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

  // ---- Phase 3 — vendor-switch intent + recent-opening reason ----
  // `ReviewAnalysis.switchSignals` is operators publicly considering
  // a vendor switch (extracted by REVIEW_ANALYST). One match is
  // enough — this is a binary "are they shopping" indicator.
  if (input.reviewIntel && input.reviewIntel.switchSignals.length > 0) {
    score += 25;
    reasons.push(
      `${input.reviewIntel.switchSignals.length} vendor-switch signals in reviews (+25)`,
    );
  }
  // RECENTLY_OPENED is a SalesOpportunity.reasonCode that the scorer
  // sets when the lead has been live < 6 months. It's a strong timing
  // signal even without a LeadTrigger row.
  const reasonCodes = input.salesOpportunity?.reasonCodes ?? [];
  if (reasonCodes.includes("RECENTLY_OPENED")) {
    score += 20;
    reasons.push(`SalesOpportunity.reasonCodes RECENTLY_OPENED (+20)`);
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
