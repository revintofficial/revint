/**
 * AI Core - chain definitions.
 *
 * A "chain" is a DAG of worker invocations that the planner produces
 * for a given event. Each step declares `dependsOn` by stepId;
 * orchestrator.advance() walks the graph and enqueues ready steps.
 *
 * Most chains are static (declared in `CHAINS` below). The
 * `lead_created` chain is the exception: it is resolved at planning
 * time from the workspace's `WorkspaceLeadPipeline` row so each
 * workspace can pick a preset (LITE / BALANCED / AGGRESSIVE) or
 * hand-edit the DAG. Use `getDefaultChain(preset, plan)` to derive
 * the steps from a preset; the resolver in `planner.ts` calls into
 * here to materialise them.
 *
 * Keep this file purely declarative; logic belongs in
 * `src/lib/ai-core/orchestrator.ts`. A new event type is added by:
 *   1. Append it to the `EventKind` union in
 *      `src/lib/agent-workers/types.ts`.
 *   2. Add a new entry to `CHAINS` below (or to the preset table for
 *      lead-onboarding events).
 *   3. Call `emit("<new_event>", { workspaceId, ... })` from wherever
 *      the trigger originates.
 *
 * Step ids are local to a chain; they exist purely so `dependsOn`
 * references are unambiguous when the same worker appears twice
 * (e.g. `SALES_OPPORTUNITY_SCORER` running before and after deep
 * research). Prefer lowercase-snake ids.
 */
