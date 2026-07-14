/**
 * ICP_SCORER worker (T1 deterministic).
 *
 * Reads the workspace's IdealCustomerProfile + the lead's audit /
 * Places signals and writes back `Lead.icpFitScore` + `Lead.icpReasons`
 * + `Lead.icpVersion`. Pure function under the hood (`scoreIcpFit`)
 * so the math is unit-testable without Prisma; this worker is the
 * thin Prisma wrapper.
 *
 * Runs in T1 parallel with REVIEW_ANALYST. The intelligence brief
 * consumes `Lead.icpFitScore` as the canonical fit signal for its
 * "Why They Are A Fit" narrative.
 */
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { scoreIcpFit, type IcpFitResult } from "@/lib/sdr-brain/icp-scorer";
import { runAuditChecklist } from "@/lib/audit-checklist";
import { isTruthLayerFlagEnabled } from "@/lib/feature-flags";
import type { WebsiteFeatures } from "@/types";
import type {
  AgentWorkerContext,
  AgentWorkerOutput,
  AgentWorkerRun,
} from "./types";

// =====================================================================
// Truth Layer v1 — T-A §3 "ICP-rozet single-source-of-truth" cap.
//
// The lead-detail UI renders an "ICP fit" rozet whose color is driven
// off `Lead.icpFitScore`. A high score with green styling tells the rep
// "go heavy on this one" — which is exactly the wrong signal when the
// lead's vertical is not on the workspace's target list. The cap below
// guarantees the rozet can NEVER turn green when the lead is outside
// the workspace's ICP, regardless of how strong the other signals
// (price match, high-value services, etc.) happen to be.
//
// `outsideIcp` is not yet a first-class concept inside `scoreIcpFit()`;
// per T-A plan-ambiguity guidance, we derive it from two proxies:
//   1. **No-niche-match** — the workspace HAS configured industry or
//      sub-niche weights, but `scoreIcpFit()` did NOT add a
//      `niche_weight_match` reason for this lead. That means the lead's
//      vertical isn't in the target list.
//   2. **Low-icp-fit-score (< 25)** — explicit fallback called out in
//      the T-A track prompt. Strong negative signals out-weighed every
//      positive contributor; even without a niche taxonomy, the rozet
//      should not surface as a confident match. (Below-25 is already
//      below the cap so the cap is a no-op, but the proxy still fires
//      the telemetry event so T-H Observability counts it.)
// =====================================================================

/**
 * Maximum persisted `icpFitScore` when the lead is outside the
 * workspace ICP. 49 sits one point below the UI's "neutral" threshold
 * (50) so the rozet renders as cool/grey, never green.
 */
export const ICP_ROZET_CAP = 49;

/** Below this raw score, the lead is treated as outsideIcp (proxy #2). */
export const ICP_LOW_FIT_PROXY_THRESHOLD = 25;

type IcpWeights = {
  industryWeights?: Record<string, number> | null;
  subNicheWeights?: Record<string, number> | null;
};

export interface OutsideIcpCheck {
  outsideIcp: boolean;
  reason: "no_niche_match" | "low_icp_fit_score" | null;
}

/**
 * Decide whether `result` represents a lead that falls outside the
 * workspace ICP. See module-level comment for the two proxies and
 * why we're using them instead of a dedicated `outsideIcp` flag.
 */
export function evaluateOutsideIcp(
  result: IcpFitResult,
  icp: IcpWeights | null,
): OutsideIcpCheck {
  const industryConfigured =
    icp != null &&
    icp.industryWeights != null &&
    Object.keys(icp.industryWeights).length > 0;
  const subNicheConfigured =
    icp != null &&
    icp.subNicheWeights != null &&
    Object.keys(icp.subNicheWeights).length > 0;
  const nicheConfigured = industryConfigured || subNicheConfigured;
  const nicheMatched = result.reasons.some(
    (r) => r.code === "niche_weight_match",
  );
  if (nicheConfigured && !nicheMatched) {
    return { outsideIcp: true, reason: "no_niche_match" };
  }
  if (result.score < ICP_LOW_FIT_PROXY_THRESHOLD) {
    return { outsideIcp: true, reason: "low_icp_fit_score" };
  }
  return { outsideIcp: false, reason: null };
}

/**
 * Apply the outside-ICP cap. Returns the score that should be
 * persisted (`<= ICP_ROZET_CAP` when `outsideIcp` is true, otherwise
 * the raw score unchanged) plus the check details so the caller can
 * emit `truth.icp_rozet.capped` telemetry.
 */
export function applyOutsideIcpCap(
  result: IcpFitResult,
  icp: IcpWeights | null,
): { cappedScore: number; check: OutsideIcpCheck } {
  const check = evaluateOutsideIcp(result, icp);
  if (!check.outsideIcp) {
    return { cappedScore: result.score, check };
  }
  return {
    cappedScore: Math.min(result.score, ICP_ROZET_CAP),
    check,
  };
}

