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
 *   - This function hydrates context, re-checks quota, pre-fetches
 *     SemanticMemory hits declared by the worker, runs the registered
 *     worker, persists any memoryWrites, and writes back to the
 *     AgentRun row.
 *   - Never throws for "expected" failure cases (quota exceeded,
 *     lead missing, etc.); the row's `status = FAILED` + `errorMsg`
 *     carry the signal instead. Caller may fire-and-forget.
 *   - When the run belongs to a PlannerSession, an
 *     `orchestrator_advance` job is enqueued after completion so the
 *     DAG walker schedules the next layer.
 */
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  runWorker,
  getWorker,
  resolveMemoryWrites,
  resolveWorkerStart,
  resolveWorkerFinalize,
} from "./registry";
import { checkWorkerQuota, QuotaExceededError } from "./quota";
import { RetryableError } from "./errors";
import { getAppBaseUrl } from "@/lib/email/from";
import type {
  AgentWorkerContext,
  ApifyFinalizePayload,
  EventKind,
  MemoryHit,
  MemorySpec,
  MemoryWrite,
} from "./types";
import type { AgentRun } from "@/generated/prisma/client";

/**
 * Returns true when the deployment has a public webhook ingress
 * (Apify can call us back). False on local dev without a tunnel:
 * `getAppBaseUrl()` falls back to `http://localhost:3000` and Apify
 * can't reach that. The executor uses this to decide between the
 * async-apify webhook path and the sync `run()` fallback.
 */
