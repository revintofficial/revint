/**
 * Apify platform client.
 *
 * Thin wrapper over the Apify REST API. We do not use the official
 * `apify-client` package because:
 *   - Zero dependency adds to the bundle graph
 *   - The subset we use (actor run + dataset fetch + webhook signature
 *     verify) is ~30 lines of fetch calls
 *   - Zero-config when `APIFY_TOKEN` is missing: `isConfigured()`
 *     returns false and every Apify worker skips gracefully (same
 *     pattern as ZeroBounce in `src/lib/email-verification.ts`)
 *
 * Two run modes:
 *   - `runSync(actorId, input, opts)`: posts `run-sync-get-dataset-items`
 *     and blocks until the actor finishes. Works for fast actors
 *     (SERP, Instagram profile) where Apify finishes in < 60s.
 *   - `runAsync(actorId, input, opts)`: kicks off the actor with a
 *     webhook URL, returns immediately with `{ runId, runStatusUrl }`.
 *     Used for long actors (Google Maps deep, web crawl).
 *
 * Cost tracking: every successful run returns `costUsdCents` derived
 * from Apify's `usageTotalUsd` field when `x-apify-pagination-run-id`
 * is present. If that header is missing (rare API edge), we log and
 * fall back to `estimateSyncRunCostUsdCents` so the job still succeeds;
 * quota may under-count that run.
 */
import { logger } from "./logger";

const APIFY_API_BASE = "https://api.apify.com/v2";

/**
 * Default per-actor memory cap.
 *
 * Apify actors default to whatever the actor manifest declares - many
 * actors (notably `apify/website-content-crawler`) declare 8192 MB,
 * which on Apify's free / starter tiers immediately busts the 8 GB
 * total memory cap once even a single sibling actor is running. Result:
 * Apify returns 402 `actor-memory-limit-exceeded` and the AgentRun
 * fails despite the actor itself being light enough to run on far
 * less memory.
 *
 * 2048 MB is the conservative middle ground:
 *   - Light cheerio / search / dataset actors finish in well under 1 GB
 *     so 2 GB is plenty (and individual workers can override down to
 *     1024 - see `web-crawl-deep`).
 *   - Browser-based actors (Instagram, Facebook posts, TikTok, gmaps)
 *     run comfortably at 2 GB; the 4-8 GB defaults are headroom for
 *     enterprise scale crawls we don't issue.
 *   - With a 2 GB cap, the 8 GB free-tier ceiling allows up to 4
 *     concurrent Apify workers per workspace, which matches the chain
 *     fan-out (gmaps + serp + ig + web-crawl in parallel).
 *
 * Workers that genuinely need more memory pass `memoryMbytes` explicitly
 * and skip this default.
 */
const DEFAULT_MEMORY_MBYTES = 2048;

export interface ApifyRunResult<T = unknown> {
  runId: string;
  /**
   * Dataset items produced by the actor. Empty array for actors that
   * write to key-value store instead.
   */
  items: T[];
  /**
   * Cost in USD cents. Derived from Apify run stats; may be 0 for
   * free-tier actors or when stats are unavailable.
   */
  costUsdCents: number;
  durationMs: number;
  status: "SUCCEEDED" | "FAILED" | "TIMED_OUT" | "ABORTED";
}

export class ApifyNotConfiguredError extends Error {
  constructor() {
    super("APIFY_TOKEN not set - Apify workers unavailable");
    this.name = "ApifyNotConfiguredError";
  }
}

export class ApifyRunError extends Error {
  runId?: string;
  status: string;
  constructor(message: string, status: string, runId?: string) {
    super(message);
    this.status = status;
    this.runId = runId;
  }
}

/**
 * Task 2 — Apify answered with a plan / quota limit rather than a real
 * failure. `runSync` / `runAsync` throw this for HTTP 402 and for 403
 * with one of `APIFY_QUOTA_403_TYPES`; the executor turns it into a
 * SUCCEEDED run with `{ skipped: "apify_quota", statusCode }` (see
 * `apifyQuotaSkipFor`). Fifteen runs were marked FAILED this way.
 */
export class ApifyQuotaError extends ApifyRunError {
  statusCode: number;
  constructor(message: string, statusCode: number, runId?: string) {
    super(message, `HTTP_${statusCode}`, runId);
    this.name = "ApifyQuotaError";
    this.statusCode = statusCode;
  }
}

export const APIFY_QUOTA_403_TYPES = [
  "platform-feature-disabled",
  "actor-memory-limit-exceeded",
  "concurrent-runs-limit-exceeded",
] as const;

export type ApifyQuotaSkip = {
  skipped: "apify_quota";
  reason: "apify_quota";
  statusCode: number;
};

