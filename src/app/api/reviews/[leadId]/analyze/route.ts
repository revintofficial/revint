/**
 * P0.1 - Review Intelligence v1: trigger endpoint.
 *
 * POST: enqueue a review-analysis job for the given lead. Returns 202 with the
 * current ReviewAnalysisStatus. Worker writes to ReviewAnalysis table; client
 * polls GET to fetch the result.
 *
 * GET: fetch the latest ReviewAnalysis result (if any) for the given lead.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { assertCanUseAi, recordAiUsed, QuotaExceededError } from "@/lib/quotas";
import { logger } from "@/lib/logger";
import { runReviewAnalysisJob } from "@/lib/review-analysis/run-job";
import { tryEnqueueReviewAnalysis } from "@/lib/review-analysis/try-enqueue";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  try {
    const { workspaceId } = await requireUser();
    const { leadId } = await params;

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, workspaceId },
      select: {
        id: true,
        reviewAnalysisStatus: true,
        _count: { select: { googleReviews: true } },
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (lead._count.googleReviews === 0) {
      return NextResponse.json(
        {
          error: "no_reviews",
          message: "No Google reviews yet for this lead. Fetch reviews first.",
        },
        { status: 422 },
      );
    }

    await assertCanUseAi(workspaceId, 1);

    await prisma.lead.update({
      where: { id: leadId },
      data: { reviewAnalysisStatus: "PENDING" },
    });

    const enqueued = await tryEnqueueReviewAnalysis(leadId);
    if (!enqueued) {
      logger.warn("api.reviews.analyze.queue_unavailable_inline_fallback", { leadId });
      void runReviewAnalysisJob(leadId).catch((err) => {
        logger.error("api.reviews.analyze.inline_fallback_error", {
          leadId,
          err: err instanceof Error ? err.message : String(err),
        });
      });
    }

    await recordAiUsed(workspaceId, 1);

    return NextResponse.json(
      { status: "queued", leadId, mode: enqueued ? "queue" : "inline" },
      { status: 202 },
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof QuotaExceededError) {
      return error.toResponse();
    }
    logger.error("api.reviews.analyze_enqueue_error", { err: error });
    return NextResponse.json(
      { error: "Failed to enqueue review analysis" },
      { status: 500 },
    );
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  try {
    const { workspaceId } = await requireUser();
    const { leadId } = await params;

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, workspaceId },
      select: {
        id: true,
        reviewAnalysisStatus: true,
        reviewAnalysis: true,
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json({
      status: lead.reviewAnalysisStatus,
      analysis: lead.reviewAnalysis,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.reviews.analyze_fetch_error", { err: error });
    return NextResponse.json(
      { error: "Failed to fetch review analysis" },
      { status: 500 },
    );
  }
}
