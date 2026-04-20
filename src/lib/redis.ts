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
    redis = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: null,
      // Silence unhandled 'error' events (connection refused, DNS failures).
      // BullMQ itself logs queue-level errors; the ioredis event noise just
      // floods the server console without adding information.
      enableReadyCheck: false,
    });
    redis.on("error", (err) => {
      // Swallow - BullMQ reconnects automatically and surfaces real errors
      // via its own events. Logging every connect retry is pure noise.
      if (process.env.NODE_ENV !== "production") {
        console.warn("[redis:worker]", err.message);
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
