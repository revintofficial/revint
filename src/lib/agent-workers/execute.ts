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

    const result = await runWorker(run.workerKind, ctx);

    // Post-run memory writes. The worker's impl module may export a
    // `memoryWrites` callback; we resolve it lazily (same cache as
    // the run handler) and invoke with the run output + context.
    try {
      const memoryWritesFn = await resolveMemoryWrites(run.workerKind);
      if (memoryWritesFn) {
        const writes = await memoryWritesFn(result.output, ctx);
        if (writes && writes.length > 0) {
          await persistMemoryWrites(run.workspaceId, writes);
        }
      }
    } catch (err) {
      // Memory write failures don't fail the run itself; log and
      // move on. The worker's primary artifact already exists.
      logger.warn("agent_run.memory_writes_failed", {
        runId,
        err: err instanceof Error ? err.message : String(err),
      });
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

    // Notify planner if this run belongs to a session.
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
 */
async function fetchMemoryReads(args: {
  workspaceId: string;
  leadId: string | null;
  specs: MemorySpec[] | undefined;
}): Promise<MemoryHit[]> {
  if (!args.specs || args.specs.length === 0) return [];

  const { query } = await import("@/lib/ai-core/memory");
  const hits: MemoryHit[] = [];

  for (const spec of args.specs) {
    // For "lead" scope with no leadId, skip rather than error.
    if (spec.scope === "lead" && !args.leadId) continue;

    try {
      // When we have neither a vector nor free-text (the registry
      // declared the spec statically), we fall back to fetching the
      // N most-recent rows of the requested kinds for the lead.
      // Semantic search without a query vector makes no sense, so
      // this "recent-first" fallback is the right default for
      // pre-fetch-then-augment workflows.
      const topK = spec.topK ?? 10;
      const rows = await (async () => {
        if (spec.scope === "lead" && args.leadId) {
          return prisma.semanticMemory.findMany({
            where: {
              workspaceId: args.workspaceId,
              leadId: args.leadId,
              kind: { in: spec.kinds },
            },
            orderBy: { createdAt: "desc" },
            take: topK,
          });
        }
        return prisma.semanticMemory.findMany({
          where: {
            workspaceId: args.workspaceId,
            kind: { in: spec.kinds },
          },
          orderBy: { createdAt: "desc" },
          take: topK,
        });
      })();

      for (const r of rows) {
        hits.push({
          id: r.id,
          kind: r.kind,
          leadId: r.leadId,
          refType: r.refType,
          refId: r.refId,
          text: r.text,
          metadata: (r.metadata ?? {}) as Record<string, unknown>,
          similarity: 1, // no vector query here, similarity not meaningful
          createdAt: r.createdAt,
        });
      }
      // Silence unused-import warning for `query`: the copilot path
      // uses it separately with a real vector.
      void query;
    } catch (err) {
      logger.warn("agent_run.memory_read_failed", {
        err: err instanceof Error ? err.message : String(err),
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
 */
async function persistMemoryWrites(
  workspaceId: string,
  writes: MemoryWrite[],
): Promise<void> {
  const { upsertAndEmbed, upsert } = await import("@/lib/ai-core/memory");
  for (const w of writes) {
    try {
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
    } catch (err) {
      logger.warn("agent_run.memory_write_failed", {
        kind: w.kind,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

/**
 * Enqueues an orchestrator_advance job for the planner session this
 * run belongs to. Lazy-imported to keep `execute.ts` free of a
 * direct dependency on the orchestrator.
 */
async function notifyOrchestrator(sessionId: string): Promise<void> {
  try {
    const { enqueueAdvance } = await import("@/lib/ai-core/orchestrator");
    await enqueueAdvance(sessionId);
  } catch (err) {
    logger.warn("agent_run.orchestrator_notify_failed", {
      sessionId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