function hasPublicWebhookIngress(): boolean {
  const url = getAppBaseUrl();
  try {
    const u = new URL(url);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return false;
    if (u.hostname.endsWith(".local")) return false;
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export async function executeAgentRun(
  runId: string,
  opts?: { isRetry?: boolean },
): Promise<void> {
  const run = await prisma.agentRun.findUnique({ where: { id: runId } });
  if (!run) {
    logger.warn("agent_run.execute.missing", { runId });
    return;
  }

  // BullMQ retry: the previous attempt marked the row FAILED before
  // rethrowing the RetryableError. Reset it to RUNNING so this attempt
  // can proceed from the beginning rather than early-returning below.
  if (run.status === "FAILED" && opts?.isRetry) {
    await prisma.agentRun.update({
      where: { id: runId },
      data: { status: "RUNNING", startedAt: new Date(), finishedAt: null, errorMsg: null },
    });
  } else if (run.status !== "PENDING" && run.status !== "RUNNING") {
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
    const workerMeta = getWorker(run.workerKind);
    const ctx = await hydrateContext(run);

    // Stale-version guard. When a rep manually overrides a lead's
    // sub-niche, the override API bumps `Lead.subNicheVersion` and
    // re-enqueues the affected workers with the new version. Any
    // run that was already in flight (BullMQ pending, retry backoff,
    // or stuck on a slow Gemini call) carries the OLD snapshot in
    // `run.inputSubNicheVersion`. Letting it complete would overwrite
    // freshly-classified data with stale-vertical analysis. Resolve
    // by SUCCEEDED-with-skip-reason so the planner advances cleanly
    // and the new run (already enqueued by the override) is the only
    // one that lands.
    if (
      ctx.lead &&
      run.inputSubNicheVersion != null &&
      ctx.lead.subNicheVersion !== run.inputSubNicheVersion
    ) {
      const skipPayload = {
        skipped: true,
        reason: "stale-subniche-version",
        snapshotVersion: run.inputSubNicheVersion,
        currentVersion: ctx.lead.subNicheVersion,
      };
      await prisma.agentRun.update({
        where: { id: runId },
        data: {
          status: "SUCCEEDED",
          finishedAt: new Date(),
          outputJson: skipPayload as never,
          costTokens: 0,
          costUsdCents: 0,
        },
      });
      logger.info("agent_run.execute.stale_subniche_skip", {
        runId,
        kind: run.workerKind,
        leadId: ctx.lead.id,
        ...skipPayload,
      });
      if (run.plannerSessionId) {
        await safeNotifyOrchestrator(run.plannerSessionId, runId);
      }
      return;
    }

    const quota = await checkWorkerQuota({
      workspaceId: run.workspaceId,
      plan: ctx.workspace.plan,
      kind: run.workerKind,
      leadId: run.leadId,
    });
    if (!quota.allowed) {
      throw new QuotaExceededError(quota.used, quota.limit, run.workerKind);
    }

    // Async-apify mode: kick off the actor with a webhook callback and
    // return without flipping the AgentRun to a terminal state. The
    // `/api/webhooks/apify` handler imports the worker's `finalize()`
    // when Apify reports back, builds the AgentWorkerOutput, persists
    // memory writes, and transitions the row to SUCCEEDED.
    //
    // Why we do this instead of awaiting runSync: Vercel caps every
    // function at 60s (see vercel.json) and `apify/google-search-scraper`
    // regularly takes longer than that with cold starts. Awaiting
    // would leave the run RUNNING when Vercel tears down the
    // function, and the lazy 3-minute watchdog would mark it FAILED
    // with no diagnostic. The async path sidesteps the deadline by
    // not requiring our process to stay alive.
    //
    // Local dev / no public webhook ingress: fall back to sync mode.
    // The worker still exports a sync `run()` adapter so dev machines
    // without an ngrok tunnel keep working without code changes.
    if (workerMeta?.mode === "async-apify" && hasPublicWebhookIngress()) {
      const start = await resolveWorkerStart(run.workerKind);
      if (!start) {
        throw new Error(
          `Worker ${run.workerKind} declared mode="async-apify" but module exports no start() handler`,
        );
      }
      const startResult = await start(ctx);

      if ("skipped" in startResult) {
        // No actor was scheduled (no token, no queries). Resolve the
        // run inline as SUCCEEDED with the skip reason recorded in
        // outputJson; downstream chains will see it the same way they
        // see any other zero-cost completion.
        await prisma.agentRun.update({
          where: { id: runId },
          data: {
            status: "SUCCEEDED",
            finishedAt: new Date(),
            outputJson: (startResult.output ?? {
              skipped: true,
              reason: startResult.reason,
            }) as never,
            costTokens: 0,
            costUsdCents: 0,
          },
        });
        logger.info("agent_run.execute.async_skipped", {
          runId,
          kind: run.workerKind,
          reason: startResult.reason,
        });
        if (run.plannerSessionId) {
          await safeNotifyOrchestrator(run.plannerSessionId, runId);
        }
        return;
      }

      // Persist the apifyRunId on inputsJson so the watchdog can
      // distinguish "still waiting on Apify webhook" from "executor
      // crashed", and the webhook handler can correlate by either
      // userData.agentRunId (primary) or by AgentRun.id directly.
      const existingInputs = (run.inputsJson ?? {}) as Record<string, unknown>;
      await prisma.agentRun.update({
        where: { id: runId },
        data: {
          status: "RUNNING",
          startedAt: run.startedAt ?? new Date(),
          inputsJson: {
            ...existingInputs,
            mode: "async-apify",
            apifyRunId: startResult.apifyRunId,
            apifyStartedAt: new Date().toISOString(),
          } as never,
          costUsdCents: startResult.costEstimateUsdCents ?? 0,
        },
      });
      logger.info("agent_run.execute.async_kickoff", {
        runId,
        kind: run.workerKind,
        apifyRunId: startResult.apifyRunId,
      });
      // No memoryWrites, no orchestrator advance, no SUCCEEDED flip.
      // Webhook owns those transitions.
      return;
    }

    // Outer deadline: 3× the worker's estimated duration, capped at
    // 180 seconds. This catches the case where the inner Gemini timeout
    // fires but the AbortController race resolves with an error that
    // takes longer to propagate, or when an Apify actor hangs past its
    // own declared timeoutSec. Any worker that breaches this deadline
    // throws RetryableError so BullMQ re-queues rather than dropping.
    const workerDeadlineMs = Math.min(
      (workerMeta?.estimatedDurationMs ?? 60_000) * 3,
      180_000,
    );
    const deadlinePromise = new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new RetryableError(
              `worker_deadline_exceeded: ${run.workerKind} exceeded ${workerDeadlineMs}ms outer deadline`,
            ),
          ),
        workerDeadlineMs,
      ),
    );
    const result = await Promise.race([runWorker(run.workerKind, ctx), deadlinePromise]);

    // Post-run memory writes. The worker's impl module may export a
    // `memoryWrites` callback; we resolve it lazily (same cache as
    // the run handler) and invoke with the run output + context.
    //
    // A memory-write failure is treated the same as a worker failure:
    // the run is marked FAILED and no orchestrator advance is fired
    // for SUCCEEDED state. Memory is load-bearing (downstream workers
    // read it via memoryReads; the learning loop reads OPENER_SUCCESS),
    // so a silent memory gap would surface as a quality regression
    // weeks later with no diagnostic trail. Better to fail loud now.
    //
    // The worker's primary artifact is still preserved in the worker
    // output: if a reviewer needs to inspect a FAILED run to recover
    // the Gemini response, it is available in AgentRun.errorMsg as a
    // short note and the worker logger has the full payload.
    const memoryWritesFn = await resolveMemoryWrites(run.workerKind);
    if (memoryWritesFn) {
      const writes = await memoryWritesFn(result.output, ctx);
      if (writes && writes.length > 0) {
        await persistMemoryWrites(run.workspaceId, writes);
      }
    }

    await prisma.agentRun.update({
      where: { id: runId },
      data: {
        status: "SUCCEEDED",
        finishedAt: new Date(),
        outputJson: result.output as never,
        artifactUrl: result.artifactUrl ?? null,
        costTokens: result.costTokens ?? 0,
        costUsdCents: result.costUsdCents ?? 0,
      },
    });

    logger.info("agent_run.execute.done", {
      runId,
      kind: run.workerKind,
      tokens: result.costTokens ?? 0,
      cents: result.costUsdCents ?? 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    if (err instanceof RetryableError) {
      // Mark the run FAILED for observability, but rethrow so BullMQ can
      // reschedule the job with exponential backoff. The next attempt will
      // receive isRetry=true and reset the row back to RUNNING before
      // re-executing. We intentionally do NOT notify the orchestrator here
      // because the step is not yet terminal — more attempts are coming.
      logger.warn("agent_run.execute.retryable_failure", {
        runId,
        kind: run.workerKind,
        err: msg,
      });
      await prisma.agentRun.update({
        where: { id: runId },
        data: {
          status: "FAILED",
          finishedAt: new Date(),
          errorMsg: `retryable: ${msg}`.slice(0, 2000),
        },
      });
      throw err;
    }

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
    if (run.plannerSessionId) {
      await safeNotifyOrchestrator(run.plannerSessionId, runId);
    }
    return;
  }

  // Run completed successfully. The orchestrator notification is
  // intentionally outside the main try/catch above: a failure to
  // enqueue the planner advance job MUST NOT flip the just-saved
  // SUCCEEDED row back to FAILED. The worker did its job; the
  // session can be advanced manually or by the watchdog. We log the
  // notify failure loudly so on-call sees it.
  if (run.plannerSessionId) {
    await safeNotifyOrchestrator(run.plannerSessionId, runId);
  }
}

/**
 * Resolves memoryReads into concrete MemoryHit arrays. Each spec may
 * scope to workspace-wide or lead-only. We concatenate hits in the
 * declared order so workers that care about ordering can rely on it.
 *
 * When the worker lacks a leadId but declares `scope: "lead"`, the
 * spec silently returns zero hits rather than throwing; this keeps
 * chains that invoke workers without a lead (bulk ops) working.
 *
 * Similarity semantics: this path does NOT have a vector query (the
 * registry's MemorySpec is static - it declares kinds and scope, not
 * a query text), so results are ordered by recency rather than
 * semantic similarity. To avoid lying to callers, we emit
 * `similarity: null` on these hits. Workers that need a real
 * similarity ranking (OPENER_WRITER, copilot) call `memoryQuery`
 * separately with a query text; `ctx.memory` is only useful as
 * "recent context" not "most semantically relevant context".
 *
 * Failures here throw instead of being swallowed per-spec. A silent
 * empty `ctx.memory` would cause OPENER_WRITER / receptionist / etc.
 * to produce subtly worse outputs without any signal that retrieval
 * broke. If `memory` is load-bearing for the worker, the worker
 * should validate non-empty itself; the executor's job is to report
 * the failure rather than hide it.
 */
async function fetchMemoryReads(args: {
  workspaceId: string;
  leadId: string | null;
  specs: MemorySpec[] | undefined;
}): Promise<MemoryHit[]> {
  if (!args.specs || args.specs.length === 0) return [];

  const hits: MemoryHit[] = [];

  for (const spec of args.specs) {
    if (spec.scope === "lead" && !args.leadId) continue;

    const topK = spec.topK ?? 10;
    const where =
      spec.scope === "lead" && args.leadId
        ? {
            workspaceId: args.workspaceId,
            leadId: args.leadId,
            kind: { in: spec.kinds },
          }
        : {
            workspaceId: args.workspaceId,
            kind: { in: spec.kinds },
          };
    const rows = await prisma.semanticMemory.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: topK,
    });

    for (const r of rows) {
      hits.push({
        id: r.id,
        kind: r.kind,
        leadId: r.leadId,
        refType: r.refType,
        refId: r.refId,
        text: r.text,
        metadata: (r.metadata ?? {}) as Record<string, unknown>,
        similarity: null,
        createdAt: r.createdAt,
        nicheScope: r.nicheScope,
      });
    }
  }

  return hits;
}

