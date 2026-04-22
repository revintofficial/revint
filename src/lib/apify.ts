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
 * from Apify's `usageTotalUsd` field. Each worker writes this into
 * `AgentRun.costUsdCents`; the quota helper sums across all Apify
 * runs in the billing cycle to enforce the monthly USD cap.
 */
import { logger } from "./logger";

const APIFY_API_BASE = "https://api.apify.com/v2";

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

export function isConfigured(): boolean {
  return !!process.env.APIFY_TOKEN;
}

function getToken(): string {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new ApifyNotConfiguredError();
  return token;
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
  const started = Date.now();

  // Apify's path-with-dataset endpoint resolves the actor, runs it,
  // and returns the dataset contents in one request.
  const url = new URL(
    `${APIFY_API_BASE}/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items`,
  );
  url.searchParams.set("token", token);
  if (opts?.timeoutSec) url.searchParams.set("timeout", String(opts.timeoutSec));
  if (opts?.memoryMbytes) url.searchParams.set("memory", String(opts.memoryMbytes));

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  const durationMs = Date.now() - started;

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApifyRunError(
      `Apify ${actorId} returned ${res.status}: ${body.slice(0, 400)}`,
      `HTTP_${res.status}`,
    );
  }

  const items = (await res.json()) as T[];

  // `run-sync-get-dataset-items` doesn't return cost in the body.
  // Fetch the latest run for this actor to read stats. We accept
  // this as best-effort - failure to read cost is not fatal.
  const runId = res.headers.get("x-apify-pagination-run-id") ?? "";
  let costUsdCents = 0;
  if (runId) {
    try {
      const stats = await fetchRun(runId);
      costUsdCents = stats.costUsdCents;
    } catch {
      /* swallow; cost unknown */
    }
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
  if (opts.memoryMbytes) url.searchParams.set("memory", String(opts.memoryMbytes));

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...(input as object), webhooks: [webhook] }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApifyRunError(
      `Apify ${actorId} start failed ${res.status}: ${body.slice(0, 400)}`,
      `HTTP_${res.status}`,
    );
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
 * enough (Apify does not use HMAC). Returns true when the header
 * matches `APIFY_WEBHOOK_SECRET` or when no secret is configured
 * (dev mode).
 */
export function verifyWebhookSecret(headers: Headers): boolean {
  const expected = process.env.APIFY_WEBHOOK_SECRET;
  if (!expected) return true;
  const got = headers.get("x-apify-webhook-secret");
  return got === expected;
}
