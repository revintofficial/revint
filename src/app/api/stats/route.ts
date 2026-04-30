import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { internalError } from "@/lib/api-errors";

export async function GET() {
  try {
    const { workspaceId } = await requireUser();

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalLeads,
      withWebsite,
      withoutWebsite,
      avgScoreResult,
      boroughCounts,
      recentLeads,
      statusCounts,
      crawlStatusCounts,
      analyzeStatusCounts,
      // Phase 1 SDR throughput counters.
      callsToday,
      emailsToday,
      meetingsBooked30d,
      replies7d,
      todayQueueSize,
      avgConfidence,
      activitiesByKind7d,
    ] = await Promise.all([
      prisma.lead.count({ where: { workspaceId } }),
      prisma.lead.count({ where: { workspaceId, hasWebsite: true } }),
      prisma.lead.count({ where: { workspaceId, hasWebsite: false } }),
      prisma.salesOpportunity.aggregate({
        where: { lead: { workspaceId } },
        _avg: { opportunityScore: true },
      }),
      prisma.lead.groupBy({
        by: ["borough"],
        where: { workspaceId },
        _count: { borough: true },
        orderBy: { _count: { borough: "desc" } },
      }),
      prisma.lead.count({
        where: {
          workspaceId,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.salesOpportunity.groupBy({
        by: ["status"],
        where: { lead: { workspaceId } },
        _count: { status: true },
      }),
      prisma.lead.groupBy({
        by: ["crawlStatus"],
        where: { workspaceId },
        _count: { crawlStatus: true },
      }),
      prisma.lead.groupBy({
        by: ["analyzeStatus"],
        where: { workspaceId },
        _count: { analyzeStatus: true },
      }),
      prisma.leadActivity.count({
        where: {
          workspaceId,
          kind: "CALL_LOGGED",
          createdAt: { gte: startOfToday },
        },
      }),
      prisma.leadActivity.count({
        where: {
          workspaceId,
          kind: "EMAIL_SENT",
          createdAt: { gte: startOfToday },
        },
      }),
      prisma.leadActivity.count({
        where: {
          workspaceId,
          kind: "MEETING_BOOKED",
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
      prisma.leadActivity.count({
        where: {
          workspaceId,
          kind: "EMAIL_REPLIED",
          createdAt: { gte: sevenDaysAgo },
        },
      }),
      prisma.lead.count({
        where: {
          workspaceId,
          archivedAt: null,
          discardedAt: null,
          dnc: false,
          OR: [
            { snoozeUntil: null },
            { snoozeUntil: { lte: now } },
          ],
          AND: [
            {
              OR: [
                { nextActionDueAt: null },
                { nextActionDueAt: { lte: now } },
              ],
            },
          ],
        },
      }),
      prisma.lead.aggregate({
        where: {
          workspaceId,
          salesConfidence: { not: null },
        },
        _avg: { salesConfidence: true },
      }),
      prisma.leadActivity.groupBy({
        by: ["kind"],
        where: {
          workspaceId,
          createdAt: { gte: sevenDaysAgo },
        },
        _count: { kind: true },
      }),
    ]);

    return NextResponse.json({
      totalLeads,
      withWebsite,
      withoutWebsite,
      averageScore: Math.round(avgScoreResult._avg.opportunityScore || 0),
      boroughDistribution: boroughCounts.map((b) => ({
        borough: b.borough || "Unknown",
        count: b._count.borough,
      })),
      recentLeads,
      outreachStatus: statusCounts.map((s) => ({
        status: s.status,
        count: s._count.status,
      })),
      crawlStatus: crawlStatusCounts.map((s) => ({
        status: s.crawlStatus,
        count: s._count.crawlStatus,
      })),
      analyzeStatus: analyzeStatusCounts.map((s) => ({
        status: s.analyzeStatus,
        count: s._count.analyzeStatus,
      })),
      sdr: {
        callsToday,
        emailsToday,
        meetingsBooked30d,
        replies7d,
        todayQueueSize,
        averageConfidence: Math.round(avgConfidence._avg.salesConfidence ?? 0),
        activitiesByKind7d: activitiesByKind7d.map((row) => ({
          kind: row.kind,
          count: row._count.kind,
        })),
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.stats.error", error);
  }
}
