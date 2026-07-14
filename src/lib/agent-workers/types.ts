/**
 * AI Workers - shared types.
 *
 * Every worker under `src/lib/agent-workers/` conforms to the
 * {@link AgentWorker} contract below. The registry in `./registry.ts`
 * holds pure metadata (displayName, minPlan, description) plus a lazy
 * loader for the implementation module, so workers that are Phase 2 /
 * Phase 3 only can be declared without dragging their code into the
 * main bundle yet.
 *
 * Execution contract:
 *   1. API handler inserts an `AgentRun` row (status = PENDING) and
 *      enqueues a BullMQ `agent-runs` job with `{ runId }`.
 *   2. The `agent-run-worker` in `src/workers/` picks up the job,
 *      resolves the worker from the registry, calls `worker.run()`.
 *   3. Worker returns an {@link AgentWorkerOutput} or throws; the
 *      worker process writes back to `AgentRun` (SUCCEEDED / FAILED)
 *      and sets `artifactUrl` if the output is publicly shareable.
 */
import type {
  AgentWorkerKind,
  Plan,
  Lead,
  Workspace,
  WebsiteAudit,
  ReviewAnalysis,
  SalesOpportunity,
  MemoryKind,
  GoogleReview,
  Account,
} from "@/generated/prisma/client";

export type AgentWorkerGroup = "intelligence" | "pitch" | "deliverable" | "ops" | "enrichment";

export type AgentExportFormat =
  | "synthflow"
  | "retell"
  | "vapi"
  | "ghl"
  | "n8n"
  | "make"
  | "html"
  | "zip"
  | "json"
  // Knowledge-base export: a flat list of { chunk_id, text, embedding,
  // metadata } entries suitable for uploading to a 3rd-party RAG store
  // (Synthflow KB, Retell KB, Vapi custom docs, etc.). Produced when
  // a worker has accumulated PROSPECT_KB_CHUNK memory for its lead.
  | "kb_json";

/**
 * Event names the planner can react to. Keep in sync with
 * `src/lib/ai-core/chains.ts` CHAINS keys; the type exists at this
 * layer so workers can declare sub-event emissions without pulling
 * the chains module into their bundle graph.
 */
export type EventKind =
  | "lead_created"
  | "lead_reviews_updated"
  | "inbox_reply_received"
  | "user_one_click_pitch"
  | "user_deep_research"
  | "user_receptionist_with_kb"
  // SDR Brain v2 — events that gate closed-loop attribution and
  // discovery extraction. Naming convention: `<noun>_<verb>` so the
  // planner registry stays grep-friendly.
  //
  // voice_note_added:        rep dropped a voice memo on a lead.
  //   Triggers SPIN_EXTRACTOR + MEDDPICC_EXTRACTOR (when the lead is
  //   already in the watchlist) so the discovery + qualification
  //   surface refreshes before the rep opens the lead detail page.
  // disposition_logged:      rep marked the outcome of a call (replied,
  //   not interested, scheduled callback, etc.). Triggers
  //   OUTCOME_ATTRIBUTOR so the active LeadNextAction + applied
  //   CommercialInsight close the loop.
  // watchlist_stage_changed: a deal advanced (or regressed) on the
  //   pipeline kanban. Triggers OUTCOME_ATTRIBUTOR for WON/LOST
  //   terminal moves; lighter-weight refresh otherwise.
  // outcome_attributed:      emitted by OUTCOME_ATTRIBUTOR after it
  //   writes outcomes back. Listeners can fan out to UI cache busts
  //   or post-mortem analytics jobs without polling the worker output.
  // sdr_brain_completed:     emitted by SDR_BRAIN once the final NBA
  //   + reasoning graph + arbitration are persisted. UI uses this
  //   to swap the preliminary card for the final one.
  | "voice_note_added"
  | "disposition_logged"
  | "watchlist_stage_changed"
  | "outcome_attributed"
  | "sdr_brain_completed";