import type { AgentWorkerKind, Plan, PipelinePreset } from "@/generated/prisma/client";
import type { EventKind } from "@/lib/agent-workers/types";
import { planMeetsMinimum, getWorker } from "@/lib/agent-workers/registry";

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
  // ---------- Inbox reply attribution ----------
  // Fires when the inbox sync worker finds a reply matching a sent
  // opener. The attributor updates pipeline state; the sentinel write
  // stores OPENER_SUCCESS / OPENER_FAILURE memory for the learning loop.
  // SDR Brain v2 — `outcome_attribute` ALSO runs on every inbound
  // reply so the active LeadNextAction + applied CommercialInsight
  // close the loop and bump InsightPerformance counters.
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
    {
      stepId: "outcome_attribute",
      workerKind: "OUTCOME_ATTRIBUTOR",
      dependsOn: ["attribute"],
      optional: true,
    },
  ],

  // ---------- User: one-click pitch pack ----------
  // Strict pre-flight: audit + review + scorer MUST land before
  // mockup so the showcase prompt receives the full
  // SalesOpportunity context (likely_pain_points, best_sales_angle,
  // recommendedPackage). Prior to this rewire the chain fanned out
  // mockup in parallel with opener and the scorer was on a different
  // event entirely, which meant the rep saw a "ruhsuz" generic
  // mockup whenever they clicked pitch-pack on a cold lead.
  //
  // Each pre-flight is `optional` so a transient crawler / Gemini
  // hiccup doesn't fail the whole pitch pack — the downstream
  // mockup + opener degrade gracefully (use whatever signals they
  // can find, e.g. parent-niche pitch angle alone).
  //
  // The scorer carries `inputs.force: false` (default) — the
  // 24h idempotency gate inside the worker short-circuits when a
  // fresh SalesOpportunity row already exists, so a rep clicking
  // pitch-pack a second time only re-runs the cheap steps
  // (mockup + opener).
  user_one_click_pitch: [
    {
      stepId: "audit",
      workerKind: "WEBSITE_AUDITOR",
      dependsOn: [],
      optional: true,
    },
    {
      stepId: "review",
      workerKind: "REVIEW_ANALYST",
      dependsOn: ["audit"],
      optional: true,
    },
    {
      stepId: "score",
      workerKind: "SALES_OPPORTUNITY_SCORER",
      dependsOn: ["audit", "review"],
    },
    {
      stepId: "mockup",
      workerKind: "WEBSITE_MOCKUP_GENERATOR",
      dependsOn: ["score"],
    },
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
      // Bypass the 24h idempotency gate — deep research just
      // ingested a richer review corpus, so we WANT the scorer to
      // re-run against the fresh evidence.
      inputs: { force: true },
    },
    {
      stepId: "embed_profile",
      workerKind: "SALES_OPPORTUNITY_SCORER" as AgentWorkerKind,
      dependsOn: ["score_refresh"],
      // Defense-in-depth: even though the sentinel itself degrades on
      // EmbeddingError (writes the row without a vector), marking the
      // step optional ensures the planner_session keeps walking the
      // DAG if any other transient sentinel error surfaces.
      optional: true,
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

  // ---------- SDR Brain — voice note added ----------
  // Triggered by `POST /api/leads/[id]/voice-notes` after the audio
  // is transcribed. Refreshes SPIN discovery + MEDDPICC qualification
  // so the lead detail page shows the new evidence within ~10s. Both
  // optional so a transcript that doesn't surface qualifying signal
  // doesn't fail the session.
  voice_note_added: [
    {
      stepId: "spin",
      workerKind: "SPIN_EXTRACTOR",
      dependsOn: [],
      optional: true,
    },
    {
      stepId: "meddpicc",
      workerKind: "MEDDPICC_EXTRACTOR",
      dependsOn: [],
      optional: true,
    },
  ],

  // ---------- SDR Brain — disposition logged ----------
  // Triggered when the rep marks a call outcome (replied / not
  // interested / scheduled callback). The attributor closes the loop
  // on the active LeadNextAction + applied CommercialInsight.
  disposition_logged: [
    {
      stepId: "attribute",
      workerKind: "OUTCOME_ATTRIBUTOR",
      dependsOn: [],
    },
  ],

  // ---------- SDR Brain — watchlist stage changed ----------
  // Triggered when a deal advances or regresses in the kanban. The
  // attributor only writes a terminal outcome on WON/LOST moves;
  // intermediate moves get a lighter-weight refresh.
  watchlist_stage_changed: [
    {
      stepId: "attribute",
      workerKind: "OUTCOME_ATTRIBUTOR",
      dependsOn: [],
    },
  ],

  // ---------- SDR Brain — final NBA persisted ----------
  // Fired by LEAD_INTELLIGENCE_BRIEF after the brief upserts the final
  // (non-preliminary) LeadNextAction. Only the opener refreshes here —
  // the enterprise-B2B reasoners (BANT / Buying Committee /
  // Objection Predictor / Commercial Insight Matcher / Account Tier)
  // were removed because they produced empty or copy-paste output for
  // SMB restaurant-tech sales (single-owner buyer, no "buying
  // committee", no enterprise authority chain).
  sdr_brain_completed: [
    {
      stepId: "opener_refresh",
      workerKind: "OPENER_WRITER",
      dependsOn: [],
      optional: true,
    },
  ],

  // ---------- Reviews-changed re-analysis ----------
  // Fired by /api/reviews/[leadId] after fresh GoogleReview rows are
  // written, so REVIEW_ANALYST + SCORER + DOSSIER can refresh against
  // the new corpus. Every step is optional so a workspace that has
  // turned off the dossier preset still gets review + score updates.
  lead_reviews_updated: [
    {
      stepId: "review_refresh",
      workerKind: "REVIEW_ANALYST",
      dependsOn: [],
    },
    {
      stepId: "score_refresh",
      workerKind: "SALES_OPPORTUNITY_SCORER",
      dependsOn: ["review_refresh"],
      // Reviews just changed — force-skip the 24h idempotency gate
      // so the scorer re-runs against the new corpus.
      inputs: { force: true },
    },
    {
      stepId: "embed_profile",
      workerKind: "SALES_OPPORTUNITY_SCORER" as AgentWorkerKind,
      dependsOn: ["score_refresh"],
      optional: true,
      inputs: { __sentinel: SENTINEL_STEPS.EMBED_LEAD_PROFILE },
    },
    {
      stepId: "dossier_refresh",
      workerKind: "LEAD_DOSSIER_GENERATOR",
      dependsOn: ["score_refresh"],
      optional: true,
    },
  ],
};

