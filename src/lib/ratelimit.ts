/**
 * Redis-backed fixed-window rate limiter.
 *
 * Every expensive AI / paid-API endpoint gets a budget per workspace. If
 * Redis is unavailable we fail OPEN (log + allow) rather than DoS ourselves;
 * the quota system already caps absolute usage via Postgres.
 *
 * Windows are short (minutes), not subscription cycle - for monthly caps
 * see src/lib/quotas.ts.
 */

import { getRedis } from "@/lib/redis";
import { logger } from "@/lib/logger";

export interface RateLimitConfig {
  /** short stable id used in the redis key, e.g. "ai:analyze" */
  bucket: string;
  /** window length in seconds */
  windowSec: number;
  /** max requests per window per subject */
  limit: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  limit: number;
  resetSec: number;
}

export const LIMITS = {
  discovery: { bucket: "disc", windowSec: 60, limit: 10 },
  analyze: { bucket: "ana", windowSec: 60, limit: 20 },
  websitePlan: { bucket: "plan", windowSec: 60, limit: 10 },
  websiteSearch: { bucket: "wsrch", windowSec: 60, limit: 15 },
  copilot: { bucket: "copi", windowSec: 60, limit: 30 },
} as const satisfies Record<string, RateLimitConfig>;

export async function checkRateLimit(
  subject: string,
  cfg: RateLimitConfig,
): Promise<RateLimitResult> {
  const windowStart = Math.floor(Date.now() / 1000 / cfg.windowSec) * cfg.windowSec;
  const key = `rl:${cfg.bucket}:${subject}:${windowStart}`;

  try {
    const redis = getRedis();
    const pipeline = redis.multi();
    pipeline.incr(key);
    pipeline.expire(key, cfg.windowSec + 1);
    const results = await pipeline.exec();
    const count = Number((results?.[0]?.[1] as number | string | null) ?? 0);
    const remaining = Math.max(0, cfg.limit - count);
    const resetSec = windowStart + cfg.windowSec - Math.floor(Date.now() / 1000);
    return { ok: count <= cfg.limit, remaining, limit: cfg.limit, resetSec };
  } catch (err) {
    // Fail open - quotas.ts still caps absolute spend, and we don't want a
    // Redis blip to take the app down.
    logger.warn("ratelimit.redis_unavailable", { err: String(err), bucket: cfg.bucket });
    return { ok: true, remaining: cfg.limit, limit: cfg.limit, resetSec: cfg.windowSec };
  }
}

/** JSON body + headers for a 429 response. */
export function rateLimitResponse(r: RateLimitResult) {
  return new Response(
    JSON.stringify({
      error: "rate_limited",
      message: `Too many requests. Retry in ${r.resetSec}s.`,
      limit: r.limit,
      resetSec: r.resetSec,
    }),
    {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(r.resetSec),
        "x-ratelimit-limit": String(r.limit),
        "x-ratelimit-remaining": String(r.remaining),
      },
    },
  );
}
