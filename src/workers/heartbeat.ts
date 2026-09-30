import type IORedis from "ioredis";
import { logger } from "../lib/logger";

/**
 * Worker liveness signal.
 *
 * Every `intervalMs` the worker process logs `worker.heartbeat` (visible in
 * Railway logs) and writes `WORKER_HEARTBEAT_KEY` to Redis with a TTL of
 * three intervals. `/api/health` reads the key, so an operator can tell
 * "web is up but no worker is consuming jobs" from one probe.
 */
export const WORKER_HEARTBEAT_KEY = "revint:worker:heartbeat";
const DEFAULT_INTERVAL_MS = 60_000;

export function startWorkerHeartbeat(
  connection: IORedis,
  intervalMs = DEFAULT_INTERVAL_MS,
): { close: () => void } {
  const startedAt = Date.now();

  const beat = async () => {
    const mem = process.memoryUsage();
    const payload = {
      ts: new Date().toISOString(),
      pid: process.pid,
      uptimeSec: Math.round((Date.now() - startedAt) / 1000),
      rssMb: Math.round(mem.rss / 1024 / 1024),
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
    };
    logger.info("worker.heartbeat", payload);
    try {
      await connection.set(
        WORKER_HEARTBEAT_KEY,
        JSON.stringify(payload),
        "PX",
        intervalMs * 3,
      );
    } catch (err) {
      logger.warn("worker.heartbeat.redis_write_failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  };

  void beat();
  const handle = setInterval(() => void beat(), intervalMs);
  handle.unref?.();
  return { close: () => clearInterval(handle) };
}