export interface MemorySpec {
  kinds: MemoryKind[];
  /**
   * How many memory hits to pre-fetch for this spec. Default 10.
   */
  topK?: number;
  /**
   * `"workspace"`: search across the entire workspace.
   * `"lead"`: restrict to memories attached to `ctx.leadId`.
   */
  scope: "workspace" | "lead";
  /**
   * Minimum cosine similarity. Default 0 (return topK regardless).
   */
  minSimilarity?: number;
}

export interface MemoryHit {
  id: string;
  kind: MemoryKind;
  leadId: string | null;
  refType: string | null;
  refId: string | null;
  text: string;
  metadata: Record<string, unknown>;
  /**
   * Cosine similarity from pgvector in [0, 1]. `null` means the hit
   * was fetched without a vector query (e.g. the executor's static
   * memoryReads pre-fetch which scores by recency, not semantics) and
   * the caller MUST NOT treat it as a real similarity score. Do not
   * sort or threshold on this when null; do a follow-up `memoryQuery`
   * with a real query text if you need ranking.
   */
  similarity: number | null;
  createdAt: Date;
  /**
   * Niche pack scope this row was written under (child slug like
   * "fnb-bar-club", parent slug like "fnb", or null for niche-agnostic
   * memory). Workers branching on sub-niche can use this to filter
   * the pre-fetched hits without a second DB round-trip.
   */
  nicheScope: string | null;
}

/**
 * A pending memory write returned from a worker's `memoryWrites`
 * callback. The executor upserts these rows + embeds them after the
 * worker finishes successfully.
 */
export interface MemoryWrite {
  kind: MemoryKind;
  text: string;
  leadId?: string | null;
  refType?: string | null;
  refId?: string | null;
  metadata?: Record<string, unknown>;
  /**
   * When true, the executor skips embedding (row is stored as
   * searchable-by-refId only, not by semantic similarity). Useful for
   * structured data that makes no sense to embed.
   */
  skipEmbed?: boolean;
  /**
   * Asymmetric niche-scope dual-write. When supplied, the executor
   * routes the write through `upsertWithNicheScopes` instead of a
   * single-scope upsert. Positive kinds (OPENER_SUCCESS,
   * MOCKUP_SECTION, LEAD_PROFILE) get fanned out to BOTH child and
   * parent scopes; negative kinds (OPENER_FAILURE) are written to
   * the child only so a vertical's failure pattern doesn't poison
   * sibling sub-niche retrieval.
   *
   * Pass only the parent (`{ parentSlug: "fnb" }`) when the lead is
   * unclassified — the row will live at the parent scope and be
   * available to every sub-niche via the weighted union read.
   *
   * When omitted entirely, the row is written with `nicheScope = null`
   * (legacy / niche-agnostic data like WORKSPACE_OFFER, COPILOT_TURN).
   */
  niche?: {
    childSlug?: string | null;
    parentSlug?: string | null;
  };
}

/**
 * Context passed to every worker at invocation time. The worker resolver
 * in `agent-run-worker.ts` hydrates these from Prisma before calling
 * `run()` so each worker stays pure (no DB access from inside the
 * worker handler itself). Keep this list minimal and additive.
 */
