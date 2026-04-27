/**
 * POST /api/leads/[id]/explain
 *
 * Lead Dossier endpoint. Cache-first: if a SUCCEEDED
 * `LEAD_DOSSIER_GENERATOR` AgentRun exists and is fresher than the
 * latest source signal (review analysis, audit, scorer output, or
 * any other lead-scoped AgentRun), the cached markdown is served
 * immediately. Otherwise we create a new AgentRun, execute the
 * worker inline, and return its output. This means the dossier
 * button is instant after the first click (formerly hit fresh Gemini
 * on every click) and only refreshes when the underlying data has
 * actually changed.
 *
 * Multi-tenant: every query filters by `session.workspaceId`; the lead
 * lookup uses `findFirst` so cross-workspace lead ids return 404.
 */
import { NextResponse } from "next/server";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { internalError } from "@/lib/api-errors";
import { executeAgentRun } from "@/lib/agent-workers/execute";
import type { LeadDossierWorkerOutput } from "@/lib/agent-workers/lead-dossier-generator";

/**
 * Returns the most recent timestamp at which any data the dossier
 * is built from could have changed. The cached dossier is served
 * only when it was generated AFTER this timestamp.
 *
 * Sources considered:
 *   - reviewAnalysis.analyzedAt (re-analysis after new reviews)
 *   - websiteAudit.updatedAt (re-crawl)
 *   - salesOpportunity.updatedAt (re-score)
 *   - latest SUCCEEDED AgentRun for this lead OTHER than dossier
 *     itself (Apify enrichment, social scraper etc.)
 *   - the lead.updatedAt as a last-resort lower bound
 */
async function latestSourceTimestamp(
  workspaceId: string,
  leadId: string,
): Promise<Date | null> {
  const [lead, latestRun] = await Promise.all([
    prisma.lead.findFirst({
      where: { id: leadId, workspaceId },
      select: {
        updatedAt: true,
        reviewAnalysis: { select: { analyzedAt: true } },
        websiteAudit: { select: { createdAt: true } },
        salesOpportunity: { select: { updatedAt: true } },
      },
    }),
    prisma.agentRun.findFirst({
      where: {
        workspaceId,
        leadId,
        status: "SUCCEEDED",
        workerKind: { not: "LEAD_DOSSIER_GENERATOR" },
      },
      orderBy: { finishedAt: "desc" },
      select: { finishedAt: true },
    }),
  ]);
  if (!lead) return null;

  const candidates: Array<Date | null | undefined> = [
    lead.updatedAt,
    lead.reviewAnalysis?.analyzedAt,
    lead.websiteAudit?.createdAt,
    lead.salesOpportunity?.updatedAt,
    latestRun?.finishedAt,
  ];

  let max: Date | null = null;
  for (const c of candidates) {
    if (!c) continue;
    if (!max || c > max) max = c;
  }
  return max;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireUser();
    const { id: leadId } = await params;

    // Authorization + existence check up front so we can return 404
    // before doing any cache work.
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, workspaceId: session.workspaceId },
      select: { id: true },
    });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // 1. Cache check — most recent SUCCEEDED dossier run for this lead.
    const cached = await prisma.agentRun.findFirst({
      where: {
        workspaceId: session.workspaceId,
        leadId,
        workerKind: "LEAD_DOSSIER_GENERATOR",
        status: "SUCCEEDED",
      },
      orderBy: { finishedAt: "desc" },
      select: { id: true, finishedAt: true, outputJson: true },
    });

    const sourceTs = await latestSourceTimestamp(session.workspaceId, leadId);

    if (cached?.outputJson && cached.finishedAt) {
      const cachedFresh = !sourceTs || cached.finishedAt >= sourceTs;
      if (cachedFresh) {
        const cachedOut = cached.outputJson as unknown as LeadDossierWorkerOutput;
        if (cachedOut?.markdown) {
          logger.info("api.lead.explain.cache_hit", {
            leadId,
            runId: cached.id,
            ageMs: Date.now() - cached.finishedAt.getTime(),
          });
          return NextResponse.json({
            leadId,
            markdown: cachedOut.markdown,
            generatedAt: cachedOut.generatedAt ?? cached.finishedAt.toISOString(),
            stats: cachedOut.stats ?? {
              agentRunCount: 0,
              memoryRowCount: 0,
              reviewCount: 0,
              voiceNoteCount: 0,
            },
            cached: true,
          });
        }
      }
    }

    // 2. Cache miss / stale — schedule + execute inline.
    const newRun = await prisma.agentRun.create({
      data: {
        workspaceId: session.workspaceId,
        leadId,
        userId: session.user.id,
        workerKind: "LEAD_DOSSIER_GENERATOR",
        status: "PENDING",
        inputsJson: {},
      },
      select: { id: true },
    });

    const startedAt = Date.now();
    await executeAgentRun(newRun.id);
    const elapsed = Date.now() - startedAt;

    const finished = await prisma.agentRun.findUniqueOrThrow({
      where: { id: newRun.id },
      select: { status: true, outputJson: true, errorMsg: true, finishedAt: true },
    });

    if (finished.status !== "SUCCEEDED" || !finished.outputJson) {
      // The worker error string can include prompt fragments / model
      // hints, so we log it server-side and return a generic message.
      logger.warn("api.lead.explain.worker_failed", {
        leadId,
        runId: newRun.id,
        status: finished.status,
        err: finished.errorMsg,
        ms: elapsed,
      });
      return NextResponse.json(
        { error: "Failed to generate lead dossier" },
        { status: 500 },
      );
    }

    const out = finished.outputJson as unknown as LeadDossierWorkerOutput;
    logger.info("api.lead.explain.generated", {
      leadId,
      runId: newRun.id,
      ms: elapsed,
      ...(out.stats ?? {}),
      outputChars: out.markdown?.length ?? 0,
    });

    return NextResponse.json({
      leadId,
      markdown: out.markdown,
      generatedAt: out.generatedAt ?? new Date().toISOString(),
      stats: out.stats ?? {
        agentRunCount: 0,
        memoryRowCount: 0,
        reviewCount: 0,
        voiceNoteCount: 0,
      },
      cached: false,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.lead.explain.error", err);
  }
}
