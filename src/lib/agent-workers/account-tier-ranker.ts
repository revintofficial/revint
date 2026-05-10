/**
 * ACCOUNT_TIER_RANKER worker (T1 deterministic).
 *
 * Computes a 0-100 strategic value for the lead's `Account` and assigns
 * a `tier` bucket. When the lead has no account row, the worker is a
 * no-op (logs + returns). When the account is brand new, it back-fills
 * `locationsCount` from the count of leads sharing the account, then
 * computes the rank.
 *
 * Heuristic (deterministic, no Gemini):
 *   - Locations count       → 0..30  (sqrt-scaled)
 *   - Avg ICP fit score     → 0..30
 *   - Avg sales confidence  → 0..20
 *   - Has primary contact   → 0..10
 *   - Has multiple sub-niches (chain breadth) → 0..10
 *
 * Tiering:
 *   strategicValue >= 75 → TIER_1
 *               >= 55 → TIER_2
 *               >= 30 → TIER_3
 *               else  → TIER_4
 */
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { AccountTier } from "@/generated/prisma/client";
import type {
  AgentWorkerContext,
  AgentWorkerOutput,
  AgentWorkerRun,
} from "./types";

function bucketTier(strategicValue: number): AccountTier {
  if (strategicValue >= 75) return "TIER_1";
  if (strategicValue >= 55) return "TIER_2";
  if (strategicValue >= 30) return "TIER_3";
  return "TIER_4";
}

export const run: AgentWorkerRun = async (
  ctx: AgentWorkerContext,
): Promise<AgentWorkerOutput> => {
  if (!ctx.lead) throw new Error("ACCOUNT_TIER_RANKER requires a lead context");
  const lead = ctx.lead;
  const workspaceId = ctx.workspaceId;

  if (!lead.accountId) {
    logger.info("agent_workers.account_tier_ranker.skipped_no_account", {
      leadId: lead.id,
      workspaceId,
    });
    return {
      output: { skipped: true, reason: "no_account" },
      costTokens: 0,
    };
  }

  const accountId = lead.accountId;

  const accountLeads = await prisma.lead.findMany({
    where: { workspaceId, accountId },
    select: {
      id: true,
      icpFitScore: true,
      salesConfidence: true,
      subNicheSlug: true,
      phone: true,
    },
  });

  const locationsCount = accountLeads.length;
  const icpScores = accountLeads
    .map((l) => l.icpFitScore)
    .filter((s): s is number => s != null);
  const confidences = accountLeads
    .map((l) => l.salesConfidence)
    .filter((s): s is number => s != null);
  const subNiches = new Set(
    accountLeads.map((l) => l.subNicheSlug).filter((s): s is string => s != null),
  );
  const hasPrimaryContact = accountLeads.some((l) => l.phone != null);

  let value = 0;
  // sqrt scaling: 1 loc=10, 4=20, 9=30, 16=cap at 30
  value += Math.min(30, Math.round(Math.sqrt(locationsCount) * 10));

  if (icpScores.length > 0) {
    const avg = icpScores.reduce((a, b) => a + b, 0) / icpScores.length;
    value += Math.round((avg / 100) * 30);
  }
  if (confidences.length > 0) {
    const avg = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    value += Math.round((avg / 100) * 20);
  }
  if (hasPrimaryContact) value += 10;
  if (subNiches.size >= 2) value += 10;

  const strategicValue = Math.max(0, Math.min(100, value));
  const tier = bucketTier(strategicValue);

  await prisma.account.updateMany({
    where: { id: accountId, workspaceId },
    data: {
      strategicValue,
      tier,
      locationsCount,
      locationsCountUpdatedAt: new Date(),
    },
  });

  logger.info("agent_workers.account_tier_ranker.done", {
    leadId: lead.id,
    accountId,
    locationsCount,
    strategicValue,
    tier,
  });

  return {
    output: {
      accountId,
      strategicValue,
      tier,
      locationsCount,
      avgIcpFit: icpScores.length
        ? Math.round(icpScores.reduce((a, b) => a + b, 0) / icpScores.length)
        : null,
      avgSalesConfidence: confidences.length
        ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
        : null,
    },
    costTokens: 0,
  };
};
