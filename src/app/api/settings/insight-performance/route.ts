/**
 * GET /api/settings/insight-performance
 *
 * Returns CommercialInsight rows (workspace + system seeds) joined to
 * their rolled-up `InsightPerformance` counters. The settings UI uses
 * this to surface the insights ranked by win-rate so the operator can:
 *   - see which Challenger reframes are paying off in their niche
 *   - bump the `basePriority` on the laggards (Phase 2 — write coming)
 *   - spot insights that are firing but never converting
 *
 * Multi-tenant: only the active workspace's InsightPerformance buckets
 * are summed. System-seed CommercialInsights (workspaceId = NULL) are
 * included as candidates, but their performance numbers come from the
 * caller's workspace only.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { internalError } from "@/lib/api-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface InsightPerformanceRow {
  insightId: string;
  industryMyth: string;
  reframe: string;
  nicheSlug: string | null;
  basePriority: number;
  applied: number;
  replyPositive: number;
  replyNegative: number;
  ignored: number;
  meetingBooked: number;
  won: number;
  /** (replyPositive + meetingBooked + won) / applied. 0 when no apps. */
  winRate: number;
}

export async function GET(request: Request) {
  try {
    const { workspaceId } = await requireUser();

    const url = new URL(request.url);
    const niche = url.searchParams.get("niche");

    const insights = await prisma.commercialInsight.findMany({
      where: {
        OR: [{ workspaceId }, { workspaceId: null }],
        ...(niche ? { nicheSlug: niche } : {}),
      },
      orderBy: { basePriority: "desc" },
      take: 200,
    });

    // Aggregate performance counters per insight across all bucket
    // dimensions (niche × trigger × framework × tier) for the active
    // workspace. The unique key on InsightPerformance lets sysadmins
    // slice by any dimension; this surface gives the operator the
    // headline number per insight.
    const perfRows = await prisma.insightPerformance.groupBy({
      by: ["insightId"],
      where: { workspaceId },
      _sum: {
        applied: true,
        replyPositive: true,
        replyNegative: true,
        ignored: true,
        meetingBooked: true,
        won: true,
      },
    });

    const perfByInsight = new Map<string, (typeof perfRows)[number]>();
    for (const r of perfRows) {
      perfByInsight.set(r.insightId, r);
    }

    const rows: InsightPerformanceRow[] = insights.map((ins) => {
      const perf = perfByInsight.get(ins.id);
      const applied = perf?._sum.applied ?? 0;
      const positives =
        (perf?._sum.replyPositive ?? 0) +
        (perf?._sum.meetingBooked ?? 0) +
        (perf?._sum.won ?? 0);
      return {
        insightId: ins.id,
        industryMyth: ins.industryMyth,
        reframe: ins.reframe,
        nicheSlug: ins.nicheSlug,
        basePriority: ins.basePriority,
        applied,
        replyPositive: perf?._sum.replyPositive ?? 0,
        replyNegative: perf?._sum.replyNegative ?? 0,
        ignored: perf?._sum.ignored ?? 0,
        meetingBooked: perf?._sum.meetingBooked ?? 0,
        won: perf?._sum.won ?? 0,
        winRate: applied > 0 ? Math.round((positives / applied) * 1000) / 10 : 0,
      };
    });

    rows.sort((a, b) => {
      if (a.applied === 0 && b.applied === 0) return b.basePriority - a.basePriority;
      if (a.applied === 0) return 1;
      if (b.applied === 0) return -1;
      return b.winRate - a.winRate;
    });

    return NextResponse.json({ rows });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.settings.insight-performance.GET", err);
  }
}
