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
import type { AgentWorkerKind, Plan, Lead, Workspace, WebsiteAudit, ReviewAnalysis, SalesOpportunity } from "@/generated/prisma/client";

export type AgentWorkerGroup = "intelligence" | "pitch" | "deliverable" | "ops";

export type AgentExportFormat = "synthflow" | "retell" | "vapi" | "ghl" | "n8n" | "make" | "html" | "zip" | "json";

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
   * Approximate token cost for tier metering.
   */
  costTokens?: number;
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