export interface AgentWorkerContext {
  runId: string;
  workspaceId: string;
  workspacePlan: Plan;
  leadId: string | null;
  userId: string | null;
  // Hydrated lead + related records. The base shape (websiteAudit,
  // salesOpportunity, reviewAnalysis) is loaded for every worker so
  // the executor can cache the DB read across dependent workers in
  // the same chain.
  //
  // SDR-Brain v2 Phase 2 — `googleReviews` (recent-first, capped at
  // 50) and `account` are opt-in via `AgentWorker.requiredIncludes`.
  // Always typed as `GoogleReview[] | undefined` / `Account | null |
  // undefined`: `undefined` means "the worker didn't opt in, don't
  // assume anything"; `null` (for `account`) means "opted in but the
  // lead has no account row"; `[]` means "opted in but the lead has
  // no reviews yet". Workers that need these MUST declare
  // `requiredIncludes` in the registry — relying on `undefined` from
  // a non-opt-in worker is a bug.
  lead: (Lead & {
    websiteAudit: WebsiteAudit | null;
    salesOpportunity: SalesOpportunity | null;
    reviewAnalysis: ReviewAnalysis | null;
    googleReviews?: GoogleReview[];
    account?: Account | null;
  }) | null;
  workspace: Pick<
    Workspace,
    | "id"
    | "name"
    | "slug"
    | "plan"
    | "language"
    | "tone"
    | "offerName"
    | "valueProposition"
    | "offerHook"
    | "objective"
    | "senderName"
    | "conversionLink"
    | "socialProof"
    | "branding"
    // Hybrid-niche dispatch: workers like vertical-classifier and
    // opener-writer branch on `niche` (WorkspaceNiche) to pick the
    // parent NichePack and decide whether to ask the classifier to
    // rank against children at all (single-pack niches skip).
    | "niche"
  >;
  /**
   * Pre-fetched SemanticMemory hits based on this worker's `memoryReads`
   * declaration. When a worker declares multiple `MemorySpec`s the
   * hits are concatenated in the order specified. Workers should rely
   * on the metadata + kind fields to disambiguate rather than positional
   * indexing.
   */
  memory: MemoryHit[];
  /**
   * Beta finding §7: true when the executor's memory pre-fetch hit an
   * EmbeddingError on at least one MemorySpec and degraded to an
   * empty / partial result. The worker proceeds with whatever memory
   * we managed to fetch (may be empty), and the executor uses this
   * flag to flip the AgentRun status to SUCCEEDED_NO_MEMORY when the
   * worker completes its primary work. Workers themselves rarely
   * branch on this — it's a signal for the executor / observability.
   */
  memoryDegraded?: boolean;
  /**
   * PlannerSession id when this run was scheduled as part of a DAG.
   * Null for legacy one-shot runs. Workers rarely need this; it is
   * primarily a hook for observability.
   */
  plannerSessionId: string | null;
  /**
   * Emits a sub-event during the run. The planner picks this up and
   * can schedule a follow-up chain (e.g. inside OPENER_WRITER we emit
   * `"user_one_click_pitch"` to trigger mockup + video script siblings).
   * Fire-and-forget semantics; the promise resolves when the event is
   * accepted, not when downstream work completes.
   */
  emit: (event: EventKind, payload?: Record<string, unknown>) => Promise<void>;
  /**
   * Values persisted on `AgentRun.inputsJson` when the run is triggered
   * (e.g. POST body for ad-hoc worker options). Workers read only keys
   * they understand.
   */
  runInputs?: Record<string, unknown>;
}

/**
 * Output shape returned by a worker. The worker runtime persists this
 * as-is to `AgentRun.outputJson` so the API /artifact download endpoints
 * can serve it back to the UI without a second Gemini call. When the
 * output also produces a public link (Website Mockup, etc.) the worker
 * sets `artifactUrl` to the /m/{slug} path.
 */
export interface AgentWorkerOutput {
  /**
   * The structured JSON payload the worker produced. For generator
   * workers this is the full artifact; for builder workers this is
   * typically `{ config, setupMarkdown, downloadableFiles }`.
   */
  output: unknown;
  /**
   * Optional public URL (path, not absolute) that resolves to the
   * rendered artifact. E.g. `/m/abc1234567` for a Website Mockup.
   * Left null for workers whose output is only downloadable (configs).
   */
  artifactUrl?: string | null;
  /**
   * Approximate token cost for tier metering (Gemini LLM calls).
   */
  costTokens?: number;
  /**
   * USD-denominated external cost in cents. Primarily Apify actor
   * runs; always 0 for pure Gemini workers. Separate from costTokens
   * so the UI can split "AI spend" from "data spend".
   */
  costUsdCents?: number;
}

