/**
 * POST /api/webhooks/apify
 *
 * Callback endpoint Apify POSTs to when an actor run finishes. Used
 * by every async-apify worker (declared via `mode: "async-apify"` in
 * `src/lib/agent-workers/registry.ts`). The webhook handler is the
 * counterpart to the worker's `start(ctx)` call: where `start`
 * schedules the actor + returns immediately, this endpoint receives
 * the actor's dataset and drives the worker's `finalize(ctx, payload)`
 * to produce the AgentWorkerOutput, persist memoryWrites, and flip
 * the AgentRun row to SUCCEEDED.
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
 *   4. Dispatch to `finalizeApifyAgentRun(agentRunId, payload)` which
 *      hydrates ctx, runs the worker's finalize, and persists output
 *      + memory + status.
 *   5. The orchestrator advance is enqueued inside finalizeApifyAgentRun;
 *      we don't duplicate it here.
 *
 * Idempotency: Apify retries webhooks; finalizeApifyAgentRun guards
 * against re-running a terminal AgentRun, and concurrent deliveries
 * race on the AgentRun status check. Returning `{ deduped: true }`
 * for the loser is safe and stops Apify's retry loop.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { fetchRun, verifyWebhookSecret } from "@/lib/apify";
import { finalizeApifyAgentRun } from "@/lib/agent-workers/execute";

export const runtime = "nodejs";
// Apify webhook delivery is fast; we only need enough headroom for
// the dataset fetch + finalize. 60s matches the rest of the API
// surface and keeps Apify's webhook retry policy (it gives up after
// a few minutes of HTTP 5xx) from running into our own deadline.
export const maxDuration = 60;

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
  if (!apifyRunId) {
    return NextResponse.json(
      { error: "resource.id missing; cannot correlate run" },
      { status: 400 },
    );
  }

  const run = await prisma.agentRun.findUnique({
    where: { id: agentRunId },
    select: { id: true, status: true, plannerSessionId: true, workerKind: true },
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
  let apifyResult: Awaited<ReturnType<typeof fetchRun>>;
  try {
    apifyResult = await fetchRun(apifyRunId);
  } catch (err) {
    logger.warn("apify.webhook.fetch_run_failed", {
      apifyRunId,
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { ok: false, retryable: true, reason: "apify_fetch_failed" },
      { status: 202 },
    );
  }

  // Dispatch into the AI Core executor. finalizeApifyAgentRun:
  //   - Resolves the worker module, calls its `finalize(ctx, payload)`
  //   - Persists memoryWrites
  //   - Sets AgentRun.status = SUCCEEDED with the produced output
  //   - Enqueues an orchestrator_advance when the run is part of a
  //     planner session
  // It also handles the FAILED case (apifyResult.status !== SUCCEEDED)
  // by flipping the row to FAILED with a clear errorMsg.
  await finalizeApifyAgentRun(agentRunId, {
    apifyRunId,
    items: apifyResult.items,
    costUsdCents: apifyResult.costUsdCents,
    status: apifyResult.status,
  });

  logger.info("apify.webhook.done", {
    agentRunId,
    apifyRunId,
    status: apifyResult.status,
    costUsdCents: apifyResult.costUsdCents,
  });
  return NextResponse.json({ ok: true });
}
