import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";

export async function GET() {
  try {
    const { workspaceId } = await requireUser();

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
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error("Stats error:", message);
    return NextResponse.json({ error: "Failed to fetch stats", detail: message }, { status: 500 });
  }
}