/**
 * Persists a batch of MemoryWrite entries, embedding each row before
 * insert (unless `skipEmbed`). We use upsert semantics keyed on
 * refType+refId so re-running a worker overwrites rather than
 * accumulating duplicates.
 *
 * A persist failure is surfaced to the caller (not swallowed per-write)
 * so the outer executor can flip the run to FAILED. If we swallowed
 * here, one worker run could partially write memory (some rows land,
 * others don't) and still report SUCCEEDED - exactly the "silent data
 * corruption" scenario we are trying to eliminate. All-or-nothing is
 * safer than partial-success-looks-like-full-success.
 */
async function persistMemoryWrites(
  workspaceId: string,
  writes: MemoryWrite[],
): Promise<void> {
  const {
    upsertAndEmbed,
    upsert,
    upsertWithNicheScopes,
    upsertAndEmbedWithNicheScopes,
  } = await import("@/lib/ai-core/memory");
  const { EmbeddingError } = await import("@/lib/ai-core/embed");
  for (const w of writes) {
    const args = {
      workspaceId,
      kind: w.kind,
      text: w.text,
      leadId: w.leadId ?? null,
      refType: w.refType ?? null,
      refId: w.refId ?? null,
      metadata: w.metadata ?? {},
    };
    try {
      // Asymmetric dual-write path: when the worker hands us a child +
      // parent scope tuple, route through the niche-aware helpers.
      // Positive kinds get dual-rows, negative kinds child-only — see
      // `upsertWithNicheScopes` for the matrix.
      if (w.niche) {
        if (w.skipEmbed) {
          await upsertWithNicheScopes(args, w.niche);
        } else {
          await upsertAndEmbedWithNicheScopes(args, w.niche);
        }
        continue;
      }
      if (w.skipEmbed) {
        await upsert(args);
      } else {
        await upsertAndEmbed(args);
      }
    } catch (err) {
      // Degraded path for embedding failures.
      //
      // The April-26 beta diagnostic on workspace
      // 5496e39e-cc76-41bd-b18b-f1128fb9e41b found that 97/97 FAILED
      // WEBSITE_AUDITOR + REVIEW_ANALYST runs all carried the same
      // error: `Failed to embed after 3 attempts` thrown out of
      // src/lib/ai-core/embed.ts. The worker's primary artifact had
      // already been committed by the time we got here; the post-run
      // memory-write embedding is what was tipping the run to FAILED.
      //
      // BullMQ's outer 3-attempt retry stacked on top of embed's
      // inner 3-attempt retry won't recover a Gemini quota outage,
      // and we already explicitly decided not to wrap embedding
      // failures in RetryableError (see Phase 2 plan in
      // .cursor/plans/discovery-bugs-fix-plan_*).
      //
      // Fallback: persist the memory row WITHOUT an embedding so the
      // text itself is preserved. SemanticMemory.embedding is
      // nullable; rows without embeddings simply don't surface in
      // similarity search until a future re-embed job backfills the
      // vector. This keeps the AgentRun SUCCEEDED when the worker's
      // own work succeeded, while still surfacing the underlying
      // embedding outage in logs.
      //
      // Any non-EmbeddingError still propagates — those are real
      // bugs we want to see fail loudly.
      if (err instanceof EmbeddingError) {
        logger.warn("agent_run.execute.memory_write_embed_failed_degraded", {
          workspaceId,
          kind: w.kind,
          refType: w.refType ?? null,
          err: err instanceof Error ? err.message : String(err),
        });
        if (w.niche) {
          await upsertWithNicheScopes(args, w.niche);
        } else {
          await upsert(args);
        }
        continue;
      }
      throw err;
    }
  }
}

