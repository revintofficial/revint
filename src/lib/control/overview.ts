import { countReviewQueue } from "@/lib/control/review";
import { prisma } from "@/lib/prisma";

export type ControlOverview = {
  completed24h: number;
  failed24h: number;
  stuckSessions: number;
  openReviews: number;
  lastCandidate: { passed: number; total: number; finishedAt: string } | null;
  lastEval: { passed: number; total: number; finishedAt: string } | null;
};

function extractLastEval(row: { summaryJson: unknown; finishedAt: Date | null } | null): ControlOverview["lastEval"] {
  if (!row?.finishedAt) return null;
  const summary = row.summaryJson;
  if (typeof summary !== "object" || summary === null) return null;
  if (!("passed" in summary) || !("total" in summary)) return null;
  const passed = summary.passed;
  const total = summary.total;
  if (typeof passed !== "number" || typeof total !== "number" || !Number.isFinite(passed) || !Number.isFinite(total)) {
    return null;
  }
  return { passed, total, finishedAt: row.finishedAt.toISOString() };
}

export async function getControlOverview(workspaceId: string, now = new Date()): Promise<ControlOverview> {
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const before30m = new Date(now.getTime() - 30 * 60 * 1000);

  const [completed24h, failed24h, stuckSessions, openReviews, latestEval, latestCandidate] = await Promise.all([
    prisma.agentRun.count({
      where: {
        workspaceId,
        workerKind: "LEAD_INTELLIGENCE_BRIEF",
        // Only a head-agent brief counts as a finished analysis; skipped briefs carry no briefMode.
        outputJson: { path: ["briefMode"], equals: "head-agent" },
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
    countReviewQueue(workspaceId, now),
    prisma.evalRun.findFirst({
      where: { workspaceId, status: "SUCCEEDED", label: "taban" },
      orderBy: { createdAt: "desc" },
      select: { summaryJson: true, finishedAt: true },
    }),
    prisma.evalRun.findFirst({ where: { workspaceId, status: "SUCCEEDED", label: "aday" }, orderBy: { createdAt: "desc" }, select: { summaryJson: true, finishedAt: true } }),
  ]);

  return {
    completed24h,
    failed24h,
    stuckSessions,
    openReviews,
    lastEval: extractLastEval(latestEval),
    lastCandidate: extractLastEval(latestCandidate),
  };
}
