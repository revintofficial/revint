/**
 * POST /api/leads/bulk-action
 *
 * Fan-out endpoint for the leads list overhaul (Phase 2 / 3). The
 * payload carries an action verb and a set of lead ids; everything
 * runs scoped to the caller's workspace via `requireUser()`.
 *
 * Supported actions:
 *  - "shortlist"      → upsert a WatchlistItem per lead (idempotent).
 *  - "set_stage"      → ensure WatchlistItem exists, then set
 *                       pipelineStage to the supplied value.
 *  - "discard"        → set `Lead.discardedAt = now()`.
 *  - "archive"        → set `Lead.archivedAt = now()`.
 *  - "restore"        → clear archivedAt / discardedAt / snoozeUntil.
 *  - "snooze"         → set `Lead.snoozeUntil` to now + N days
 *                       (default 7).
 *  - "assign"         → set `Lead.assignedToUserId` (workspace-member
 *                       checked).
 *  - "dossier"        → enqueue LEAD_DOSSIER_GENERATOR per lead.
 *  - "mockup"         → enqueue WEBSITE_MOCKUP_GENERATOR per lead.
 *  - "opener"         → enqueue OPENER_WRITER per lead.
 *  - "deep_scan"      → enqueue APIFY_WEB_CRAWL_DEEP per lead.
 *
 * Worker fan-outs hit the existing `assertWorkerQuota()` once with the
 * total lead count so a partial failure keeps the rest of the batch
 * from running. We deliberately do NOT call the per-lead route to
 * avoid the auth round-trip; instead we re-implement the AgentRun +
 * BullMQ enqueue inline (the same shape as
 * /api/leads/[id]/workers/[kind]).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { internalError } from "@/lib/api-errors";
import { logger } from "@/lib/logger";
import { getAgentRunsQueue } from "@/lib/queues";
import { getWorker } from "@/lib/agent-workers/registry";
import { executeAgentRun } from "@/lib/agent-workers/execute";
import {
  assertWorkerQuota,
  PlanTooLowError,
  QuotaExceededError,
} from "@/lib/agent-workers/quota";
import { AgentWorkerKind } from "@/generated/prisma/client";

type BulkAction =
  | "shortlist"
  | "set_stage"
  | "discard"
  | "archive"
  | "restore"
  | "snooze"
  | "assign"
  | "dossier"
  | "mockup"
  | "opener"
  | "deep_scan";

interface BulkActionBody {
  leadIds?: unknown;
  action?: unknown;
  payload?: Record<string, unknown>;
}

const VALID_STAGES = ["NEW", "REACHED_OUT", "IN_TALKS", "WON", "LOST"] as const;
type PipelineStageLiteral = (typeof VALID_STAGES)[number];

const WORKER_ACTIONS: Record<string, AgentWorkerKind> = {
  dossier: AgentWorkerKind.LEAD_DOSSIER_GENERATOR,
  mockup: AgentWorkerKind.WEBSITE_MOCKUP_GENERATOR,
  opener: AgentWorkerKind.OPENER_WRITER,
  deep_scan: AgentWorkerKind.APIFY_WEB_CRAWL_DEEP,
};

const MAX_BULK_LEADS = 500;

// Track whether Redis recently failed so we don't burn through 50 enqueue
// timeouts per batch when the queue is unavailable.
let redisDownUntil = 0;
const REDIS_DOWN_TTL_MS = 30_000;

async function tryEnqueue(runId: string, timeoutMs = 1500): Promise<boolean> {
  if (Date.now() < redisDownUntil) return false;
  try {
    const queue = getAgentRunsQueue();
    const addPromise = queue.add(
      `agent-run-${runId}`,
      { runId },
      {
        attempts: 2,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 500,
        removeOnFail: 500,
      },
    );
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("queue_enqueue_timeout")), timeoutMs),
    );
    await Promise.race([addPromise, timeout]);
    redisDownUntil = 0;
    return true;
  } catch {
    redisDownUntil = Date.now() + REDIS_DOWN_TTL_MS;
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireUser();
    const { workspaceId } = session;
    const body = (await request.json()) as BulkActionBody;
    const action = body.action as BulkAction;
    const rawIds = body.leadIds;

    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return NextResponse.json(
        { error: "leadIds (non-empty array) is required" },
        { status: 400 },
      );
    }
    const leadIds = rawIds.filter((id): id is string => typeof id === "string");
    if (leadIds.length === 0) {
      return NextResponse.json(
        { error: "leadIds must contain at least one string id" },
        { status: 400 },
      );
    }
    if (leadIds.length > MAX_BULK_LEADS) {
      return NextResponse.json(
        { error: `Cannot process more than ${MAX_BULK_LEADS} leads at once` },
        { status: 400 },
      );
    }

    // Confirm every supplied id belongs to the caller's workspace.
    // findMany returns an array we can compare against the input set
    // so a mixed batch (some valid, some cross-tenant) returns the
    // valid count rather than failing the whole call.
    const owned = await prisma.lead.findMany({
      where: { id: { in: leadIds }, workspaceId },
      select: { id: true },
    });
    const ownedIds = owned.map((l) => l.id);
    if (ownedIds.length === 0) {
      return NextResponse.json(
        { error: "No matching leads in this workspace" },
        { status: 404 },
      );
    }

    const payload = body.payload ?? {};

    switch (action) {
      case "shortlist": {
        // Upsert one watchlist row per lead; idempotent. We can't use
        // createMany with skipDuplicates because the unique constraint
        // is leadId-scoped via @relation, not a composite @@unique.
        const existing = await prisma.watchlistItem.findMany({
          where: { leadId: { in: ownedIds } },
          select: { leadId: true },
        });
        const have = new Set(existing.map((w) => w.leadId));
        const toCreate = ownedIds.filter((id) => !have.has(id));
        if (toCreate.length > 0) {
          await prisma.watchlistItem.createMany({
            data: toCreate.map((leadId) => ({ leadId })),
          });
        }
        return NextResponse.json({
          ok: true,
          requested: leadIds.length,
          processed: ownedIds.length,
          created: toCreate.length,
          alreadyShortlisted: have.size,
        });
      }

      case "set_stage": {
        const stage = payload.stage as string | undefined;
        if (!stage || !VALID_STAGES.includes(stage as PipelineStageLiteral)) {
          return NextResponse.json(
            { error: `payload.stage must be one of ${VALID_STAGES.join(", ")}` },
            { status: 400 },
          );
        }
        // Auto-create watchlist items for any leads that don't have
        // one yet, then update the stage in a single batch.
        const existing = await prisma.watchlistItem.findMany({
          where: { leadId: { in: ownedIds } },
          select: { leadId: true },
        });
        const have = new Set(existing.map((w) => w.leadId));
        const toCreate = ownedIds
          .filter((id) => !have.has(id))
          .map((leadId) => ({
            leadId,
            pipelineStage: stage as PipelineStageLiteral,
          }));
        if (toCreate.length > 0) {
          await prisma.watchlistItem.createMany({ data: toCreate });
        }
        const updated = await prisma.watchlistItem.updateMany({
          where: { leadId: { in: ownedIds } },
          data: { pipelineStage: stage as PipelineStageLiteral },
        });
        return NextResponse.json({
          ok: true,
          requested: leadIds.length,
          processed: ownedIds.length,
          updated: updated.count,
          created: toCreate.length,
          stage,
        });
      }

      case "discard": {
        const result = await prisma.lead.updateMany({
          where: { id: { in: ownedIds }, workspaceId },
          data: { discardedAt: new Date() },
        });
        return NextResponse.json({
          ok: true,
          requested: leadIds.length,
          processed: result.count,
        });
      }

      case "archive": {
        const result = await prisma.lead.updateMany({
          where: { id: { in: ownedIds }, workspaceId },
          data: { archivedAt: new Date() },
        });
        return NextResponse.json({
          ok: true,
          requested: leadIds.length,
          processed: result.count,
        });
      }

      case "restore": {
        const result = await prisma.lead.updateMany({
          where: { id: { in: ownedIds }, workspaceId },
          data: {
            archivedAt: null,
            discardedAt: null,
            snoozeUntil: null,
          },
        });
        return NextResponse.json({
          ok: true,
          requested: leadIds.length,
          processed: result.count,
        });
      }

      case "snooze": {
        const days = Number.isFinite(payload.days)
          ? Math.max(1, Math.min(365, Math.trunc(payload.days as number)))
          : 7;
        const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        const result = await prisma.lead.updateMany({
          where: { id: { in: ownedIds }, workspaceId },
          data: { snoozeUntil: until },
        });
        return NextResponse.json({
          ok: true,
          requested: leadIds.length,
          processed: result.count,
          snoozeUntil: until.toISOString(),
        });
      }

      case "assign": {
        const userId =
          typeof payload.userId === "string" ? payload.userId : null;
        if (userId) {
          // Confirm assignee is a workspace member before saving.
          const member = await prisma.workspaceMember.findFirst({
            where: { workspaceId, userId },
            select: { id: true },
          });
          if (!member) {
            return NextResponse.json(
              { error: "Assignee is not a member of this workspace" },
              { status: 400 },
            );
          }
        }
        const result = await prisma.lead.updateMany({
          where: { id: { in: ownedIds }, workspaceId },
          data: { assignedToUserId: userId },
        });
        return NextResponse.json({
          ok: true,
          requested: leadIds.length,
          processed: result.count,
          assignedToUserId: userId,
        });
      }

      case "dossier":
      case "mockup":
      case "opener":
      case "deep_scan": {
        const kind = WORKER_ACTIONS[action];
        const worker = getWorker(kind);
        if (!worker || !worker.phase1Enabled) {
          return NextResponse.json(
            { error: `Worker ${kind} not available` },
            { status: 404 },
          );
        }

        // Quota gate. We check once at batch level — the upstream UI
        // shows an estimate before the call so the rep can shrink the
        // batch if they're close to the cap. The per-run quota check
        // inside `agent-run-worker` still protects against bypass.
        let allowedCount = ownedIds.length;
        try {
          const quota = await assertWorkerQuota({
            workspaceId,
            plan: session.workspace.plan,
            kind,
          });
          if (quota.limit > 0) {
            allowedCount = Math.min(allowedCount, quota.remaining);
          }
        } catch (err) {
          if (err instanceof PlanTooLowError) {
            return NextResponse.json(
              {
                error: "plan_too_low",
                message: `This worker requires the ${err.minPlan} plan or higher.`,
                kind,
                minPlan: err.minPlan,
              },
              { status: 402 },
            );
          }
          if (err instanceof QuotaExceededError) {
            return NextResponse.json(
              {
                error: "quota_exceeded",
                message: `You have used ${err.used}/${err.limit} runs this cycle.`,
                kind,
                used: err.used,
                limit: err.limit,
              },
              { status: 402 },
            );
          }
          throw err;
        }

        if (allowedCount < ownedIds.length) {
          // Partial: clip the batch to fit in the remaining quota.
          ownedIds.length = allowedCount;
        }
        if (allowedCount === 0) {
          return NextResponse.json(
            {
              error: "quota_exceeded",
              message: "No remaining quota for this worker",
              kind,
            },
            { status: 402 },
          );
        }

        const versions = await prisma.lead.findMany({
          where: { id: { in: ownedIds }, workspaceId },
          select: { id: true, subNicheVersion: true },
        });
        const versionById = new Map(versions.map((v) => [v.id, v.subNicheVersion]));

        const runs = await prisma.$transaction(
          ownedIds.map((leadId) =>
            prisma.agentRun.create({
              data: {
                workspaceId,
                leadId,
                userId: session.user.id,
                workerKind: kind,
                status: "PENDING",
                inputsJson: { source: "bulk-action" },
                inputSubNicheVersion: versionById.get(leadId) ?? null,
              },
              select: { id: true },
            }),
          ),
        );

        // Try to enqueue every run; fall back to inline execution per
        // run when Redis is down (same pattern as the per-lead route).
        const results = await Promise.all(
          runs.map(async (run) => {
            const enqueued = await tryEnqueue(run.id);
            if (!enqueued) {
              void executeAgentRun(run.id).catch((err) => {
                logger.error("api.leads.bulk_action.inline_fallback_error", {
                  runId: run.id,
                  err: err instanceof Error ? err.message : String(err),
                });
              });
            }
            return { runId: run.id, mode: enqueued ? "queue" : "inline" };
          }),
        );

        return NextResponse.json({
          ok: true,
          requested: leadIds.length,
          processed: ownedIds.length,
          enqueued: results.filter((r) => r.mode === "queue").length,
          inline: results.filter((r) => r.mode === "inline").length,
          runs: results,
          kind,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unsupported action: ${String(action)}` },
          { status: 400 },
        );
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.leads.bulk_action_error", error);
  }
}
