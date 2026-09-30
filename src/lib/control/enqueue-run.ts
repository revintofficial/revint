import { getAgentRunsQueue } from "@/lib/queues";

let redisDownUntil = 0;
const REDIS_DOWN_TTL_MS = 30_000;

/** Enqueue an existing AgentRun; false leaves the run PENDING for the caller to handle. */
export async function tryEnqueue(runId: string, timeoutMs = 1500): Promise<boolean> {
  if (Date.now() < redisDownUntil) return false;
  try {
    const queue = getAgentRunsQueue();
    const addPromise = queue.add(`agent-run-${runId}`, { runId }, {
      attempts: 2,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 500,
      removeOnFail: 500,
    });
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