/**
 * Returns the chain for an event or null if the event has no
 * pre-built chain (copilot-driven custom plans, etc.). Treat a null
 * result as "planner must build a plan dynamically".
 *
 * NOTE: `lead_created` is not in CHAINS — it is resolved per
 * workspace by `resolveLeadCreatedChain` in `planner.ts` from the
 * `WorkspaceLeadPipeline` row. Callers that need the lead_created
 * chain MUST go through the planner, not getChain().
 */
export function getChain(event: EventKind): Chain | null {
  return CHAINS[event] ?? null;
}

/**
 * Workers that may appear in lead_created presets, ordered for the
 * editor UI. Anything not in this set is rejected by `validateChain`
 * when a workspace tries to PUT a CUSTOM steps array — keeps owners
 * from accidentally adding e.g. INBOX_REPLY_ATTRIBUTOR (no lead
 * context) to the lead-onboarding pipeline.
 *
 * FineDine deployment redesign — `GOOGLE_PLACES_REVIEWS` and
 * `WEBSITE_MOCKUP_GENERATOR` are intentionally OUT of this set:
 *  - Places reviews max at 5 per business which biases sentiment;
 *    reviews now come exclusively from APIFY_GMAPS_DEEP.
 *  - Mockup generation is on-demand only — the rep clicks
 *    "Generate Mockup" on the lead detail when they're about to
 *    actually use it, firing the explicit `user_one_click_pitch`
 *    chain. Auto-mockup at ingest burned Gemini tokens on leads
 *    that the rep never even opened.
 * Both workers are still implemented and dispatched by other event
 * chains; they're just blocked from the lead-onboarding pipeline.
 */
/**
 * The only workers a lead_created chain may contain. A CUSTOM
 * workspace pipeline that names anything else fails validation.
 *
 * 2026-09-29 — narrowed to the four steps of the default chain.
 * Everything else (score, dossier, ICP, triggers, why-now, opener,
 * mockup, social, SERP, email, classifier, deep crawl, and the V2
 * enterprise residue) is still a valid worker and still runs from a
 * click chain — it is simply not something a lead pipeline may
 * schedule automatically. Keep this set in sync with
 * `TRACE_GROUPS` in `src/lib/control/trace-groups.ts`: the control
 * room renders one group per entry here.
 */
export const LEAD_PIPELINE_ALLOWED_WORKERS: ReadonlySet<AgentWorkerKind> = new Set<AgentWorkerKind>([
  "APIFY_GMAPS_DEEP",
  "WEBSITE_AUDITOR",
  "REVIEW_ANALYST",
  "LEAD_INTELLIGENCE_BRIEF",
]);

/**
 * Returns the canonical lead_created DAG for a (preset, plan) tuple.
 * Workers above the workspace plan are filtered OUT of the steps so
 * a FREE workspace on AGGRESSIVE preset gets the BALANCED-ish set
 * (no Apify, no auto mockup) instead of having every Apify step
 * fail with PlanTooLow at run time.
 *
 * The planner persists the result of this function as the workspace's
 * pipeline `steps` JSON when the row is first created, then hands it
 * to the orchestrator. Editing the row to CUSTOM disables this
 * regenerator (the saved steps are used as-is).
 */
