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

  // Idempotency: Apify retries webhooks on transient delivery failures
  // and sometimes duplicates deliveries. If the run is already in a
  // terminal state we must not overwrite its output / cost / finishedAt,
  // and we must not re-enqueue orchestrator advance (duplicate DAG
  // step execution risk).
  if (run.status === "SUCCEEDED" || run.status === "FAILED" || run.status === "CANCELLED") {
    logger.info("apify.webhook.dedupe_terminal", {
      agentRunId,
      apifyRunId,
      existingStatus: run.status,
    });
    return NextResponse.json({ ok: true, deduped: true });
  }

  // Fetch the actor's full output + stats. Failure to call Apify's API
  // is NOT the same as the actor run itself failing; if we cannot tell
  // whether the actor succeeded, we must not flip this AgentRun to
  // FAILED (that would cascade up the DAG and cancel downstream work).
  // Leave the run RUNNING so a later retry of the same webhook -- or a
  // manual cron reconciliation -- can resolve it.
  let costUsdCents = 0;
  let status: "SUCCEEDED" | "FAILED" | null = null;
  let outputJson: unknown = null;

  if (apifyRunId) {
    try {
      const apifyResult = await fetchRun(apifyRunId);
      costUsdCents = apifyResult.costUsdCents;
      outputJson = { apifyRunId, items: apifyResult.items.slice(0, 500) };
      status = apifyResult.status === "SUCCEEDED" ? "SUCCEEDED" : "FAILED";
    } catch (err) {
      logger.warn("apify.webhook.fetch_run_failed", {
        apifyRunId,
        err: err instanceof Error ? err.message : String(err),
      });
      // Leave status unresolved; 202 so Apify retries per its webhook
      // retry policy.
      return NextResponse.json(
        { ok: false, retryable: true, reason: "apify_fetch_failed" },
        { status: 202 },
      );
    }
  } else {
    // No apifyRunId in payload -- we cannot correlate. Don't touch the
    // AgentRun; return 400 so the caller knows the payload is bad.
    return NextResponse.json(
      { error: "resource.id missing; cannot correlate run" },
      { status: 400 },
    );
  }

  // Conditional update: only transition from non-terminal state so
  // two concurrent webhook deliveries for the same run race at the DB
  // and the second one is a no-op.
  const updated = await prisma.agentRun.updateMany({
    where: {
      id: agentRunId,
      status: { in: ["PENDING", "RUNNING"] },
    },
    data: {
      status,
      finishedAt: new Date(),
      costUsdCents,
      outputJson: outputJson as never,
    },
  });

  if (updated.count === 0) {
    logger.info("apify.webhook.race_lost", { agentRunId, apifyRunId });
    return NextResponse.json({ ok: true, deduped: true });
  }

  if (run.plannerSessionId) {
    await enqueueAdvance(run.plannerSessionId);
  }

  logger.info("apify.webhook.done", { agentRunId, apifyRunId, status, costUsdCents });
  return NextResponse.json({ ok: true });
}
