/**
 * AI Core - planner.
 *
 * Turns an event (or a free-form intent) into a PlannerSession row with
 * a concrete plan JSON. Two entry points:
 *
 *   1. `planFromEvent(event, payload)` - resolves the chain from
 *      `chains.ts` and persists the session. This is the deterministic
 *      path; 95% of our orchestration traffic goes through here.
 *
 *   2. `planFromIntent(message, ctx)` - used by the copilot router
 *      when the user asks something that cannot be satisfied with a
 *      pre-built chain ("research these three leads and write openers
 *      in a playful tone"). Returns a dynamic plan without committing
 *      to a session yet; the router persists it after the user
 *      confirms the proposed steps.
 *
 * After creating a session, both paths enqueue an orchestrator_advance
 * job so the first "ready" steps (zero-dependency) fan out. See
 * `src/lib/ai-core/orchestrator.ts` for the DAG walking logic.
 */
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { EventKind } from "@/lib/agent-workers/types";
import type { PlannerTrigger } from "@/generated/prisma/client";
import { getChain, type Chain } from "./chains";
import { enqueueAdvance } from "./orchestrator";
import type { EventPayload } from "./events";

/**
 * The serialized plan shape persisted to `PlannerSession.plan`.
 * Mirrors `Chain` but keeps per-step status so the UI can render
 * progress without joining to AgentRun.
 */
export interface PersistedPlanStep {
  stepId: string;
  workerKind: string;
  dependsOn: string[];
  optional?: boolean;
  inputs?: Record<string, unknown>;
  /**
   * Filled in by the orchestrator as steps progress. The initial
   * planner write sets every step to "PENDING".
   */
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "SKIPPED";
  /**
   * AgentRun id when the orchestrator has scheduled this step.
   */
  runId?: string;
}

export type PersistedPlan = PersistedPlanStep[];

export interface PlanResult {
  id: string;
  plan: PersistedPlan;
  status: "PLANNING" | "EXECUTING" | "COMPLETED" | "FAILED" | "CANCELLED";
}

function chainToPersistedPlan(chain: Chain): PersistedPlan {
  return chain.map((step) => ({
    stepId: step.stepId,
    workerKind: step.workerKind,
    dependsOn: step.dependsOn,
    optional: step.optional ?? false,
    inputs: step.inputs,
    status: "PENDING",
  }));
}

/**
 * Maps an EventKind to the PlannerTrigger enum value for storage.
 */
function eventToTrigger(event: EventKind): PlannerTrigger {
  switch (event) {
    case "user_one_click_pitch":
    case "user_receptionist_with_kb":
      return "USER_BUTTON";
    case "user_deep_research":
      return "USER_DEEP_RESEARCH";
    case "user_bulk_pitch":
      return "USER_BULK";
    case "lead_created":
    case "inbox_reply_received":
    default:
      return "EVENT";
  }
}

function humanGoal(event: EventKind, payload: EventPayload): string {
  const lead = payload.leadId ? ` lead=${payload.leadId}` : "";
  switch (event) {
    case "lead_created":
      return `Process newly created${lead}`;
    case "inbox_reply_received":
      return `Attribute inbox reply${lead}`;
    case "user_one_click_pitch":
      return `One-click pitch pack${lead}`;
    case "user_deep_research":
      return `Deep research enrichment${lead}`;
    case "user_receptionist_with_kb":
      return `AI receptionist with knowledge base${lead}`;
    case "user_bulk_pitch":
      return `Bulk pitch pack (workspace=${payload.workspaceId})`;
    default:
      return `Run chain ${event}${lead}`;
  }
}

/**
 * Persists a PlannerSession from a named event. Enqueues the first
 * orchestrator_advance job before returning.
 */
export async function planFromEvent(
  event: EventKind,
  payload: EventPayload,
): Promise<PlanResult> {
  const chain = getChain(event);
  if (!chain || chain.length === 0) {
    throw new Error(`Planner: no chain registered for event "${event}"`);
  }

  const persistedPlan = chainToPersistedPlan(chain);

  const session = await prisma.plannerSession.create({
    data: {
      workspaceId: payload.workspaceId,
      userId: payload.userId ?? null,
      leadId: payload.leadId ?? null,
      goal: humanGoal(event, payload),
      plan: persistedPlan as never,
      status: "PLANNING",
      triggeredBy: eventToTrigger(event),
    },
  });

  logger.info("planner.session_created", {
    sessionId: session.id,
    event,
    workspaceId: payload.workspaceId,
    leadId: payload.leadId ?? null,
    steps: persistedPlan.length,
  });

  // Kick the orchestrator.
  await enqueueAdvance(session.id);

  return {
    id: session.id,
    plan: persistedPlan,
    status: "PLANNING",
  };
}

/**
 * Builds a dynamic plan from a free-form user intent. Returns the
 * PersistedPlan WITHOUT creating a session yet; the caller (router)
 * decides whether to persist + execute after previewing the plan to
 * the user. Currently a thin shim around `planFromEvent` that picks
 * the closest named chain; the Gemini-powered "synthesize a new
 * chain" path lives in `router.ts` and calls back into here once it
 * decides which named chain to instantiate.
 */
export async function planFromIntent(
  message: string,
  ctx: {
    workspaceId: string;
    userId?: string | null;
    leadId?: string | null;
    chain: EventKind;
  },
): Promise<PersistedPlan> {
  const chain = getChain(ctx.chain);
  if (!chain) {
    throw new Error(`Planner: cannot build intent plan, unknown chain "${ctx.chain}"`);
  }
  logger.info("planner.intent_preview", {
    chain: ctx.chain,
    workspaceId: ctx.workspaceId,
    leadId: ctx.leadId ?? null,
    intent: message.slice(0, 120),
  });
  return chainToPersistedPlan(chain);
}

/**
 * Commits a previewed intent plan by creating the PlannerSession and
 * kicking the orchestrator. Separate from `planFromIntent` so the
 * router can preview without committing.
 */
export async function commitIntentPlan(args: {
  workspaceId: string;
  userId?: string | null;
  leadId?: string | null;
  chain: EventKind;
  goal: string;
  plan: PersistedPlan;
}): Promise<PlanResult> {
  const session = await prisma.plannerSession.create({
    data: {
      workspaceId: args.workspaceId,
      userId: args.userId ?? null,
      leadId: args.leadId ?? null,
      goal: args.goal,
      plan: args.plan as never,
      status: "PLANNING",
      triggeredBy: "USER_COPILOT",
    },
  });

  await enqueueAdvance(session.id);

  return { id: session.id, plan: args.plan, status: "PLANNING" };
}
