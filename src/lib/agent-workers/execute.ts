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
import { runWorker, getWorker, resolveMemoryWrites } from "./registry";
import { checkWorkerQuota, QuotaExceededError } from "./quota";
import { RetryableError } from "./errors";
import type {
  AgentWorkerContext,
  EventKind,
  MemoryHit,
  MemorySpec,
  MemoryWrite,
} from "./types";

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
      leadId: run.leadId,
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

    // Pre-fetch declarative memory reads. The worker definition in
    // the registry declares kinds + scope; we resolve them here so
    // each worker's `run()` handler stays pure.
    const workerMeta = getWorker(run.workerKind);
    const memory: MemoryHit[] = await fetchMemoryReads({
      workspaceId: run.workspaceId,
      leadId: run.leadId,
      specs: workerMeta?.memoryReads,
    });

    // Sub-event emitter. Workers that want to trigger a downstream
    // chain (e.g. the opener writer auto-triggering a video script)
    // call `ctx.emit(event, payload)`. We lazy-import to avoid a
    // circular dep through the planner.
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

    const ctx: AgentWorkerContext = {
      runId,
      workspaceId: run.workspaceId,
      workspacePlan: workspace.plan,
      leadId: run.leadId,
      userId: run.userId,
      lead,
      workspace,
      memory,
      plannerSessionId: run.plannerSessionId,
      emit,
    };

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

    // Notify planner if this run belongs to a session. notifyOrchestrator
    // throws on failure (swallowing would leave the session stuck
    // EXECUTING forever with no downstream advance call).
    if (run.plannerSessionId) {
      await notifyOrchestrator(run.plannerSessionId);
    }
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
    if (run.plannerSessionId) {
      await notifyOrchestrator(run.plannerSessionId);
    }
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
  const { upsertAndEmbed, upsert } = await import("@/lib/ai-core/memory");
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
    if (w.skipEmbed) {
      await upsert(args);
    } else {
      await upsertAndEmbed(args);
    }
  }
}

/**
 * Enqueues an orchestrator_advance job for the planner session this
 * run belongs to. Lazy-imported to keep `execute.ts` free of a
 * direct dependency on the orchestrator.
 *
 * We do NOT swallow failures here: if the queue is unreachable AND
 * the enqueueAdvance fallback-to-inline path also throws, the session
 * would otherwise be stuck EXECUTING forever with no caller coming
 * back to advance it. Throwing here lets executeAgentRun mark the
 * run FAILED, which in turn triggers a dev alert and the session can
 * be manually retried.
 */
async function notifyOrchestrator(sessionId: string): Promise<void> {
  const { enqueueAdvance } = await import("@/lib/ai-core/orchestrator");
  await enqueueAdvance(sessionId);
}
