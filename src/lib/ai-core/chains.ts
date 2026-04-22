/**
 * AI Core - deterministic chain definitions.
 *
 * A "chain" is a DAG of worker invocations that the planner produces
 * for a given event. Each step declares `dependsOn` by stepId;
 * orchestrator.advance() walks the graph and enqueues ready steps.
 *
 * Keep this file purely declarative; logic belongs in
 * `src/lib/ai-core/orchestrator.ts`. A new event type is added by:
 *   1. Append it to the `EventKind` union in
 *      `src/lib/agent-workers/types.ts`.
 *   2. Add a new entry to `CHAINS` below.
 *   3. Call `emit("<new_event>", { workspaceId, ... })` from wherever
 *      the trigger originates.
 *
 * Step ids are local to a chain; they exist purely so `dependsOn`
 * references are unambiguous when the same worker appears twice
 * (e.g. `SALES_OPPORTUNITY_SCORER` running before and after deep
 * research). Prefer lowercase-snake ids.
 */
import type { AgentWorkerKind } from "@/generated/prisma/client";
import type { EventKind } from "@/lib/agent-workers/types";

export interface ChainStep {
  /**
   * Local unique id within the chain. Use the worker kind in lowercase
   * when no collision risk.
   */
  stepId: string;
  workerKind: AgentWorkerKind;
  /**
   * stepId references (not workerKinds) of upstream steps. Empty
   * array = fan-out root; orchestrator runs all zero-dep steps in
   * parallel.
   */
  dependsOn: string[];
  /**
   * When true, chain continues even if this step fails. Used for
   * optional enrichment like APIFY_INSTAGRAM_DEEP where a profile may
   * not exist for this lead.
   */
  optional?: boolean;
  /**
   * Free-form input override merged into AgentRun.inputsJson.
   */
  inputs?: Record<string, unknown>;
}

export type Chain = ChainStep[];

/**
 * Sentinel worker kinds that are not in `AgentWorkerKind` enum. The
 * orchestrator handles these inline rather than resolving them through
 * the registry. Keep the list small; each sentinel is a tiny SQL-only
 * step (embed a lead profile, write an opener outcome) that would be
 * overkill to wrap as a full worker.
 *
 * The string literals match what the orchestrator matches against in
 * advance().
 */
export const SENTINEL_STEPS = {
  EMBED_LEAD_PROFILE: "__EMBED_LEAD_PROFILE__",
  WRITE_OPENER_OUTCOME: "__WRITE_OPENER_OUTCOME__",
} as const;

/**
 * Chains are a partial record because not every EventKind needs a
 * pre-built chain; some (copilot-triggered custom plans) are built
 * dynamically by the router.
 */
