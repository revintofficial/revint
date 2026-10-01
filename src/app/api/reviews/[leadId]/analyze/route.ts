/**
 * P0.1 - Review Intelligence v1: trigger endpoint.
 *
 * POST: start a REVIEW_ANALYST AgentRun on the `agent-runs` queue for the
 * given lead. Returns 202. The worker writes the ReviewAnalysis row (or
 * skips a thin corpus); the client polls GET for the result.
 *
 * Task 2: this used to enqueue onto the legacy `review-analysis` queue,
 * which is no longer booted. Going through AI Core keeps one writer for
 * ReviewAnalysis (same thin-corpus gate, same `sellable` pain phrases).
 *
 * GET: fetch the latest ReviewAnalysis result (if any) for the given lead.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { assertCanUseAi, recordAiUsed, QuotaExceededError } from "@/lib/quotas";
import { logger } from "@/lib/logger";
import { tryEnqueue } from "@/lib/control/enqueue-run";
import { executeAgentRun } from "@/lib/agent-workers/execute";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  try {
    const { workspaceId, user } = await requireUser();
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

    // One in-flight REVIEW_ANALYST run per lead: a second click returns
    // the running one instead of double-billing.
    const inflight = await prisma.agentRun.findFirst({
      where: {
        workspaceId,
        leadId,
        workerKind: "REVIEW_ANALYST",
        status: { in: ["PENDING", "RUNNING"] },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (inflight) {
      return NextResponse.json(
        { status: "queued", leadId, mode: "queue", runId: inflight.id },
        { status: 202 },
      );
    }

    await assertCanUseAi(workspaceId, 1);

    await prisma.lead.updateMany({
      where: { id: leadId, workspaceId },
      data: { reviewAnalysisStatus: "PENDING" },
    });

    const run = await prisma.agentRun.create({
      data: {
        workspaceId,
        leadId,
        userId: user.id,
        workerKind: "REVIEW_ANALYST",
        status: "PENDING",
        inputsJson: { source: "reviews_analyze_route" } as never,
      },
      select: { id: true },
    });

    const enqueued = await tryEnqueue(run.id);
    if (!enqueued) {
      logger.warn("api.reviews.analyze.queue_unavailable_inline_fallback", { leadId, runId: run.id });
      void executeAgentRun(run.id).catch((err) => {
        logger.error("api.reviews.analyze.inline_fallback_error", {
          leadId,
          runId: run.id,
          err: err instanceof Error ? err.message : String(err),
        });
      });
    }

    await recordAiUsed(workspaceId, 1);

    return NextResponse.json(
      { status: "queued", leadId, mode: enqueued ? "queue" : "inline", runId: run.id },
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
