/**
 * AI Workers - shared run executor.
 *
 * The same routine runs both inside the BullMQ worker process
 * (`src/workers/agent-run-worker.ts`) and as an inline fallback in
 * the API handler when Redis is unavailable. Keeping the logic in
 * one place means the two paths cannot drift apart.
 *
 * Contract:
 *   - Caller supplies an AgentRun.id (row must exist, status PENDING
 *     or RUNNING).
 *   - This function hydrates context, re-checks quota, runs the
 *     registered worker, and writes back to the AgentRun row.
 *   - Never throws for "expected" failure cases (quota exceeded,
 *     lead missing, etc.); the row's `status = FAILED` + `errorMsg`
 *     carry the signal instead. Caller may fire-and-forget.
 */
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { runWorker } from "./registry";
import { checkWorkerQuota, QuotaExceededError } from "./quota";
import type { AgentWorkerContext } from "./types";

export async function executeAgentRun(runId: string): Promise<void> {
  const run = await prisma.agentRun.findUnique({ where: { id: runId } });
  if (!run) {
    logger.warn("agent_run.execute.missing", { runId });
    return;
  }
  if (run.status !== "PENDING" && run.status !== "RUNNING") {
    logger.warn("agent_run.execute.not_runnable", { runId, status: run.status });
    return;
  }

  if (run.status === "PENDING") {
    await prisma.agentRun.update({
      where: { id: runId },
      data: { status: "RUNNING", startedAt: new Date() },
    });
  }

  try {
    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: run.workspaceId },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        language: true,
        tone: true,
        offerName: true,
        valueProposition: true,
        offerHook: true,
        objective: true,
        senderName: true,
        conversionLink: true,
        socialProof: true,
        branding: true,
      },
    });

    const quota = await checkWorkerQuota({
      workspaceId: run.workspaceId,
      plan: workspace.plan,
      kind: run.workerKind,
    });
    if (!quota.allowed) {
      throw new QuotaExceededError(quota.used, quota.limit, run.workerKind);
    }

    const lead = run.leadId
      ? await prisma.lead.findUnique({
          where: { id: run.leadId },
          include: {
            websiteAudit: true,
            salesOpportunity: true,
            reviewAnalysis: true,
          },
        })
      : null;

    const ctx: AgentWorkerContext = {
      runId,
      workspaceId: run.workspaceId,
      workspacePlan: workspace.plan,
      leadId: run.leadId,
      userId: run.userId,
      lead,
      workspace,
    };

    const result = await runWorker(run.workerKind, ctx);

    await prisma.agentRun.update({
      where: { id: runId },
      data: {
        status: "SUCCEEDED",
        finishedAt: new Date(),
        outputJson: result.output as never,
        artifactUrl: result.artifactUrl ?? null,
        costTokens: result.costTokens ?? 0,
      },
    });

    logger.info("agent_run.execute.done", {
      runId,
      kind: run.workerKind,
      tokens: result.costTokens ?? 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("agent_run.execute.failed", {
      runId,
      kind: run.workerKind,
      err: msg,
    });
    await prisma.agentRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorMsg: msg.slice(0, 2000),
      },
    });
  }
}
