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
export const LEAD_PIPELINE_ALLOWED_WORKERS: ReadonlySet<AgentWorkerKind> = new Set<AgentWorkerKind>([
  "WEBSITE_AUDITOR",
  "SUBVERTICAL_CLASSIFIER",
  "REVIEW_ANALYST",
  "SOCIAL_SCRAPER",
  "EMAIL_VERIFIER",
  "SALES_OPPORTUNITY_SCORER",
  "LEAD_DOSSIER_GENERATOR",
  "LEAD_INTELLIGENCE_BRIEF",
  "OPENER_WRITER",
  "APIFY_GMAPS_DEEP",
  "APIFY_SERP_RANK",
  "APIFY_WEB_CRAWL_DEEP",
  "APIFY_INSTAGRAM_DEEP",
  "APIFY_FACEBOOK_DEEP",
  "APIFY_REDDIT_MENTIONS",
  // SDR Brain v2 (post-V2-cleanup) — only the workers that produce
  // restaurant-tech-relevant output remain. ACCOUNT_TIER_RANKER,
  // BANT_INFERRER, COMMERCIAL_INSIGHT_MATCHER, BUYING_COMMITTEE_MAPPER,
  // and OBJECTION_PREDICTOR were removed: SMB restaurant operators
  // don't have multi-stakeholder buying committees or BANT-style
  // procurement, and their outputs were either empty (>90% skip rate)
  // or recycled copy-paste. STAKEHOLDER_DISCOVERER is omitted (Phase 2).
  "ICP_SCORER",
  "TRIGGER_DETECTOR",
  "WHY_NOW_SYNTHESIZER",
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
  // Audit is `optional` so a transient crawl failure (timeout, 403,
  // robots block) doesn't hardFailure the orchestrator and starve
  // every downstream step of its turn. The classifier, scorer, and
  // dossier all tolerate a SKIPPED audit (they substitute null
  // signals) — see Bug #3 in research/finedine/discovery-bugs.md
  // and the SUBVERTICAL_CLASSIFIER buildClassifierSignals() guard.
  const audit: ChainStep = {
    stepId: "audit",
    workerKind: "WEBSITE_AUDITOR",
    dependsOn: [],
    optional: true,
  };
  // FineDine deployment redesign — `GOOGLE_PLACES_REVIEWS` is no longer
  // part of the default chain. The Places "lookup" endpoint caps at
  // five reviews per business, which is too thin a corpus for the
  // review-analyst (5 cherry-picked top reviews skew sentiment
  // dramatically). Reviews now come exclusively from
  // `APIFY_GMAPS_DEEP` (BALANCED+ presets) which pulls hundreds, and
  // FREE / LITE workspaces simply ship without review evidence
  // until they upgrade — explicit choice over noisy half-data.
  // Hybrid-niche classifier (parent + child packs, e.g. fnb → fnb-bar-club).
  // The worker self-skips for workspaces whose niche has no children.
  //
  // Phase 0/B3 — now `dependsOn: ["audit"]`. Previously the classifier
  // ran in parallel with audit; this raced with the worker's signal
  // builder which WANTS the audit features (QR menu detection, booking
  // widget, multi-location nav) to weight the slug correctly. The
  // worker still tolerates a missing audit (audit is `optional` so
  // it can be SKIPPED, which still satisfies this dependency), so a
  // crawl failure doesn't stall classification — it just falls back
  // to the Places-types/discovery-query rule pass.
  const classifier: ChainStep = {
    stepId: "classifier",
    workerKind: "SUBVERTICAL_CLASSIFIER",
    dependsOn: ["audit"],
    optional: true,
  };
  const score: ChainStep = {
    stepId: "score",
    workerKind: "SALES_OPPORTUNITY_SCORER",
    dependsOn: ["audit", "classifier"],
  };
  const embedProfile: ChainStep = {
    stepId: "embed_profile",
    workerKind: "SALES_OPPORTUNITY_SCORER" as AgentWorkerKind,
    dependsOn: ["score"],
    // The sentinel itself degrades on EmbeddingError (writes the row
    // without a vector and enqueues a re-embed job). Marking the step
    // optional is belt-and-braces: any other transient sentinel
    // failure (DB hiccup at upsert time) doesn't hardFailure the
    // whole planner_session and starve dossier downstream.
    optional: true,
    inputs: { __sentinel: SENTINEL_STEPS.EMBED_LEAD_PROFILE },
  };

  // ----- SDR Brain substrate (post-V2-cleanup) — T1/T2 reasoners ----
  // ICP_SCORER and TRIGGER_DETECTOR are the only deterministic
  // reasoners that survived the V2 enterprise cleanup. Both run on
  // every lead and feed the intelligence brief + Why-Now synthesizer.
  //
  // The dropped reasoners and why:
  //   - ACCOUNT_TIER_RANKER  → 100% skip on real workspaces
  //   - BANT_INFERRER        → enterprise procurement framework that
  //                            doesn't fit single-owner SMB buyers
  //   - BUYING_COMMITTEE_MAPPER → empty output, no UI consumer
  //   - COMMERCIAL_INSIGHT_MATCHER → SalesOpportunityScorer.bestSalesAngle
  //                                  already does this for restaurants
  //   - OBJECTION_PREDICTOR  → recycled copy-paste objections
  const icpScorer: ChainStep = {
    stepId: "icp_scorer",
    workerKind: "ICP_SCORER",
    dependsOn: ["score"],
    optional: true,
  };

  // ----- LITE substrate -----
  // LITE shares ICP_SCORER + TRIGGER_DETECTOR + REVIEW_ANALYST with
  // BALANCED but skips the Apify enrichment layer. WHY_NOW_SYNTHESIZER
  // runs in BALANCED+ where the trigger corpus is richer.
  //
  // Every new step is `optional: true` so any failure (quota, Gemini
  // hiccup, missing input) lets the chain proceed to the brief
  // without stalling. filterByPlan still drops anything above the
  // workspace plan; nothing in the LITE substrate is gated above
  // FREE today.

  // LITE variant of TRIGGER_DETECTOR — drops the `apify_webcrawl`
  // dependency the BALANCED variant has. Worker tolerates the
  // resulting empty PROSPECT_KB_CHUNK memory and falls back to
  // audit + ReviewAnalysis + Lead signals for its deterministic
  // rule pass.
  const triggersLite: ChainStep = {
    stepId: "triggers",
    workerKind: "TRIGGER_DETECTOR",
    dependsOn: ["score"],
    optional: true,
  };
  // LITE variant of REVIEW_ANALYST. BALANCED's `review_refresh`
  // waits for `apify_gmaps` (500-review deep pull). LITE doesn't run
  // Apify so the worker runs against whatever GoogleReview rows the
  // intake captured (typically 0-5 from the Places lookup). It
  // self-skips when corpus < 5 and the dependent brief still
  // proceeds with a clean SKIPPED upstream.
  const reviewRefreshLite: ChainStep = {
    stepId: "review_refresh",
    workerKind: "REVIEW_ANALYST",
    dependsOn: ["score"],
    optional: true,
  };

  // LITE-specific intelligence brief. Same worker as BALANCED, but
  // `dependsOn` matches the LITE substrate (no dossier / social /
  // apify_webcrawl / T2 reasoners). Output is the canonical 0-100
  // sales confidence rollup plus the final NBA + reasoning graph —
  // feeds the v2 decision-surface page identically to BALANCED.
  const intelligenceBriefLite: ChainStep = {
    stepId: "intelligence_brief",
    workerKind: "LEAD_INTELLIGENCE_BRIEF",
    dependsOn: [
      "score",
      "embed_profile",
      "icp_scorer",
      "triggers",
      "review_refresh",
    ],
    optional: true,
  };

  // FREE workspaces on LITE get the audit + classifier + scorer +
  // SDR-Brain substrate + intelligence-brief stack. Reviews come
  // from the Places API only (capped at 5; REVIEW_ANALYST self-skips
  // on thin corpus). Upgrading to BALANCED unlocks the Apify deep-
  // review pull, on-create dossier, social link discovery, and
  // WHY_NOW_SYNTHESIZER on the denser trigger corpus.
  const lite: Chain = [
    audit,
    classifier,
    score,
    embedProfile,
    icpScorer,
    triggersLite,
    reviewRefreshLite,
    intelligenceBriefLite,
  ];

  if (preset === "LITE") {
    return filterByPlan(lite, plan);
  }

  const social: ChainStep = {
    stepId: "social",
    workerKind: "SOCIAL_SCRAPER",
    dependsOn: ["audit"],
    optional: true,
  };
  // Phase 0/B3 — dossier now waits for embed_profile + social + the
  // deep web crawl so the markdown narrative actually has the full
  // signal set before Gemini writes it. Each upstream is optional so
  // a SKIPPED step still unlocks dossier (no FREE-tier regression).
  // Previously: dependsOn: ["score"] — first-pass dossier missed deep
  // crawl context entirely because apify_webcrawl had no downstream
  // edge in the DAG.
  const dossier: ChainStep = {
    stepId: "dossier",
    workerKind: "LEAD_DOSSIER_GENERATOR",
    dependsOn: ["score", "embed_profile", "social", "apify_webcrawl"],
    optional: true,
  };
  // FineDine deployment redesign — `WEBSITE_MOCKUP_GENERATOR` is no
  // longer in any auto chain. Mockups burn Gemini tokens and most
  // discovered leads never see the SDR's screen, so generating a
  // mockup for every lead at ingest was the highest-cost least-used
  // step in the pipeline. Reps now click "Generate Mockup" on the
  // lead detail page when they're actually about to use it, which
  // fires `user_one_click_pitch` (mockup → opener) on demand.

  // ----- BALANCED+ T2 reasoners -----
  // The Apify-fed variants of the T2 trigger detector + WHY_NOW
  // synthesizer (the only restaurant-tech-useful T2 reasoner that
  // survived the V2 cleanup). TRIGGER_DETECTOR depends on
  // `apify_webcrawl` here so the deterministic rule pass can fire
  // `WEB_CHANGE_DETECTED` and similar crawl-derived triggers; LITE
  // uses the slimmer `triggersLite` variant declared above.
  const triggers: ChainStep = {
    stepId: "triggers",
    workerKind: "TRIGGER_DETECTOR",
    dependsOn: ["score", "apify_webcrawl"],
    optional: true,
  };
  const whyNow: ChainStep = {
    stepId: "why_now",
    workerKind: "WHY_NOW_SYNTHESIZER",
    dependsOn: ["triggers"],
    optional: true,
  };

  // Phase 0/B5 — the unified "Sales Confidence" brief. Runs at the
  // END of the chain (after every enrichment + scoring + dossier
  // has either finished or been SKIPPED) so it can read every
  // upstream artifact in one pass and produce a single canonical
  // "what should the rep say / when should they call / what is the
  // confidence" payload. Also writes Lead.salesConfidence and bumps
  // Lead.intelligenceVersion. Optional because a Gemini hiccup here
  // shouldn't FAIL the session — the dossier is still useful on its own.
  //
  // SDR Brain v2 — `intelligence_brief` is the T3 SDR_BRAIN: it reads
  // every T1 + T2 artifact via memory and writes the final
  // LeadNextAction with the reasoning graph + arbitration record. The
  // dependsOn list grows accordingly so the orchestrator schedules it
  // after the brain substrate has been written.
  const intelligenceBrief: ChainStep = {
    stepId: "intelligence_brief",
    workerKind: "LEAD_INTELLIGENCE_BRIEF",
    dependsOn: [
      "score",
      "embed_profile",
      "dossier",
      "icp_scorer",
      "triggers",
      "why_now",
    ],
    optional: true,
  };

  // Apify deep-review + web-crawl steps shared by BALANCED and
  // AGGRESSIVE. Both are optional so a missing Apify token, quota
  // exhaustion, or a FREE workspace plan (filterByPlan drops them)
  // never stalls the sync backbone.
  const apifyGmaps: ChainStep = {
    stepId: "apify_gmaps",
    workerKind: "APIFY_GMAPS_DEEP",
    dependsOn: [],
    optional: true,
  };
  // After APIFY_GMAPS_DEEP imports up to 500 reviews, REVIEW_ANALYST
  // re-runs against the deeper corpus so the scorer + dossier see
  // the full evidence set instead of just the Places-API five.
  const reviewRefresh: ChainStep = {
    stepId: "review_refresh",
    workerKind: "REVIEW_ANALYST",
    dependsOn: ["apify_gmaps"],
    optional: true,
  };
  // Web crawl populates PROSPECT_KB_CHUNK SemanticMemory rows that
  // LEAD_DOSSIER_GENERATOR and OPENER_WRITER consume on their next
  // run. Runs in parallel with the sync backbone so it never blocks
  // the initial score; the richer KB is available from the next
  // dossier refresh onward.
  const apifyWebCrawl: ChainStep = {
    stepId: "apify_webcrawl",
    workerKind: "APIFY_WEB_CRAWL_DEEP",
    dependsOn: [],
    optional: true,
  };
  // Score step that waits for the deep review refresh. filterByPlan
  // rewires dependsOn transitively when review_refresh is dropped
  // (FREE plan), so the scorer falls back cleanly to the audit +
  // classifier signals without a DAG break.
  const deepScore: ChainStep = {
    stepId: "score",
    workerKind: "SALES_OPPORTUNITY_SCORER",
    dependsOn: ["audit", "review_refresh", "classifier"],
  };

  // BALANCED is the default for new workspaces. Adds social link
  // discovery + Apify deep reviews + website KB crawl + on-create
  // dossier so the lead detail page is rich the moment the user
  // opens it. Apify steps are optional and plan-gated so FREE
  // workspaces automatically get the audit-only subset.
  //
  // FineDine deployment redesign — `placesReviews`, the early
  // `review` step, and `mockup` are NO LONGER in this chain. Reviews
  // come from the Apify deep pull only (Places API caps at 5).
  // Mockups are explicit-trigger only via /api/agent-runs/pitch-pack.
  //
  // Phase 0/B3 — `intelligence_brief` is the FINAL step. Its
  // dependsOn includes dossier (which itself waits for social +
  // apify_webcrawl + score). The whole DAG converges here so the
  // brief is the single rep-facing canonical artifact.
  const balanced: Chain = [
    audit,
    social,
    apifyGmaps,
    reviewRefresh,
    apifyWebCrawl,
    classifier,
    deepScore,
    embedProfile,
    dossier,
    icpScorer,
    triggers,
    whyNow,
    intelligenceBrief,
  ];

  if (preset === "BALANCED") {
    return filterByPlan(balanced, plan);
  }

  // AGGRESSIVE adds Apify SERP + auto pitch-pack on every ingested
  // lead on top of the BALANCED set. Burns through Gemini and Apify
  // budget very fast; gated to PRO+ at the UI layer. FREE workspaces
  // still get the BALANCED set if their preset is AGGRESSIVE
  // (filterByPlan drops the Apify steps automatically).
  const apifySerp: ChainStep = {
    stepId: "apify_serp",
    workerKind: "APIFY_SERP_RANK",
    dependsOn: ["audit"],
    optional: true,
  };
  // FineDine deployment redesign — opener no longer waits on `mockup`
  // because mockup is no longer in any auto chain. It still consumes
  // `dossier` so the cold-email body can reuse the dossier's
  // `bestSalesAngle` narrative + opening hook (Phase 0/B3). Reps who
  // want the mockup link in the opener trigger the explicit
  // `user_one_click_pitch` chain instead, which runs mockup → opener
  // sequentially and substitutes the URL.
  //
  // SDR Brain v2 — opener also depends on `intelligence_brief` so the
  // cold-email body can ground itself in the SDR_BRAIN's WHY_NOW
  // headline + matched CommercialInsight reframe + the top predicted
  // objection's preemptive response. The brief is `optional` so a
  // Gemini hiccup there doesn't block the opener entirely (opener
  // falls back to dossier-only context the same way it did pre-brain).
  const opener: ChainStep = {
    stepId: "opener",
    workerKind: "OPENER_WRITER",
    dependsOn: ["score", "dossier", "intelligence_brief"],
    optional: true,
  };

  // AGGRESSIVE adds Apify SERP + on-create opener on top of BALANCED.
  // Mockup and the early Places-reviews / review step are dropped for
  // the same reasons described in the BALANCED comment.
  const aggressive: Chain = [
    audit,
    social,
    apifyGmaps,
    apifySerp,
    reviewRefresh,
    apifyWebCrawl,
    classifier,
    deepScore,
    embedProfile,
    dossier,
    icpScorer,
    triggers,
    whyNow,
    intelligenceBrief,
    opener,
  ];

  if (preset === "AGGRESSIVE") {
    return filterByPlan(aggressive, plan);
  }

  // CUSTOM has no derived default — caller is expected to supply the
  // saved steps from the workspace row. Returning BALANCED here is a
  // safety net for a freshly inserted CUSTOM row that hasn't been
  // edited yet.
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