function isQuotaResponse(status: number, body: string): boolean {
  if (status === 402) return true;
  if (status !== 403) return false;
  // Apify error body: { "error": { "type": "...", "message": "..." } }.
  // Fall back to a substring check when the body is not JSON.
  try {
    const parsed = JSON.parse(body) as { error?: { type?: unknown } };
    const type = parsed?.error?.type;
    if (typeof type === "string") {
      return (APIFY_QUOTA_403_TYPES as readonly string[]).includes(type);
    }
  } catch {
    // not JSON
  }
  return APIFY_QUOTA_403_TYPES.some((t) => body.includes(t));
}

function apifyHttpError(actorId: string, verb: string, status: number, body: string): ApifyRunError {
  const message = `Apify ${actorId} ${verb} ${status}: ${body.slice(0, 400)}`;
  if (isQuotaResponse(status, body)) return new ApifyQuotaError(message, status);
  return new ApifyRunError(message, `HTTP_${status}`);
}

/** `{ skipped: "apify_quota", statusCode }` for a quota error, else `null`. */
export function apifyQuotaSkipFor(err: unknown): ApifyQuotaSkip | null {
  if (err instanceof ApifyQuotaError) {
    return { skipped: "apify_quota", reason: "apify_quota", statusCode: err.statusCode };
  }
  return null;
}

/**
 * Task 2 — in-process Apify concurrency lock.
 *
 * At most `APIFY_MAX_CONCURRENT` actor calls run at once per Node
 * process; the rest wait in FIFO order. Apify's own limit is per
 * account, so a lead burst used to trip `concurrent-runs-limit-exceeded`
 * / `actor-memory-limit-exceeded`. This is deliberately in-process (no
 * Redis): one worker supervisor runs the pipeline in the beta.
 */
export const APIFY_MAX_CONCURRENT = 2;
let apifyActive = 0;
const apifyWaiters: Array<() => void> = [];

export async function withApifySlot<T>(fn: () => Promise<T>): Promise<T> {
  if (apifyActive >= APIFY_MAX_CONCURRENT) {
    await new Promise<void>((resolve) => apifyWaiters.push(resolve));
  } else {
    apifyActive += 1;
  }
  try {
    return await fn();
  } finally {
    const next = apifyWaiters.shift();
    // Hand the slot straight to the next waiter (active count unchanged),
    // or release it.
    if (next) next();
    else apifyActive -= 1;
  }
}

export function isConfigured(): boolean {
  return !!process.env.APIFY_TOKEN;
}

function getToken(): string {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new ApifyNotConfiguredError();
  return token;
}

/**
 * `run-sync-get-dataset-items` does not include USD usage in the JSON body.
 * Without `x-apify-pagination-run-id` we cannot call `actor-runs/:id`.
 * Returns 0 so callers succeed; extend with heuristics if needed per actor.
 */
function estimateSyncRunCostUsdCents<T>(items: T[]): number {
  void items;
  return 0;
}

/**
 * Runs an actor and blocks until completion. Returns the dataset
 * items. Safe for actors that finish within ~60 seconds; for longer
 * ones use `runAsync` + webhook.
 */
export async function runSync<T = unknown>(
  actorId: string,
  input: unknown,
  opts?: { timeoutSec?: number; memoryMbytes?: number },
): Promise<ApifyRunResult<T>> {
  const token = getToken();
  return withApifySlot(() => runSyncUnlocked<T>(token, actorId, input, opts));
}

async function runSyncUnlocked<T>(
  token: string,
  actorId: string,
  input: unknown,
  opts?: { timeoutSec?: number; memoryMbytes?: number },
): Promise<ApifyRunResult<T>> {
  const started = Date.now();

  // Apify's path-with-dataset endpoint resolves the actor, runs it,
  // and returns the dataset contents in one request.
  const url = new URL(
    `${APIFY_API_BASE}/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items`,
  );
  url.searchParams.set("token", token);
  if (opts?.timeoutSec) url.searchParams.set("timeout", String(opts.timeoutSec));
  url.searchParams.set("memory", String(opts?.memoryMbytes ?? DEFAULT_MEMORY_MBYTES));

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  const durationMs = Date.now() - started;

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw apifyHttpError(actorId, "returned", res.status, body);
  }

  const items = (await res.json()) as T[];

  // `run-sync-get-dataset-items` doesn't return cost in the body; we
  // fetch run stats via `x-apify-pagination-run-id` when present.
  // One retry with linear backoff handles the race where the dataset
  // is available before the run-status row has caught up.
  const runId = res.headers.get("x-apify-pagination-run-id") ?? "";
  let costUsdCents = 0;
  if (runId) {
    try {
      const stats = await fetchRun(runId);
      costUsdCents = stats.costUsdCents;
    } catch (err) {
      logger.warn("apify.run_sync.stats_fetch_retrying", {
        actorId,
        runId,
        err: err instanceof Error ? err.message : String(err),
      });
      await new Promise((r) => setTimeout(r, 1500));
      const stats = await fetchRun(runId);
      costUsdCents = stats.costUsdCents;
    }
  } else {
    logger.warn("apify.run_sync.missing_pagination_run_id", {
      actorId,
      itemCount: Array.isArray(items) ? items.length : 0,
      message: "No x-apify-pagination-run-id; using estimateSyncRunCostUsdCents (quota may under-count)",
    });
    costUsdCents = estimateSyncRunCostUsdCents(items);
  }

  return {
    runId,
    items: items ?? [],
    costUsdCents,
    durationMs,
    status: "SUCCEEDED",
  };
}

