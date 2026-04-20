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
import { getReviewAnalysisQueue } from "@/lib/queues";
import { assertCanUseAi, recordAiUsed, QuotaExceededError } from "@/lib/quotas";
import { logger } from "@/lib/logger";

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
          message: "Bu lead için henüz Google yorumu yok. Önce review fetch et.",
        },
        { status: 422 },
      );
    }

    await assertCanUseAi(workspaceId, 1);

    await prisma.lead.update({
      where: { id: leadId },
      data: { reviewAnalysisStatus: "PENDING" },
    });

    const queue = getReviewAnalysisQueue();
    await queue.add(
      "analyze",
      { leadId },
      { removeOnComplete: 100, removeOnFail: 50 },
    );

    await recordAiUsed(workspaceId, 1);

    return NextResponse.json({ status: "queued", leadId }, { status: 202 });
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