/**
 * Execution mode for a worker.
 *
 *  - `"sync"` (default): the worker exports a single `run(ctx)` that
 *    is awaited inline by the executor. Suitable for Gemini calls,
 *    in-process scrapers, and short Apify actors that finish under
 *    the serverless function deadline.
 *  - `"async-apify"`: the worker exports `start(ctx)` + `finalize(ctx,
 *    apifyResult)`. `start` kicks off an Apify actor with a webhook
 *    pointing at `/api/webhooks/apify` and returns immediately. The
 *    webhook handler later resolves the worker module, calls
 *    `finalize`, and persists the AgentWorkerOutput. This is the
 *    only mode that survives Vercel's 60s function deadline for
 *    long-running Apify actors (SERP, deep social, gmaps).
 *
 *    For environments where `getAppBaseUrl()` returns a localhost URL
 *    (no public webhook ingress), the executor falls back to sync
 *    mode using the worker's optional `run(ctx)` adapter, so dev
 *    machines without a tunnel still see results.
 */
export type AgentWorkerMode = "sync" | "async-apify";

/**
 * Dataset items + cost surfaced by an Apify actor run. Same shape
 * as `ApifyRunResult` but trimmed to what `finalize` callbacks need.
 */
export interface ApifyFinalizePayload {
  apifyRunId: string;
  items: unknown[];
  costUsdCents: number;
  status: "SUCCEEDED" | "FAILED" | "TIMED_OUT" | "ABORTED";
}

/**
 * Outcome of a worker's `start(ctx)` kickoff. Either we successfully
 * scheduled an Apify actor (`apifyRunId` set) or we decided not to
 * run at all (`skipped: true` -- e.g. APIFY_TOKEN missing, lead has
 * no queries to run). The executor terminates the AgentRun with
 * SUCCEEDED + the skip reason instead of waiting for a webhook
 * callback that will never arrive.
 */
export type AgentWorkerStartResult =
  | {
      apifyRunId: string;
      /**
       * Optional cost estimate in USD cents recorded immediately on
       * the AgentRun. The webhook handler overwrites this with the
       * actual usage when Apify reports back, but recording an
       * estimate up-front means quota math works even if the webhook
       * is delayed or never arrives.
       */
      costEstimateUsdCents?: number;
    }
  | {
      skipped: true;
      reason: string;
      output?: unknown;
    };

export type AgentWorkerStart = (
  ctx: AgentWorkerContext,
) => Promise<AgentWorkerStartResult>;

export type AgentWorkerFinalize = (
  ctx: AgentWorkerContext,
  payload: ApifyFinalizePayload,
) => Promise<AgentWorkerOutput>;