export const CHAINS: Partial<Record<EventKind, Chain>> = {
  // ---------- Intelligence chain for newly ingested leads ----------
  // Auto-fires on every Lead row creation. Legacy status columns are
  // maintained inside each worker for backward compat until Phase 2
  // drops them. REVIEW_ANALYST + WEBSITE_AUDITOR fan out in parallel;
  // APIFY_SERP_RANK piggybacks on the same run to harvest social-
  // profile URLs from Google's organic results (Instagram, Facebook,
  // LinkedIn etc. almost always appear on page 1 for a business-name
  // query, so we get social coverage even for leads with no website).
  // SOCIAL_SCRAPER waits for both audit AND serp so it sees the
  // merged socialProfiles blob. SALES_OPPORTUNITY_SCORER waits for
  // audit + review; it is NOT blocked on the optional Apify step so
  // FREE-tier workspaces (SERP quota = 0, step SKIPPED) still score
  // their leads on time.
  lead_created: [
    { stepId: "audit", workerKind: "WEBSITE_AUDITOR", dependsOn: [] },
    // APIFY_SERP_RANK runs after audit so the WebsiteAudit row
    // exists before we merge SERP-sourced socials into it, and so
    // we don't race the auditor's own upsert. Optional = FREE-tier
    // quota/plan-gate failures are SKIPPED rather than FAILED.
    {
      stepId: "serp",
      workerKind: "APIFY_SERP_RANK",
      dependsOn: ["audit"],
      optional: true,
    },
    {
      stepId: "social",
      workerKind: "SOCIAL_SCRAPER",
      dependsOn: ["audit", "serp"],
      optional: true,
    },
    { stepId: "review", workerKind: "REVIEW_ANALYST", dependsOn: [], optional: true },
    {
      stepId: "email_verify",
      workerKind: "EMAIL_VERIFIER",
      dependsOn: ["audit"],
      optional: true,
    },
    {
      stepId: "score",
      workerKind: "SALES_OPPORTUNITY_SCORER",
      dependsOn: ["audit", "review"],
    },
    // Sentinel: embed a compact LEAD_PROFILE row so the lead is
    // immediately searchable by copilot + lookalike queries.
    {
      stepId: "embed_profile",
      workerKind: "SALES_OPPORTUNITY_SCORER" as AgentWorkerKind, // placeholder, handled via sentinel
      dependsOn: ["score"],
      inputs: { __sentinel: SENTINEL_STEPS.EMBED_LEAD_PROFILE },
    },
  ],

  // ---------- Inbox reply attribution ----------
  // Fires when the inbox sync worker finds a reply matching a sent
  // opener. The attributor updates pipeline state; the sentinel write
  // stores OPENER_SUCCESS / OPENER_FAILURE memory for the learning loop.
  inbox_reply_received: [
    {
      stepId: "attribute",
      workerKind: "INBOX_REPLY_ATTRIBUTOR",
      dependsOn: [],
    },
    {
      stepId: "write_outcome",
      workerKind: "INBOX_REPLY_ATTRIBUTOR", // handled via sentinel
      dependsOn: ["attribute"],
      inputs: { __sentinel: SENTINEL_STEPS.WRITE_OPENER_OUTCOME },
    },
  ],

  // ---------- User: one-click pitch pack ----------
  // Mockup + opener (sequential, opener references the mockup URL) +
  // optional video script in parallel with opener.
  user_one_click_pitch: [
    { stepId: "mockup", workerKind: "WEBSITE_MOCKUP_GENERATOR", dependsOn: [] },
    { stepId: "opener", workerKind: "OPENER_WRITER", dependsOn: ["mockup"] },
    {
      stepId: "video",
      workerKind: "VIDEO_SCRIPT_WRITER",
      dependsOn: ["mockup"],
      optional: true,
    },
  ],

  // ---------- User: deep research ----------
  // Apify-backed enrichment. All five data sources fan out in parallel;
  // REVIEW_ANALYST re-runs on the deeper review set; scorer re-runs
  // with full competitor context. Each Apify step is optional so a
  // missing Instagram profile doesn't block the rest.
  user_deep_research: [
    { stepId: "gmaps", workerKind: "APIFY_GMAPS_DEEP", dependsOn: [] },
    { stepId: "webcrawl", workerKind: "APIFY_WEB_CRAWL_DEEP", dependsOn: [], optional: true },
    { stepId: "instagram", workerKind: "APIFY_INSTAGRAM_DEEP", dependsOn: [], optional: true },
    { stepId: "facebook", workerKind: "APIFY_FACEBOOK_DEEP", dependsOn: [], optional: true },
    { stepId: "serp", workerKind: "APIFY_SERP_RANK", dependsOn: [], optional: true },
    {
      stepId: "competitor_ads",
      workerKind: "APIFY_COMPETITOR_ADS",
      dependsOn: ["serp"],
      optional: true,
    },
    {
      stepId: "review_refresh",
      workerKind: "REVIEW_ANALYST",
      dependsOn: ["gmaps"],
    },
    {
      stepId: "score_refresh",
      workerKind: "SALES_OPPORTUNITY_SCORER",
      dependsOn: ["review_refresh"],
    },
    {
      stepId: "embed_profile",
      workerKind: "SALES_OPPORTUNITY_SCORER" as AgentWorkerKind,
      dependsOn: ["score_refresh"],
      inputs: { __sentinel: SENTINEL_STEPS.EMBED_LEAD_PROFILE },
    },
  ],

  // ---------- User: AI receptionist with knowledge base ----------
  // Web crawl first populates PROSPECT_KB_CHUNK memory; the receptionist
  // builder then reads those chunks to ground its FAQ + services.
  user_receptionist_with_kb: [
    { stepId: "webcrawl", workerKind: "APIFY_WEB_CRAWL_DEEP", dependsOn: [] },
    {
      stepId: "receptionist",
      workerKind: "AI_RECEPTIONIST_BUILDER",
      dependsOn: ["webcrawl"],
    },
  ],
};

/**
 * Returns the chain for an event or null if the event has no
 * pre-built chain (copilot-driven custom plans, etc.). Treat a null
 * result as "planner must build a plan dynamically".
 */
export function getChain(event: EventKind): Chain | null {
  return CHAINS[event] ?? null;
}

/**
 * Validates a chain at import time: no duplicate stepIds, no unknown
 * dependsOn references. Called at module load (below) so typos get
 * caught during `next build`.
 */
function validateChain(event: EventKind, chain: Chain): void {
  const seen = new Set<string>();
  for (const step of chain) {
    if (seen.has(step.stepId)) {
      throw new Error(`Chain ${event}: duplicate stepId "${step.stepId}"`);
    }
    seen.add(step.stepId);
  }
  for (const step of chain) {
    for (const dep of step.dependsOn) {
      if (!seen.has(dep)) {
        throw new Error(
          `Chain ${event}: step "${step.stepId}" depends on unknown "${dep}"`,
        );
      }
    }
  }
}

for (const [event, chain] of Object.entries(CHAINS)) {
  if (chain) validateChain(event as EventKind, chain);
}
