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

import { getRequestRedis } from "@/lib/redis";
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
  websiteCheck: { bucket: "wcheck", windowSec: 60, limit: 30 },
  crawl: { bucket: "crawl", windowSec: 60, limit: 10 },
  // Lighter limit for the location picker's per-keystroke autocomplete
  // proxy. 60/min ≈ one debounced keystroke per second per workspace —
  // fine for human typing but caps a runaway client loop.
  placesAutocomplete: { bucket: "pac", windowSec: 60, limit: 60 },
  // Place Details is fired once per picked suggestion, so the budget
  // is dominated by chip selections (max 5 chips × a few retries).
  placesDetails: { bucket: "pdet", windowSec: 60, limit: 30 },
  // M26 - Web Vitals beacon. Public, anonymous endpoint so we
  // bucket on the caller's IP (or the synthetic "anon" subject when
  // we can't read it). 60 requests / minute leaves comfortable
  // headroom for the ~5 metrics × normal-page navigations a single
  // session generates while bounding a runaway client / abusive
  // scraper to 1 write per second per IP.
  webVitals: { bucket: "wvit", windowSec: 60, limit: 60 },
  // Marketing demo-request form. Public, anonymous, IP-bucketed. Real
  // demo signups arrive at human pace (1-2 per browser session); this
  // limit blocks form-spam attacks without ever rate-limiting an actual
  // prospect filling out the form even slowly.
  demoRequest: { bucket: "demo", windowSec: 600, limit: 5 },
  // Marketing waitlist form on the homepage. Same shape and reasoning
  // as demoRequest — a real prospect submits once, anything more is a
  // bot loop or a fat-fingered double-submit.
  waitlist: { bucket: "wlst", windowSec: 600, limit: 5 },
  // Marketing analytics ingest. Public, anonymous, IP-bucketed. The
  // client tracker batches events every 5 seconds (12 batches/min in
  // a continuously-active tab) so 120/min gives 10x headroom for
  // legit traffic while bounding a runaway/spammy client. Each batch
  // can carry up to 100 events server-side; that ceiling lives in
  // /api/track/marketing.
  marketingTrack: { bucket: "mtrack", windowSec: 60, limit: 120 },
} as const satisfies Record<string, RateLimitConfig>;

export async function checkRateLimit(
  subject: string,
  cfg: RateLimitConfig,
): Promise<RateLimitResult> {
  const windowStart = Math.floor(Date.now() / 1000 / cfg.windowSec) * cfg.windowSec;
  const key = `rl:${cfg.bucket}:${subject}:${windowStart}`;

  try {
    const redis = getRequestRedis();
    const pipeline = redis.multi();
    pipeline.incr(key);
    pipeline.expire(key, cfg.windowSec + 1);
    // Extra belt-and-braces timeout in case commandTimeout on the client
    // fails to fire (e.g. during initial connect handshake).
    const results = await Promise.race([
      pipeline.exec(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
    ]);
    if (!results) {
      throw new Error("ratelimit.timeout");
    }
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