/**
 * Enqueues an orchestrator_advance job for the planner session this
 * run belongs to. Lazy-imported to keep `execute.ts` free of a
 * direct dependency on the orchestrator.
 *
 * Throws on failure; callers that must not roll back a SUCCEEDED row
 * should use `safeNotifyOrchestrator`.
 */
async function notifyOrchestrator(sessionId: string): Promise<void> {
  const { enqueueAdvance } = await import("@/lib/ai-core/orchestrator");
  await enqueueAdvance(sessionId);
}

/**
 * Best-effort planner advance: catches and logs any error so an
 * orchestrator failure cannot revert a successful AgentRun back to
 * FAILED. The session may still be advanced by the watchdog or a
 * manual retry; the run row already records the truth.
 */
async function safeNotifyOrchestrator(
  sessionId: string,
  runId: string,
): Promise<void> {
  try {
    await notifyOrchestrator(sessionId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("agent_run.execute.notify_failed", {
      runId,
      sessionId,
      err: msg,
    });
  }
}

/**
 * Hydrates an AgentWorkerContext from a persisted AgentRun row. Used
 * by both `executeAgentRun` (sync entry point) and
 * `finalizeApifyAgentRun` (webhook entry point) so the context shape
 * the worker sees never differs between the two paths.
 *
 * The workspace + lead reads are eager because every worker reads
 * `ctx.workspace` (for branding/plan/language) and most workers read
 * `ctx.lead` (for primaryType/businessName). Memory pre-fetch follows
 * the worker's `memoryReads` declaration; workers without one get an
 * empty array.
 */
async function hydrateContext(run: AgentRun): Promise<AgentWorkerContext> {
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
      // Hybrid-niche dispatch surface for SUBVERTICAL_CLASSIFIER and
      // any sub-niche-aware downstream worker (opener, mockup, scorer).
      niche: true,
    },
  });

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

  const workerMeta = getWorker(run.workerKind);
  const memory: MemoryHit[] = await fetchMemoryReads({
    workspaceId: run.workspaceId,
    leadId: run.leadId,
    specs: workerMeta?.memoryReads,
  });

  const emit = async (
    event: EventKind,
    payload: Record<string, unknown> = {},
  ): Promise<void> => {
    const { emit: busEmit } = await import("@/lib/ai-core/events");
    await busEmit(event, {
      workspaceId: run.workspaceId,
      leadId: run.leadId ?? null,
      userId: run.userId ?? null,
      ...payload,
    });
  };

  return {
    runId: run.id,
    workspaceId: run.workspaceId,
    workspacePlan: workspace.plan,
    leadId: run.leadId,
    userId: run.userId,
    lead,
    workspace,
    memory,
    plannerSessionId: run.plannerSessionId,
    emit,
    runInputs:
      run.inputsJson != null && typeof run.inputsJson === "object" && !Array.isArray(run.inputsJson)
        ? (run.inputsJson as Record<string, unknown>)
        : {},
  };
}

