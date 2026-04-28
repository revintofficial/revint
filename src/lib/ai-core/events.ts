/**
 * AI Core - in-process event bus.
 *
 * Events are the one and only way to start a multi-step AI workflow.
 * When something meaningful happens (lead ingested, inbox reply
 * received, user clicks "one-click pitch") the origination code calls
 * `emit(event, payload)` and this module creates a PlannerSession for
 * the matching chain, then enqueues the first `orchestrator_advance`
 * job.
 *
 * This is intentionally a local event bus, not a kafka/redis fan-out:
 * we already have BullMQ for async work, and an additional pub/sub
 * system would be infrastructure for no benefit at current scale.
 * The `emit()` fn is safe to call from any server-side code (API
 * handlers, workers, cron jobs); all it does is create DB rows +
 * enqueue BullMQ jobs.
 *
 * A small in-memory listener map is also exposed for observability
 * hooks (logger subscription, metrics counters). It runs synchronously
 * AFTER the planner session is persisted so a listener crash cannot
 * prevent the orchestration from starting.
 */
import type { EventKind } from "@/lib/agent-workers/types";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { workspaceHasServicePackages } from "@/lib/workspace";

export interface EventPayload extends Record<string, unknown> {
  workspaceId: string;
  leadId?: string | null;
  userId?: string | null;
  /**
   * Free-form extra inputs that get passed into the first step of the
   * chain as `AgentRun.inputsJson`. Useful for bulk actions
   * ("process these 50 leads") or copilot-triggered runs ("use this
   * tone override").
   */
  inputs?: Record<string, unknown>;
}

export interface EventRecord {
  event: EventKind;
  payload: EventPayload;
  emittedAt: Date;
  /**
   * Populated once the planner accepts the event. Consumers that
   * listen for observability get this post-acceptance so they can
   * correlate log lines with the session row.
   */
  plannerSessionId: string;
}

type Listener = (rec: EventRecord) => void;

const listeners = new Set<Listener>();

/**
 * Subscribes to every event emitted. For observability / logging
 * purposes. Listeners are called synchronously with a best-effort
 * try/catch; they must never throw user-facing errors.
 */
export function onEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyListeners(rec: EventRecord): void {
  for (const listener of listeners) {
    try {
      listener(rec);
    } catch (err) {
      logger.warn("events.listener_threw", {
        event: rec.event,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

/**
 * Public entry. Planner module plugs in via a circular-import-safe
 * lazy require so this file stays dependency-light (API routes can
 * call emit without pulling in the orchestrator bundle).
 */
export async function emit(
  event: EventKind,
  payload: EventPayload,
): Promise<string> {
  if (!payload.workspaceId) {
    throw new Error(`events.emit: workspaceId is required for event ${event}`);
  }

  // ServicePackage gate (P0.4). The dossier picks the recommended
  // tier from the workspace's price card, so a workspace with zero
  // packages produces a dossier that can't recommend anything and a
  // scorer that can't ask Gemini for an id. Rather than burn Gemini
  // credits on a half-formed pipeline, mark the lead as
  // BLOCKED_NEEDS_PACKAGES and bail before the planner spins up. The
  // dashboard banner + onboarding flow prompt the workspace owner to
  // fill in their packages, then `POST /api/leads/process-pending`
  // re-emits `lead_created` for every blocked lead.
  if (event === "lead_created" && payload.leadId) {
    const ok = await workspaceHasServicePackages(payload.workspaceId);
    if (!ok) {
      try {
        await prisma.lead.updateMany({
          where: { id: payload.leadId, workspaceId: payload.workspaceId },
          data: { pipelineStatus: "BLOCKED_NEEDS_PACKAGES" },
        });
      } catch (err) {
        // Status flag is observability, not correctness — never let a
        // schema/migration drift block the rest of the pipeline.
        logger.warn("events.lead_created.block_status_failed", {
          workspaceId: payload.workspaceId,
          leadId: payload.leadId,
          err: err instanceof Error ? err.message : String(err),
        });
      }
      logger.info("events.lead_created.blocked_no_packages", {
        workspaceId: payload.workspaceId,
        leadId: payload.leadId,
      });
      return "";
    }
  }

  // Lazy-load the planner to avoid an import cycle (planner imports
  // types from this module indirectly).
  const { planFromEvent } = await import("./planner");
  const session = await planFromEvent(event, payload);

  if (!session) {
    // planFromEvent returns null when the pipeline is disabled (lead_created
    // with WorkspaceLeadPipeline.enabled = false). This is a no-op, not an
    // error; return an empty string so callers that discard the return value
    // continue without throwing.
    logger.info("events.emit.skipped_pipeline_disabled", {
      event,
      workspaceId: payload.workspaceId,
    });
    return "";
  }

  const rec: EventRecord = {
    event,
    payload,
    emittedAt: new Date(),
    plannerSessionId: session.id,
  };

  logger.info("events.emitted", {
    event,
    workspaceId: payload.workspaceId,
    leadId: payload.leadId ?? null,
    plannerSessionId: session.id,
  });

  notifyListeners(rec);
  return session.id;
}
