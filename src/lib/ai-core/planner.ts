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
import type { PlannerTrigger, PipelinePreset, Plan } from "@/generated/prisma/client";
import {
  getChain,
  getDefaultChain,
  validateLeadPipelineChain,
  ChainValidationError,
  type Chain,
} from "./chains";
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
    // SDR Brain v2 — discovery + outcome events. The voice note +
    // disposition events originate from the rep clicking a button in
    // the UI, so they're USER_BUTTON-triggered. Stage changes and the
    // brain-completed reaction event are system EVENTs.
    case "voice_note_added":
    case "disposition_logged":
      return "USER_BUTTON";
    case "watchlist_stage_changed":
    case "outcome_attributed":
    case "sdr_brain_completed":
    case "lead_created":
    case "lead_reviews_updated":
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
    case "lead_reviews_updated":
      return `Refresh review-derived analyses${lead}`;
    case "inbox_reply_received":
      return `Attribute inbox reply${lead}`;
    case "user_one_click_pitch":
      return `One-click pitch pack${lead}`;
    case "user_deep_research":
      return `Deep research enrichment${lead}`;
    case "user_receptionist_with_kb":
      return `AI receptionist with knowledge base${lead}`;
    case "voice_note_added":
      return `Refresh discovery + qualification from voice note${lead}`;
    case "disposition_logged":
      return `Attribute call disposition${lead}`;
    case "watchlist_stage_changed":
      return `Attribute pipeline stage change${lead}`;
    case "outcome_attributed":
      return `Outcome attributed${lead}`;
    case "sdr_brain_completed":
      return `SDR Brain completed${lead}`;
    default:
      return `Run chain ${event}${lead}`;
  }
}

/**
 * Resolves the `lead_created` chain for a workspace by reading the
 * `WorkspaceLeadPipeline` row. If the row does not exist yet, a
 * BALANCED preset row is inserted (workspaces created before this
 * feature shipped get the default behaviour automatically).
 *
 * For non-CUSTOM presets the steps are regenerated from the preset
 * + workspace plan on every read so a plan upgrade unlocks new
 * workers immediately. CUSTOM presets are returned as-is.
 *
 * Returns `null` only when the saved CUSTOM steps are empty / invalid;
 * the caller falls back to BALANCED in that case so a misconfigured
 * row never silently disables ingest.
 */
export async function resolveLeadCreatedChain(workspaceId: string): Promise<Chain> {
  const ws = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: {
      id: true,
      plan: true,
      leadPipeline: {
        select: { preset: true, steps: true, enabled: true },
      },
    },
  });

  // No pipeline row yet — create one with BALANCED defaults so the
  // backfill migration is not strictly required for new workspaces.
  // Race-safe: if two parallel ingests fire on a brand-new workspace,
  // the first wins via the `@unique workspaceId` constraint and the
  // second does an upsert no-op.
  if (!ws.leadPipeline) {
    const preset: PipelinePreset = "BALANCED";
    const steps = getDefaultChain(preset, ws.plan);
    await prisma.workspaceLeadPipeline.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        preset,
        steps: steps as unknown as object,
        enabled: true,
      },
      update: {},
    });
    logger.info("planner.lead_pipeline_seeded", {
      workspaceId,
      preset,
      stepCount: steps.length,
    });
    return steps;
  }

  if (!ws.leadPipeline.enabled) {
    logger.info("planner.lead_pipeline_disabled", { workspaceId });
    return [];
  }

  const preset = ws.leadPipeline.preset;

  if (preset !== "CUSTOM") {
    return getDefaultChain(preset, ws.plan);
  }

  // CUSTOM preset: trust the saved steps if they validate, fall back
  // to BALANCED otherwise.
  const saved = ws.leadPipeline.steps as unknown as Chain;
  try {
    validateLeadPipelineChain(saved);
    return saved;
  } catch (err) {
    logger.warn("planner.lead_pipeline_custom_invalid_fallback_balanced", {
      workspaceId,
      error: err instanceof ChainValidationError ? err.reason : String(err),
    });
    return getDefaultChain("BALANCED", ws.plan);
  }
}

/**
 * Public helper: returns the canonical chain for a (preset, plan)
 * tuple. Used by the API + UI cost-estimator without touching the DB.
 */
export function getDefaultChainForUi(preset: PipelinePreset, plan: Plan): Chain {
  return getDefaultChain(preset, plan);
}

/**
 * Persists a PlannerSession from a named event. Enqueues the first
 * orchestrator_advance job before returning.
 */
export async function planFromEvent(
  event: EventKind,
  payload: EventPayload,
): Promise<PlanResult | null> {
  // lead_created is workspace-configurable: the chain comes from the
  // WorkspaceLeadPipeline row instead of CHAINS. All other events
  // use the static CHAINS map.
  const chain =
    event === "lead_created"
      ? await resolveLeadCreatedChain(payload.workspaceId)
      : getChain(event);

  if (!chain || chain.length === 0) {
    if (event === "lead_created") {
      // Pipeline disabled via WorkspaceLeadPipeline.enabled = false.
      // This is expected configuration, not an error — return null so
      // the caller (emit) skips session creation quietly.
      logger.info("planner.lead_pipeline_disabled_skip", {
        workspaceId: payload.workspaceId,
      });
      return null;
    }
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