/**
 * Webhook entry point for async-apify workers. Called by the Apify
 * webhook handler after the actor finishes; mirrors the
 * post-`runWorker` block of `executeAgentRun`:
 *   1. Resolve the worker's `finalize(ctx, payload)` callback.
 *   2. Build AgentWorkerContext from the persisted AgentRun row.
 *   3. Persist memoryWrites returned by the worker.
 *   4. Flip the AgentRun to SUCCEEDED with the produced output.
 *   5. Enqueue an orchestrator_advance if the run belongs to a session.
 *
 * Idempotency is the caller's responsibility: the webhook handler
 * uses a conditional updateMany to ensure two concurrent webhook
 * deliveries can't both run finalize. By the time we land here the
 * row is still in PENDING/RUNNING.
 *
 * On Apify-reported failure (`payload.status !== "SUCCEEDED"`), we
 * skip finalize entirely and mark the row FAILED with a clear
 * diagnostic. We still record `costUsdCents` so quota math reflects
 * actor runs that consumed compute even when the dataset came back
 * empty.
 */
export async function finalizeApifyAgentRun(
  runId: string,
  payload: ApifyFinalizePayload,
): Promise<void> {
  const run = await prisma.agentRun.findUnique({ where: { id: runId } });
  if (!run) {
    logger.warn("agent_run.finalize.missing", { runId });
    return;
  }
  if (run.status !== "PENDING" && run.status !== "RUNNING") {
    logger.warn("agent_run.finalize.not_runnable", { runId, status: run.status });
    return;
  }

  if (payload.status !== "SUCCEEDED") {
    await prisma.agentRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        costUsdCents: payload.costUsdCents,
        errorMsg: `apify_actor_${payload.status.toLowerCase()}: actor returned ${payload.status} after ${payload.items.length} item(s)`,
      },
    });
    if (run.plannerSessionId) {
      await safeNotifyOrchestrator(run.plannerSessionId, runId);
    }
    return;
  }

  let succeeded = false;
  try {
    const finalize = await resolveWorkerFinalize(run.workerKind);
    if (!finalize) {
      throw new Error(
        `Worker ${run.workerKind} declared mode="async-apify" but module exports no finalize() handler`,
      );
    }

    const ctx = await hydrateContext(run);
    const result = await finalize(ctx, payload);

    const memoryWritesFn = await resolveMemoryWrites(run.workerKind);
    if (memoryWritesFn) {
      const writes = await memoryWritesFn(result.output, ctx);
      if (writes && writes.length > 0) {
        await persistMemoryWrites(run.workspaceId, writes);
      }
    }

    await prisma.agentRun.update({
      where: { id: runId },
      data: {
        status: "SUCCEEDED",
        finishedAt: new Date(),
        outputJson: result.output as never,
        artifactUrl: result.artifactUrl ?? null,
        costTokens: result.costTokens ?? 0,
        // Prefer the cost reported by Apify (payload.costUsdCents)
        // over whatever the worker recomputed; the webhook payload is
        // sourced directly from `usageTotalUsd` and is the source of
        // truth for billing.
        costUsdCents: payload.costUsdCents || result.costUsdCents || 0,
      },
    });

    succeeded = true;

    logger.info("agent_run.finalize.done", {
      runId,
      kind: run.workerKind,
      apifyRunId: payload.apifyRunId,
      cents: payload.costUsdCents,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("agent_run.finalize.failed", {
      runId,
      kind: run.workerKind,
      err: msg,
    });
    await prisma.agentRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        costUsdCents: payload.costUsdCents,
        errorMsg: msg.slice(0, 2000),
      },
    });
  }

  // Always advance the planner: success and failure both transition
  // the AgentRun to a terminal state, so the orchestrator should be
  // notified either way. Errors are swallowed by safeNotifyOrchestrator
  // so a queue blip does not undo the SUCCEEDED row above.
  if (run.plannerSessionId) {
    await safeNotifyOrchestrator(run.plannerSessionId, runId);
  }

  // succeeded is referenced for log clarity in case future telemetry
  // wants to gate on the outcome at this layer.
  void succeeded;
}
