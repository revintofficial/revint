/**
 * Race BullMQ enqueue for review-analysis against a short deadline. Mirrors
 * `tryEnqueue` in `api/leads/[id]/workers/[kind]/route.ts` so a stuck Redis
 * connection does not hang the request forever.
 */

import { getReviewAnalysisQueue } from "@/lib/queues";

let redisDownUntil = 0;
const REDIS_DOWN_TTL_MS = 30_000;

export async function tryEnqueueReviewAnalysis(
  leadId: string,
  timeoutMs = 1500,
): Promise<boolean> {
  if (Date.now() < redisDownUntil) {
    return false;
  }
  try {
    const queue = getReviewAnalysisQueue();
    const addPromise = queue.add(
      "analyze",
      { leadId },
      { removeOnComplete: 100, removeOnFail: 50 },
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
