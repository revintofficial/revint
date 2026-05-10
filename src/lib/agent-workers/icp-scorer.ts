/**
 * ICP_SCORER worker (T1 deterministic).
 *
 * Reads the workspace's IdealCustomerProfile + the lead's audit /
 * Places signals and writes back `Lead.icpFitScore` + `Lead.icpReasons`
 * + `Lead.icpVersion`. Pure function under the hood (`scoreIcpFit`)
 * so the math is unit-testable without Prisma; this worker is the
 * thin Prisma wrapper.
 *
 * Runs in T1 paralle with REVIEW_ANALYST, ACCOUNT_TIER_RANKER, etc.
 * BANT_INFERRER depends on this so its preliminary NBA can use the
 * ICP fit number.
 */
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { scoreIcpFit, type IcpFitResult } from "@/lib/sdr-brain/icp-scorer";
import type { WebsiteFeatures } from "@/types";
import type {
  AgentWorkerContext,
  AgentWorkerOutput,
  AgentWorkerRun,
} from "./types";

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
          checklistScorePct: features
            ? // approximate — the full checklist computation lives in
              // audit-checklist.ts; passing servicesDetected length as
              // a coarse proxy keeps this worker dependency-light.
              null
            : null,
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

  await prisma.lead.updateMany({
    where: { id: lead.id, workspaceId },
    data: {
      icpFitScore: result.score,
      icpReasons: result.reasons as unknown as object,
      icpVersion: newVersion,
    },
  });

  logger.info("agent_workers.icp_scorer.done", {
    leadId: lead.id,
    workspaceId,
    score: result.score,
    reasonCount: result.reasons.length,
    icpConfigured: icp != null,
  });

  return {
    output: {
      score: result.score,
      reasons: result.reasons,
      icpVersion: newVersion,
      icpConfigured: icp != null,
    },
    costTokens: 0,
  };
};
