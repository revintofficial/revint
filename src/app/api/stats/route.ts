import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
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
      prisma.lead.count(),
      prisma.lead.count({ where: { hasWebsite: true } }),
      prisma.lead.count({ where: { hasWebsite: false } }),
      prisma.salesOpportunity.aggregate({
        _avg: { opportunityScore: true },
      }),
      prisma.lead.groupBy({
        by: ["borough"],
        _count: { borough: true },
        orderBy: { _count: { borough: "desc" } },
      }),
      prisma.lead.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.salesOpportunity.groupBy({
        by: ["status"],
        _count: { status: true },
      }),
      prisma.lead.groupBy({
        by: ["crawlStatus"],
        _count: { crawlStatus: true },
      }),
      prisma.lead.groupBy({
        by: ["analyzeStatus"],
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
    console.error("Stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
