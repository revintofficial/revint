/**
 * POST /api/webhooks/apify
 *
 * Callback endpoint Apify POSTs to when an actor run finishes. Only
 * used by workers that call `apify.runAsync()` (long-running Maps /
 * site-crawl jobs). Sync-run workers finish inside the worker
 * process and have no webhook path.
 *
 * Payload (partial):
 *   {
 *     userData: { agentRunId },
 *     resource: { id, status, defaultDatasetId, usageTotalUsd, ... },
 *     eventData: { actorRunId, actorId, ... }
 *   }
 *
 * Flow:
 *   1. Verify webhook secret header.
 *   2. Extract agentRunId from `userData`.
 *   3. Fetch the run + dataset via `fetchRun(runId)`.
 *   4. Persist `costUsdCents` and output to AgentRun row.
 *   5. Enqueue an orchestrator_advance if the run belongs to a session.
 *
 * We intentionally do NOT call the worker's `memoryWrites` callback
 * here because async Apify workers need to hydrate the ctx themselves;
 * follow-up work should either (a) re-use the executor's post-run
 * pipeline by having the worker run a sync step on webhook receipt,
 * or (b) dispatch a small per-kind handler. For the current set of
 * async-capable workers none exists yet, so this webhook is wired up
 * but inactive; sync mode handles all current Apify workers.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { fetchRun, verifyWebhookSecret } from "@/lib/apify";
import { enqueueAdvance } from "@/lib/ai-core/orchestrator";

export async function POST(req: Request): Promise<Response> {
  if (!verifyWebhookSecret(req.headers)) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  let body: {
    userData?: { agentRunId?: string };
    resource?: { id?: string; status?: string; defaultDatasetId?: string; usageTotalUsd?: number };
    eventType?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const agentRunId = body.userData?.agentRunId;
  const apifyRunId = body.resource?.id;
  const eventType = body.eventType;

  if (!agentRunId) {
    logger.warn("apify.webhook.no_agent_run_id", { apifyRunId, eventType });
    return NextResponse.json({ error: "userData.agentRunId missing" }, { status: 400 });
  }

  const run = await prisma.agentRun.findUnique({
    where: { id: agentRunId },
    select: { id: true, status: true, plannerSessionId: true },
  });
  if (!run) {
    logger.warn("apify.webhook.run_not_found", { agentRunId });
    return NextResponse.json({ error: "AgentRun not found" }, { status: 404 });
  }

  // Fetch the actor's full output + stats. Failure to do so downgrades
  // to a best-effort status update.
  let costUsdCents = 0;
  let status: "SUCCEEDED" | "FAILED" = "SUCCEEDED";
  let outputJson: unknown = null;

  if (apifyRunId) {
    try {
      const apifyResult = await fetchRun(apifyRunId);
      costUsdCents = apifyResult.costUsdCents;
      outputJson = { apifyRunId, items: apifyResult.items.slice(0, 500) };
      if (apifyResult.status !== "SUCCEEDED") status = "FAILED";
    } catch (err) {
      logger.warn("apify.webhook.fetch_run_failed", {
        apifyRunId,
        err: err instanceof Error ? err.message : String(err),
      });
      status = "FAILED";
    }
  }

  await prisma.agentRun.update({
    where: { id: agentRunId },
    data: {
      status,
      finishedAt: new Date(),
      costUsdCents,
      outputJson: outputJson as never,
    },
  });

  if (run.plannerSessionId) {
    await enqueueAdvance(run.plannerSessionId);
  }

  logger.info("apify.webhook.done", { agentRunId, apifyRunId, status, costUsdCents });
  return NextResponse.json({ ok: true });
}