export const run: AgentWorkerRun = async (
  ctx: AgentWorkerContext,
): Promise<AgentWorkerOutput> => {
  if (!ctx.lead) throw new Error("ICP_SCORER requires a lead context");
  const lead = ctx.lead;
  const workspaceId = ctx.workspaceId;

  const icp = await prisma.idealCustomerProfile.findUnique({
    where: { workspaceId },
  });

  const features = (lead.websiteAudit?.rawFeaturesJson as WebsiteFeatures | null) ?? null;

  // Phase 0 hot-fix — `checklistScorePct` was hard-wired to null,
  // which made the `digitalMaturityFloor` rule in `scoreIcpFit` dead
  // code (the rule deducts up to 25 points when checklistScorePct
  // falls below the configured floor). Run the deterministic audit
  // checklist against the same features blob the audit row carries,
  // then pass the percent through.
  //
  // The checklist self-skips for leads with no website / no features
  // so we only feed a real number when there's signal to score.
  const checklistScorePct =
    features && lead.websiteAudit
      ? runAuditChecklist(
          features,
          lead.hasWebsite,
          ctx.workspace.niche,
          lead.subNicheSlug,
        ).summary.scorePercent
      : null;

  const result: IcpFitResult = scoreIcpFit({
    icp: icp
      ? {
          industryWeights: (icp.industryWeights as Record<string, number>) ?? {},
          subNicheWeights: (icp.subNicheWeights as Record<string, number>) ?? {},
          priceLevelMin: icp.priceLevelMin,
          priceLevelMax: icp.priceLevelMax,
          minReviewCount: icp.minReviewCount,
          minRating: icp.minRating,
          digitalMaturityFloor: icp.digitalMaturityFloor,
          highValueSignals: icp.highValueSignals,
          negativeSignals: icp.negativeSignals,
          locationFit: (icp.locationFit as Record<string, unknown>) ?? {},
        }
      : null,
    lead: {
      nicheSlug: lead.nicheSlug,
      subNicheSlug: lead.subNicheSlug,
      priceLevel: lead.priceLevel,
      reviewCount: lead.reviewCount,
      rating: lead.rating,
      borough: lead.borough,
      primaryType: lead.primaryType,
    },
    audit: lead.websiteAudit
      ? {
          checklistScorePct,
          servicesDetected: Array.isArray(lead.websiteAudit.servicesDetected)
            ? (lead.websiteAudit.servicesDetected as string[])
            : [],
          hasBookingSystem: lead.websiteAudit.hasBookingSystem,
          hasEcommerce: lead.websiteAudit.hasEcommerce,
          hasContactForm: lead.websiteAudit.hasContactForm,
          mobileFriendlyGuess: lead.websiteAudit.mobileFriendlyGuess,
        }
      : null,
  });

  const newVersion = (icp?.version ?? 0);

  // Truth Layer T-A §3 — apply the ICP-rozet cap before persisting so
  // every downstream consumer (UI rozet, NBA decision tree, copilot
  // tools) sees the single capped value. Gated behind the same flag
  // as the NBA gates so the kill-switch flips both behaviors together.
  const flagEnabled = isTruthLayerFlagEnabled(
    "TRUTH_LAYER_DECISION_GATES",
    { workspaceId },
  );
  const rawScore = result.score;
  const { cappedScore, check } = flagEnabled
    ? applyOutsideIcpCap(
        result,
        icp
          ? {
              industryWeights: (icp.industryWeights as Record<string, number>) ?? {},
              subNicheWeights: (icp.subNicheWeights as Record<string, number>) ?? {},
            }
          : null,
      )
    : { cappedScore: rawScore, check: { outsideIcp: false, reason: null } as const };
  if (flagEnabled && cappedScore !== rawScore) {
    logger.info("[truth-telemetry]", {
      event: "truth.icp_rozet.capped",
      leadId: lead.id,
      workspaceId,
      rawScore,
      cappedScore,
    });
  }

  await prisma.lead.updateMany({
    where: { id: lead.id, workspaceId },
    data: {
      icpFitScore: cappedScore,
      icpReasons: result.reasons as unknown as object,
      icpVersion: newVersion,
    },
  });

  logger.info("agent_workers.icp_scorer.done", {
    leadId: lead.id,
    workspaceId,
    score: cappedScore,
    rawScore,
    outsideIcp: check.outsideIcp,
    outsideIcpReason: check.reason,
    reasonCount: result.reasons.length,
    icpConfigured: icp != null,
    checklistScorePct,
    digitalMaturityFloor: icp?.digitalMaturityFloor ?? null,
  });

  return {
    output: {
      score: cappedScore,
      rawScore,
      outsideIcp: check.outsideIcp,
      reasons: result.reasons,
      icpVersion: newVersion,
      icpConfigured: icp != null,
    },
    costTokens: 0,
  };
};
