import IORedis from "ioredis";

let redis: IORedis | null = null;
let requestRedis: IORedis | null = null;

/**
 * Redis client for BullMQ workers / queues.
 *
 * BullMQ requires `maxRetriesPerRequest: null` so its blocking commands
 * (BRPOPLPUSH etc.) can sit indefinitely. Never use this client from the
 * HTTP request path - if Redis is down, commands here will HANG FOREVER,
 * not throw, and will wedge /api/* handlers until the gateway times out.
 */
export function getRedis(): IORedis {
  if (!redis) {
    // In the BullMQ worker process (npm run workers) we want the
    // classic "hang until Redis comes back" semantics. In the Next.js
    // HTTP process we don't - ioredis spewing ECONNREFUSED loops
    // every second floods dev logs without adding information.
    // IS_WORKER is set by src/workers/index.ts before any import.
    const isWorkerProcess = process.env.IS_WORKER === "1";

    redis = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: isWorkerProcess ? null : 0,
      enableReadyCheck: false,
      // In HTTP process, don't queue commands when disconnected - the
      // caller's enqueue-timeout + inline fallback handles unavailable
      // Redis cleanly. Queuing would keep the ioredis reconnect loop
      // alive and re-trigger error emissions indefinitely.
      enableOfflineQueue: isWorkerProcess,
      // Backoff on failed connects. Worker keeps retrying (prod needs
      // this for transient blips); HTTP process gives up after a
      // handful of attempts so stderr stays clean.
      retryStrategy: (times) => {
        if (isWorkerProcess) {
          return Math.min(1000 * Math.pow(2, Math.min(times, 6)), 60000);
        }
        // HTTP process: try 3 fast attempts, then give up for this
        // client. The request-path cooldown cache (in the API route)
        // keeps us from creating a fresh reconnect storm.
        return times > 3 ? null : 500 + times * 500;
      },
    });
    let warned = false;
    redis.on("error", (err) => {
      if (process.env.NODE_ENV !== "production" && !warned) {
        warned = true;
        console.warn(
          "[redis:worker] not reachable -",
          err.message,
          "(further retry errors suppressed)",
        );
      }
    });
    redis.on("ready", () => {
      warned = false;
      if (process.env.NODE_ENV !== "production") {
        console.log("[redis:worker] connected");
      }
    });
  }
  return redis;
}

/**
 * Redis client for the HTTP request path (rate limiting, short reads).
 *
 * Uses bounded retries + a short command timeout so that a Redis outage
 * surfaces as a thrown error in <1s instead of hanging the request handler.
 * Callers are expected to catch and fail open.
 */
export function getRequestRedis(): IORedis {
  if (!requestRedis) {
    requestRedis = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: 1,
      commandTimeout: 800,
      connectTimeout: 1000,
      enableReadyCheck: false,
      // Don't auto-reconnect forever - if Redis is down we want commands to
      // reject fast and the caller's fail-open branch to take over.
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 1000)),
    });
    requestRedis.on("error", (err) => {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[redis:request]", err.message);
      }
    });
  }
  return requestRedis;
}