export interface AgentWorker {
  kind: AgentWorkerKind;
  group: AgentWorkerGroup;
  displayName: string;
  displayNameTr: string;
  description: string;
  descriptionTr: string;
  minPlan: Plan;
  /**
   * Execution mode. Defaults to `"sync"` when omitted. Async-apify
   * workers MUST export `start` + `finalize`; sync workers MUST
   * export `run`. Workers can export both: that lets the executor
   * fall back to sync when no public webhook URL is available
   * (typical local dev without a tunnel).
   */
  mode?: AgentWorkerMode;
  /**
   * When true, invocations write to `AgentRun` and go through the
   * agent-runs queue. Phase 1 only has 4 workers true here (the new
   * Pitch + Deliverable workers). Legacy workers (crawl, analyze,
   * review-analysis, etc.) have their own queues + status columns
   * and will be consolidated in Phase 2.
   */
  phase1Enabled: boolean;
  /**
   * Typical wall-clock runtime shown in the UI as a countdown label.
   */
  estimatedDurationMs: number;
  /**
   * Hide this worker from the lead-detail "AI Workers" panel. Used for
   * workers that:
   *   - belong to a deprecated/replaced flow (e.g. `GOOGLE_PLACES_REVIEWS`
   *     replaced by `APIFY_GMAPS_DEEP`),
   *   - are client-side deliverables sold as install packs and not part
   *     of the SDR cycle (`AI_RECEPTIONIST_BUILDER`, `REVIEW_REPLY_AGENT`,
   *     `BOOKING_WIDGET_BUILDER`, etc.),
   *   - are pure server-side / event-driven internal jobs that should
   *     never be manually tetiklenecek (`OUTREACH_SENDER`,
   *     `CONTAINMENT_RATE_TRACKER`),
   *   - are Phase 2 placeholders without an implModule
   *     (`STAKEHOLDER_DISCOVERER`),
   *   - sit in the registry but no chain wires them in (`APIFY_TIKTOK_DEEP`,
   *     `APIFY_LINKEDIN_COMPANY`).
   *
   * The worker stays in the registry — historical `AgentRun` rows still
   * resolve, the planner / chain validator still type-checks, and any
   * niche-specific tooling can re-enable it by flipping the flag. The
   * lead-detail workers API filters these out before sending to the UI.
   */
  hiddenFromPanel?: boolean;
  /**
   * Export formats this worker's output can be serialized to. Only
   * relevant for deliverable workers (receptionist, review reply,
   * lead response, booking widget).
   */
  exportFormats?: AgentExportFormat[];
  /**
   * AI Core - declarative memory inputs. The orchestrator pre-fetches
   * these before calling `run()` and populates `ctx.memory`. Keep the
   * declaration here (not inside the run handler) so the planner can
   * reason about memory dependencies before scheduling.
   */
  memoryReads?: MemorySpec[];
  /**
   * SDR-Brain v2 (Phase 2) — declarative Lead-relation includes. When
   * a worker needs more than the default `websiteAudit + salesOpportunity
   * + reviewAnalysis` shape, set the corresponding flag here. The
   * executor (`hydrateContext` in `execute.ts`) reads this and adds the
   * include to the Prisma query. Defaults: every flag is `false` so
   * the legacy hot path stays untouched and workers that don't opt in
   * pay no extra DB cost.
   *
   * Currently supported:
   *   - `googleReviews`: pulls up to 50 most-recent `GoogleReview` rows
   *     for the lead. Used by `TRIGGER_DETECTOR` for rating-trend rules.
   *   - `account`: includes the lead's `Account` row (multi-location
   *     intelligence). Used by `TRIGGER_DETECTOR`.
   *
   * Add new flags only when an actual worker needs them — every extra
   * include burns a join on the hot path.
   */
  requiredIncludes?: {
    googleReviews?: boolean;
    account?: boolean;
  };
  /**
   * AI Core - memory writes produced from the run output. Called by
   * the executor AFTER the worker succeeds; each returned entry is
   * upserted into SemanticMemory and embedded. Workers that don't
   * produce semantic memory leave this unset.
   */
  memoryWrites?: (
    output: unknown,
    ctx: AgentWorkerContext,
  ) => MemoryWrite[] | Promise<MemoryWrite[]>;
  /**
   * AI Core - DAG ordering hint for `chains.ts`. If set, the planner
   * will not schedule this worker until every dependency has a
   * SUCCEEDED AgentRun for the same lead. Does NOT replace chain
   * definitions; it is a safety net for ad-hoc runs.
   */
  dependsOn?: AgentWorkerKind[];
  /**
   * Lazy loader for the worker implementation module. Returns the
   * default export which must be a function of signature:
   *
   *   (ctx: AgentWorkerContext) => Promise<AgentWorkerOutput>
   *
   * Workers not yet implemented leave this unset; the runtime returns
   * a 501-style "not implemented" error in that case.
   */
  run?: (ctx: AgentWorkerContext) => Promise<AgentWorkerOutput>;
}

export type AgentWorkerRun = (ctx: AgentWorkerContext) => Promise<AgentWorkerOutput>;