/**
 * Fire-and-forget run. Returns { runId, statusUrl } immediately. The
 * caller (typically an Apify worker) expects the webhook endpoint to
 * pick up completion later.
 */
export async function runAsync(
  actorId: string,
  input: unknown,
  opts: {
    webhookUrl: string;
    webhookSecret?: string;
    agentRunId: string;
    timeoutSec?: number;
    memoryMbytes?: number;
  },
): Promise<{ runId: string; statusUrl: string }> {
  const token = getToken();

  const webhook = {
    eventTypes: ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED", "ACTOR.RUN.TIMED_OUT"],
    requestUrl: opts.webhookUrl,
    payloadTemplate: JSON.stringify({
      userData: { agentRunId: opts.agentRunId },
      resource: "{{resource}}",
      eventData: "{{eventData}}",
    }),
    ...(opts.webhookSecret ? { headersTemplate: { "x-apify-webhook-secret": opts.webhookSecret } } : {}),
  };

  const url = new URL(`${APIFY_API_BASE}/acts/${encodeURIComponent(actorId)}/runs`);
  url.searchParams.set("token", token);
  if (opts.timeoutSec) url.searchParams.set("timeout", String(opts.timeoutSec));
  url.searchParams.set("memory", String(opts.memoryMbytes ?? DEFAULT_MEMORY_MBYTES));

  // Only the start request holds a slot; the actor itself keeps
  // running on Apify after we return.
  const res = await withApifySlot(() =>
    fetch(url.toString(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...(input as object), webhooks: [webhook] }),
    }),
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw apifyHttpError(actorId, "start failed", res.status, body);
  }

  const body = (await res.json()) as { data: { id: string; defaultDatasetId: string } };
  logger.info("apify.run_async.started", {
    actorId,
    runId: body.data.id,
    datasetId: body.data.defaultDatasetId,
  });

  return {
    runId: body.data.id,
    statusUrl: `${APIFY_API_BASE}/actor-runs/${body.data.id}`,
  };
}

/**
 * Fetches a finished run's metadata + dataset. Used by the webhook
 * handler after Apify notifies us the actor completed.
 */
export async function fetchRun(runId: string): Promise<ApifyRunResult<unknown>> {
  const token = getToken();
  const runRes = await fetch(
    `${APIFY_API_BASE}/actor-runs/${encodeURIComponent(runId)}?token=${token}`,
  );
  if (!runRes.ok) {
    throw new ApifyRunError(`Apify run fetch failed ${runRes.status}`, `HTTP_${runRes.status}`, runId);
  }
  const runBody = (await runRes.json()) as {
    data: {
      id: string;
      status: string;
      defaultDatasetId: string;
      usageTotalUsd?: number;
      startedAt?: string;
      finishedAt?: string;
    };
  };
  const run = runBody.data;

  let items: unknown[] = [];
  if (run.defaultDatasetId) {
    const dsRes = await fetch(
      `${APIFY_API_BASE}/datasets/${run.defaultDatasetId}/items?token=${token}&format=json&clean=true`,
    );
    if (dsRes.ok) {
      items = (await dsRes.json()) as unknown[];
    }
  }

  const durationMs =
    run.startedAt && run.finishedAt
      ? new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()
      : 0;

  return {
    runId: run.id,
    items: items ?? [],
    costUsdCents: Math.ceil((run.usageTotalUsd ?? 0) * 100),
    durationMs,
    status: (run.status as ApifyRunResult["status"]) ?? "SUCCEEDED",
  };
}

/**
 * Verifies an Apify webhook signature. Apify posts the raw header
 * value we set via `headersTemplate`; a simple equality check is
 * enough (Apify does not use HMAC).
 *
 * In production we fail closed if no secret is configured: an
 * unsecured webhook endpoint that accepts arbitrary callbacks could be
 * driven by an attacker to mark runs complete or trigger memory
 * writes. In non-production (dev/test) we still allow missing secrets
 * so local Apify replay tooling keeps working.
 */
export function verifyWebhookSecret(headers: Headers): boolean {
  const expected = process.env.APIFY_WEBHOOK_SECRET;
  if (!expected) {
    if (process.env.NODE_ENV === "production") return false;
    return true;
  }
  const got = headers.get("x-apify-webhook-secret");
  return got === expected;
}
