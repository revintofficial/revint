import { prisma } from "@/lib/prisma";

export type ControlOverview = {
  completed24h: number;
  failed24h: number;
  stuckSessions: number;
  openReviews: number;
  lastEvalPassRate: number | null;
};

function extractPassRate(summaryJson: unknown): number | null {
  if (typeof summaryJson !== "object" || summaryJson === null || !("passRate" in summaryJson)) return null;
  const passRate = summaryJson.passRate;
  return typeof passRate === "number" && Number.isFinite(passRate) ? passRate : null;
}

export async function getControlOverview(workspaceId: string, now = new Date()): Promise<ControlOverview> {
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const before30m = new Date(now.getTime() - 30 * 60 * 1000);

  const [completed24h, failed24h, stuckSessions, openReviews, latestEval] = await Promise.all([
    prisma.agentRun.count({
      where: {
        workspaceId,
        status: { in: ["SUCCEEDED", "SUCCEEDED_NO_MEMORY"] },
        finishedAt: { gte: since24h },
      },
    }),
    prisma.agentRun.count({
      where: { workspaceId, status: "FAILED", finishedAt: { gte: since24h } },
    }),
    prisma.plannerSession.count({
      where: { workspaceId, status: { in: ["PLANNING", "EXECUTING"] }, updatedAt: { lt: before30m } },
    }),
    prisma.humanReview.count({ where: { workspaceId, verdict: "NEEDS_REVIEW" } }),
    prisma.evalRun.findFirst({
      where: { workspaceId, status: "SUCCEEDED" },
      orderBy: { createdAt: "desc" },
      select: { summaryJson: true },
    }),
  ]);

  return {
    completed24h,
    failed24h,
    stuckSessions,
    openReviews,
    lastEvalPassRate: extractPassRate(latestEval?.summaryJson),
  };
}