export function getDefaultChain(preset: PipelinePreset, plan: Plan): Chain {
  // 2026-09-29 — three evidence collectors plus one decision.
  //
  // Every interpreting worker (SALES_OPPORTUNITY_SCORER,
  // LEAD_DOSSIER_GENERATOR, ICP_SCORER, TRIGGER_DETECTOR,
  // WHY_NOW_SYNTHESIZER, OPENER_WRITER) left the automatic chain:
  // each of them wrote a second sales narrative on top of the brief,
  // and on real FineDine accounts the two narratives contradicted
  // each other (a restaurant with a live booking provider was pitched
  // "Multi-location / GROWTH" by the scorer while the brief said
  // something else). The only decision now lives inside
  // LEAD_INTELLIGENCE_BRIEF, in the head agent. They stay in the enum
  // and still run when an SDR clicks (user_one_click_pitch,
  // user_deep_research).
  //
  // SOCIAL_SCRAPER, APIFY_SERP_RANK, EMAIL_VERIFIER and
  // SUBVERTICAL_CLASSIFIER left for the opposite reason: they were
  // empty or quota-blocked on almost every lead (170 of 245 social
  // runs returned {}, 77 of 80 SERP runs and 78 of 80 email runs hit
  // a 0/0 quota). A step that is empty on 90% of leads is noise in
  // the trace, not evidence. The sub-niche rule now runs inside the
  // brief.
  //
  // APIFY_WEB_CRAWL_DEEP left because its only consumers were the
  // dossier and the trigger detector, and it shared the Apify quota
  // with the map pull that the review analyst actually needs.
  //
  // See docs/admin-paneli-son-karar.md (Çelişki 1) and
  // docs/analiz-ve-playbook.md §3.

  // Reviews come from the Apify deep pull only. The Places
  // "lookup" endpoint caps at five reviews per business, which is
  // too thin a corpus to read percentages off — a 29,744-review
  // restaurant was being analysed from five cherry-picked entries.
  const apifyGmaps: ChainStep = {
    stepId: "apify_gmaps",
    workerKind: "APIFY_GMAPS_DEEP",
    dependsOn: [],
    optional: true,
  };
  // Optional so a transient crawl failure (timeout, 403, robots
  // block) does not hardFailure the orchestrator and starve the
  // brief of its turn. The brief tolerates a SKIPPED audit and
  // records the gap in missingSources.
  const audit: ChainStep = {
    stepId: "audit",
    workerKind: "WEBSITE_AUDITOR",
    dependsOn: [],
    optional: true,
  };
  // Runs against the deep corpus, never the Places five. Self-skips
  // below the corpus threshold rather than writing KPI bars that a
  // reviewer would read as a measurement.
  const reviewRefresh: ChainStep = {
    stepId: "review_refresh",
    workerKind: "REVIEW_ANALYST",
    dependsOn: ["apify_gmaps"],
    optional: true,
  };
  // The single rep-facing artifact. Waits for every data step so it
  // reads one complete evidence set; optional upstreams mean a dead
  // source produces a thinner brief, not no brief.
  const intelligenceBrief: ChainStep = {
    stepId: "intelligence_brief",
    workerKind: "LEAD_INTELLIGENCE_BRIEF",
    dependsOn: ["apify_gmaps", "audit", "review_refresh"],
    optional: true,
  };

  // LITE has no Apify budget, so it has no review corpus either:
  // site plus decision. The brief records "reviews" in
  // missingSources and lowers its own confidence accordingly.
  if (preset === "LITE") {
    return filterByPlan(
      [
        audit,
        { ...intelligenceBrief, dependsOn: ["audit"] },
      ],
      plan,
    );
  }

  // BALANCED and AGGRESSIVE are the same chain. AGGRESSIVE used to
  // add SERP plus an auto opener on every ingested lead; both left
  // the automatic chain, so there is nothing left to differentiate.
  // The preset stays in the enum because workspaces are already set
  // to it and the UI still offers it.
  //
  // filterByPlan drops apify_gmaps on FREE (minPlan PRO) and rewires
  // review_refresh transitively, so a FREE workspace degrades to
  // audit + review_refresh + brief without a DAG break.
  const balanced: Chain = [apifyGmaps, audit, reviewRefresh, intelligenceBrief];

  // CUSTOM has no derived default — the caller supplies the saved
  // steps from the workspace row. BALANCED here is a safety net for
  // a freshly inserted CUSTOM row that has not been edited yet.
  return filterByPlan(balanced, plan);
}

/**
 * Drops steps whose worker kind is above the workspace's plan, then
 * rewires `dependsOn` so removed steps don't leave dangling refs.
 * Removed steps are conservatively replaced by their own dependencies
 * — i.e. anything that depended on a removed step now depends on
 * everything that step depended on (transitive close).
 */
