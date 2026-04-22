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
import type { AgentWorkerKind, Plan, Lead, Workspace, WebsiteAudit, ReviewAnalysis, SalesOpportunity, MemoryKind } from "@/generated/prisma/client";

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
  | "inbox_reply_received"
  | "user_one_click_pitch"
  | "user_deep_research"
  | "user_receptionist_with_kb";

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
  // Hydrated lead + related records (all workers receive the same shape
  // so the runtime can cache the DB read across dependent workers).
  lead: (Lead & {
    websiteAudit: WebsiteAudit | null;
    salesOpportunity: SalesOpportunity | null;
    reviewAnalysis: ReviewAnalysis | null;
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

export interface AgentWorker {
  kind: AgentWorkerKind;
  group: AgentWorkerGroup;
  displayName: string;
  displayNameTr: string;
  description: string;
  descriptionTr: string;
  minPlan: Plan;
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
