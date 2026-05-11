/**
 * GET /api/leads/[id]/review-intel
 *
 * Phase 2.5 — companion endpoint for the v2 lead-detail HISTORY block.
 * Lazy-fired only when the rep expands the review-timeline / review-
 * intelligence accordion. The aggregator (`/decision-surface`) returns
 * the SUMMARY (top-3 KPIs, leadScore, sentiment); this route returns
 * the FULL panel payload — analysis row + monthly volume buckets +
 * recent reviews — so first paint stays under the 400ms aggregator
 * budget.
 *
 * Per PLAN §4 Phase 2.5:
 *   "Returns { analysis, reviewsByMonth: { month, count, avgRating }[],
 *    recentReviews: GoogleReview[20] }. requireUser() then
 *    workspaceId-scoped. Lazy-fired only when HISTORY expands."
 *
 * MULTI-TENANT SCOPE AUDIT:
 * - `requireUser()` first; workspaceId trusted from session.
 * - `lead.findFirst({ where: { id, workspaceId } })` pre-check; the
 *   lead serves as the workspace anchor for the relation queries.
 * - GoogleReview / ReviewAnalysis are scoped via the parent leadId
 *   (their `Lead` parent is workspace-owned). Cross-workspace request
 *   returns 404 by way of the lead pre-check.
 *
 * QUERY-COUNT BUDGET: ≤ 4 (PLAN §3 SLOs / §4 Phase 2.5 DoD).
 *   1. lead pre-check (workspace gate)
 *   2. ReviewAnalysis full row
 *   3. GoogleReview full set for monthly buckets + recent slice
 *   The monthly grouping happens in-process — pgvector / GROUP BY
 *   sidesteps the aggregator's connection-pool budget.
 *
 * PERF BUDGET: p95 ≤ 200ms hot DB.
 *
 * PLAN GATING: FREE-friendly (the SUMMARY on the aggregator is what
 *   FREE sees; this companion is the same data zoomed in. The legacy
 *   `ReviewIntelligencePanel` was not gated either).
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { internalError } from "@/lib/api-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ReviewByMonth {
  /** ISO yyyy-MM-01 — the canonical first day of the bucket month, UTC. */
  month: string;
  count: number;
  avgRating: number | null;
}

interface RecentReview {
  id: string;
  authorName: string;
  authorPhoto: string | null;
  rating: number;
  text: string | null;
  relativeTime: string;
  publishTime: string;
}

interface ReviewAnalysisFull {
  id: string;
  leadScore: number;
  summary: string | null;
  weaknessKpis: unknown;
  strengthKpis: unknown;
  switchSignals: unknown;
  sentimentBreakdown: unknown;
  /** Phrase clouds — populated by REVIEW_ANALYST. */
  painPhrases: unknown;
  strengthPhrases: unknown;
  reviewsAnalyzedCount: number;
  analyzedAt: string;
}

export interface ReviewIntelResponse {
  status: "PENDING" | "ANALYZING" | "ANALYZED" | "FAILED" | "NO_REVIEWS";
  analysis: ReviewAnalysisFull | null;
  reviewsByMonth: ReviewByMonth[];
  recentReviews: RecentReview[];
  totalReviews: number;
}

const MAX_RECENT_REVIEWS = 20;
const MAX_TIMELINE_REVIEWS = 500;

function bucketByMonth(
  reviews: ReadonlyArray<{ rating: number; publishTime: Date }>,
): ReviewByMonth[] {
  const buckets = new Map<string, { sum: number; count: number }>();
  for (const r of reviews) {
    const d = r.publishTime;
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) continue;
    // Canonical UTC first-of-month so timezone shifts can't split a
    // single review's month across two buckets.
    const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
    const existing = buckets.get(month);
    if (existing) {
      existing.sum += r.rating;
      existing.count += 1;
    } else {
      buckets.set(month, { sum: r.rating, count: 1 });
    }
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { sum, count }]) => ({
      month,
      count,
      avgRating: count > 0 ? Number((sum / count).toFixed(2)) : null,
    }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId } = await requireUser();
    const { id } = await params;

    const lead = await prisma.lead.findFirst({
      where: { id, workspaceId },
      select: { id: true, reviewAnalysisStatus: true },
    });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Single $transaction so the analysis row + reviews fan out in
    // parallel against the same connection. Both queries are scoped
    // via `leadId` whose parent Lead has already been workspace-gated
    // above. Round-trip count = 3 (1 pre-check + 1 transaction of 2).
    const [analysis, reviewRows] = await prisma.$transaction([
      prisma.reviewAnalysis.findUnique({
        where: { leadId: id },
        select: {
          id: true,
          leadScore: true,
          summary: true,
          weaknessKpis: true,
          strengthKpis: true,
          switchSignals: true,
          sentimentBreakdown: true,
          painPhrases: true,
          strengthPhrases: true,
          reviewsAnalyzedCount: true,
          analyzedAt: true,
        },
      }),
      prisma.googleReview.findMany({
        where: { leadId: id },
        orderBy: { publishTime: "desc" },
        take: MAX_TIMELINE_REVIEWS,
        select: {
          id: true,
          authorName: true,
          authorPhoto: true,
          rating: true,
          text: true,
          relativeTime: true,
          publishTime: true,
        },
      }),
    ]);

    const reviewsByMonth = bucketByMonth(
      reviewRows.map((r) => ({ rating: r.rating, publishTime: r.publishTime })),
    );

    const recentReviews: RecentReview[] = reviewRows
      .slice(0, MAX_RECENT_REVIEWS)
      .map((r) => ({
        id: r.id,
        authorName: r.authorName,
        authorPhoto: r.authorPhoto,
        rating: r.rating,
        text: r.text,
        relativeTime: r.relativeTime,
        publishTime: r.publishTime.toISOString(),
      }));

    const status: ReviewIntelResponse["status"] =
      reviewRows.length === 0 ? "NO_REVIEWS" : lead.reviewAnalysisStatus;

    const response: ReviewIntelResponse = {
      status,
      analysis: analysis
        ? {
            id: analysis.id,
            leadScore: analysis.leadScore,
            summary: analysis.summary,
            weaknessKpis: analysis.weaknessKpis,
            strengthKpis: analysis.strengthKpis,
            switchSignals: analysis.switchSignals,
            sentimentBreakdown: analysis.sentimentBreakdown,
            painPhrases: analysis.painPhrases,
            strengthPhrases: analysis.strengthPhrases,
            reviewsAnalyzedCount: analysis.reviewsAnalyzedCount,
            analyzedAt: analysis.analyzedAt.toISOString(),
          }
        : null,
      reviewsByMonth,
      recentReviews,
      totalReviews: reviewRows.length,
    };

    return NextResponse.json(response, {
      headers: {
        // Lazy expand — if the rep collapses & re-expands within a
        // single session, SWR's revalidate-on-focus is fine; we
        // don't want stale review counts after a manual refresh.
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.leads.review-intel.GET", err);
  }
}