function filterByPlan(chain: Chain, plan: Plan): Chain {
  const allowedSteps = new Map<string, ChainStep>();
  // First pass: keep only plan-eligible steps (sentinel steps are
  // always kept; their workerKind field is a placeholder).
  for (const step of chain) {
    const isSentinel = (step.inputs?.__sentinel ?? null) !== null;
    if (isSentinel) {
      allowedSteps.set(step.stepId, step);
      continue;
    }
    const worker = getWorker(step.workerKind);
    if (!worker) continue;
    if (!planMeetsMinimum(plan, worker.minPlan)) continue;
    allowedSteps.set(step.stepId, step);
  }

  // Compute the transitive closure of dependsOn for each removed
  // step so we can rewire dependents.
  const removed = new Set<string>();
  for (const step of chain) {
    if (!allowedSteps.has(step.stepId)) removed.add(step.stepId);
  }

  function transitiveDeps(stepId: string, seen = new Set<string>()): string[] {
    if (seen.has(stepId)) return [];
    seen.add(stepId);
    const orig = chain.find((s) => s.stepId === stepId);
    if (!orig) return [];
    const out: string[] = [];
    for (const d of orig.dependsOn) {
      if (allowedSteps.has(d)) {
        out.push(d);
      } else if (removed.has(d)) {
        out.push(...transitiveDeps(d, seen));
      }
    }
    return out;
  }

  const result: Chain = [];
  for (const step of chain) {
    if (!allowedSteps.has(step.stepId)) continue;
    const newDeps = Array.from(
      new Set(
        step.dependsOn.flatMap((d) =>
          allowedSteps.has(d) ? [d] : transitiveDeps(d),
        ),
      ),
    );
    result.push({ ...step, dependsOn: newDeps });
  }

  return result;
}

/**
 * Validates an arbitrary chain (e.g. one a workspace owner saved as
 * CUSTOM via the editor): no duplicate stepIds, no unknown
 * `dependsOn` refs, every workerKind is in the allowed set for lead
 * onboarding, no cycles. Throws a `ChainValidationError` with a
 * stable message so the API can surface it to the UI.
 *
 * Skipped for the static `CHAINS` map below because those are
 * developer-authored and validated at module load time.
 */
export class ChainValidationError extends Error {
  constructor(public reason: string) {
    super(reason);
    this.name = "ChainValidationError";
  }
}

export function validateLeadPipelineChain(chain: Chain): void {
  if (!Array.isArray(chain) || chain.length === 0) {
    throw new ChainValidationError("Pipeline must contain at least one step");
  }

  const seen = new Set<string>();
  for (const step of chain) {
    if (!step || typeof step !== "object") {
      throw new ChainValidationError("Step is not an object");
    }
    if (typeof step.stepId !== "string" || !step.stepId) {
      throw new ChainValidationError("Step is missing stepId");
    }
    if (seen.has(step.stepId)) {
      throw new ChainValidationError(`Duplicate stepId "${step.stepId}"`);
    }
    seen.add(step.stepId);

    const isSentinel = (step.inputs?.__sentinel ?? null) !== null;
    if (
      !isSentinel &&
      !LEAD_PIPELINE_ALLOWED_WORKERS.has(step.workerKind)
    ) {
      throw new ChainValidationError(
        `Worker "${step.workerKind}" is not allowed in lead-pipeline chains`,
      );
    }

    if (!Array.isArray(step.dependsOn)) {
      throw new ChainValidationError(
        `Step "${step.stepId}".dependsOn must be an array`,
      );
    }
  }

  for (const step of chain) {
    for (const dep of step.dependsOn) {
      if (!seen.has(dep)) {
        throw new ChainValidationError(
          `Step "${step.stepId}" depends on unknown "${dep}"`,
        );
      }
    }
  }

  // Cycle detection — DFS with a stack. Sentinel placeholders are
  // treated as ordinary nodes here.
  const adj = new Map<string, string[]>();
  for (const step of chain) adj.set(step.stepId, step.dependsOn);
  const colour = new Map<string, "white" | "grey" | "black">();
  for (const step of chain) colour.set(step.stepId, "white");
  function visit(id: string): void {
    if (colour.get(id) === "grey") {
      throw new ChainValidationError(`Cycle detected at step "${id}"`);
    }
    if (colour.get(id) === "black") return;
    colour.set(id, "grey");
    for (const next of adj.get(id) ?? []) visit(next);
    colour.set(id, "black");
  }
  for (const step of chain) visit(step.stepId);
}

/**
 * Validates a developer-authored static chain at module load time:
 * no duplicate stepIds, no unknown dependsOn references. Caught
 * during `next build`.
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
