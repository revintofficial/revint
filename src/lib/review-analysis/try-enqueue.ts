/**
 * Race BullMQ enqueue for review-analysis against a short deadline. Mirrors
 * `tryEnqueue` in `api/leads/[id]/workers/[kind]/route.ts` so a stuck Redis
 * connection does not hang the request forever.
 *
 * Dev-ergonomics safety net: before enqueueing we ask the queue how many
 * workers are currently connected. If zero (the common case when a dev
 * runs `npm run dev` without `npm run workers`), we skip the enqueue
 * and let the API route fall back to the inline `runReviewAnalysisJob`
 * path. Without this, jobs silently rot in the queue and the user sees
 * a stale `ReviewAnalysis` row forever — exactly what surfaced when
 * we bumped the analyzer cap from 50 → 500 and the old result kept
 * showing because the new job never ran.
 */

import { getReviewAnalysisQueue } from "@/lib/queues";
import { logger } from "@/lib/logger";

let redisDownUntil = 0;
const REDIS_DOWN_TTL_MS = 30_000;

/**
 * Cached "no worker connected" check. BullMQ's `getWorkers()` hits
 * Redis every call, so we memoise the result for a short window to
 * keep the per-request overhead near-zero in production (where workers
 * are always up). The cache is short enough that booting `npm run
 * workers` mid-dev session recovers within a few seconds.
 */
let workerProbeAt = 0;
let cachedHasWorker = true;
const WORKER_PROBE_TTL_MS = 5_000;

async function hasActiveWorker(timeoutMs: number): Promise<boolean> {
  if (Date.now() - workerProbeAt < WORKER_PROBE_TTL_MS) {
    return cachedHasWorker;
  }
  try {
    const queue = getReviewAnalysisQueue() as unknown as {
      getWorkers: () => Promise<unknown[]>;
    };
    const probe = queue.getWorkers();
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("worker_probe_timeout")), timeoutMs),
    );
    const workers = (await Promise.race([probe, timeout])) as unknown[];
    cachedHasWorker = Array.isArray(workers) && workers.length > 0;
    workerProbeAt = Date.now();
    return cachedHasWorker;
  } catch {
    // Probe failed — assume worker exists so we don't pile inline work
    // onto the API process when Redis is just slow. The caller's own
    // enqueue race will catch the actually-down-Redis case.
    cachedHasWorker = true;
    workerProbeAt = Date.now();
    return true;
  }
}

export async function tryEnqueueReviewAnalysis(
  leadId: string,
  timeoutMs = 1500,
): Promise<boolean> {
  if (Date.now() < redisDownUntil) {
    return false;
  }
  // Skip the enqueue when no worker is consuming the queue. Returning
  // false here triggers the API route's inline fallback path, which is
  // exactly the right behaviour in dev (and a safe degradation in
  // prod if the worker fleet ever fully drops).
  const workerUp = await hasActiveWorker(800);
  if (!workerUp) {
    logger.warn("review_analysis.try_enqueue.no_worker_connected_inline", {
      leadId,
    });
    return false;
  }
  try {
    const queue = getReviewAnalysisQueue();
    const addPromise = queue.add(
      "analyze",
      { leadId },
      {
        removeOnComplete: 100,
        removeOnFail: 50,
        // M5 - standard retry policy (3 attempts with exponential
        // backoff). Without this, a transient Gemini blip on the very
        // first attempt would just FAIL the job and force a manual
        // re-trigger. The worker's own error classification still
        // decides whether the rethrow is RetryableError or not, so a
        // permanent error still terminates after attempt 1.
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
      },
    );
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("queue_enqueue_timeout")), timeoutMs),
    );
    await Promise.race([addPromise, timeout]);
    redisDownUntil = 0;
    return true;
  } catch {
    redisDownUntil = Date.now() + REDIS_DOWN_TTL_MS;
    return false;
  }
}
