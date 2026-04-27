/**
 * Borough / locality geocoding for the Discovery flow.
 *
 * Free-typed input from the Discovery page (e.g. "Istanbul Kartal",
 * "Camden", "Maltepe") arrives without coordinates. Google Places
 * Text Search treats `textQuery` as a soft hint and happily returns
 * matches in other cities or countries — see Bug #1 in
 * research/finedine/discovery-bugs.md (one Istanbul query returned a
 * row in Basel, Switzerland).
 *
 * This module turns that free-typed string into `{ lat, lng }` once
 * per (name, country) pair, so the downstream `discoverLeads()` call
 * can attach a `locationRestriction.circle` that Google enforces as
 * a hard exclude.
 *
 * Caching strategy:
 *   1. Redis (24h TTL via getRequestRedis) — survives restarts and
 *      is shared across HTTP processes. Fail-open on Redis outage.
 *   2. In-process Map fallback — keeps the route working when Redis
 *      is unreachable (dev machine without Redis, transient blip).
 *      Bounded at 500 entries via FIFO eviction so a long-running
 *      process never grows unbounded.
 *
 * Cost guard: a fan-out discovery hits up to N children × M pages of
 * Places. We geocode the borough ONCE up front and reuse the result
 * across every fan-out leg, so this adds at most one Geocoding API
 * call per Discovery click.
 *
 * If `GOOGLE_PLACES_API_KEY` is missing or Geocoding API is not
 * enabled in the project, we log once and return null. The caller
 * (`api/discovery/route.ts`) treats null as "fall back to no
 * spatial bias" so Discovery never fails because of a geocode miss.
 */

import { logger } from "@/lib/logger";
import { getRequestRedis } from "@/lib/redis";

const GEOCODE_API_BASE = "https://maps.googleapis.com/maps/api/geocode/json";
const GEOCODE_FETCH_TIMEOUT_MS = 8000;
const GEOCODE_CACHE_TTL_SECONDS = 60 * 60 * 24; // 24h
const GEOCODE_CACHE_VERSION = "v1";

export interface BoroughCoords {
  lat: number;
  lng: number;
}

// In-process LRU-ish fallback for environments without Redis.
// Bounded so a long-running Next dev server doesn't accumulate.
const MEMORY_CACHE_MAX = 500;
type MemoryEntry = { coords: BoroughCoords | null; expiresAt: number };
const memoryCache = new Map<string, MemoryEntry>();

function memorySet(key: string, value: MemoryEntry): void {
  if (memoryCache.size >= MEMORY_CACHE_MAX) {
    // Map preserves insertion order; drop the oldest.
    const firstKey = memoryCache.keys().next().value;
    if (firstKey !== undefined) memoryCache.delete(firstKey);
  }
  memoryCache.set(key, value);
}

function memoryGet(key: string): MemoryEntry | undefined {
  const hit = memoryCache.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt < Date.now()) {
    memoryCache.delete(key);
    return undefined;
  }
  return hit;
}

function cacheKey(name: string, country?: string): string {
  const normalized = name.trim().toLowerCase().replace(/\s+/g, " ");
  const c = (country ?? "").trim().toUpperCase();
  return `geocode:${GEOCODE_CACHE_VERSION}:${normalized}|${c}`;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = GEOCODE_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

interface GeocodeApiResponse {
  status: string;
  results?: Array<{
    geometry?: {
      location?: { lat: number; lng: number };
    };
  }>;
  error_message?: string;
}

let warnedNoKey = false;
let warnedDisabled = false;

/**
 * Resolves a free-typed borough/locality string to `{ lat, lng }`.
 * Returns null when geocoding is unavailable or the address didn't
 * resolve — caller MUST treat null as "no spatial bias", not as an
 * error condition. Discovery still works without coordinates, just
 * with the pre-existing wrong-location problem; never block the user
 * over a geocoding hiccup.
 */
export async function geocodeBorough(
  name: string,
  country?: string,
): Promise<BoroughCoords | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    if (!warnedNoKey) {
      warnedNoKey = true;
      logger.warn("geocode.no_api_key", {});
    }
    return null;
  }

  const key = cacheKey(trimmed, country);

  // 1. Redis cache. Fail-open: any Redis problem just falls through
  //    to the API call.
  let redisAvailable = true;
  try {
    const redis = getRequestRedis();
    const cached = await redis.get(key);
    if (cached !== null) {
      logger.info("geocode.cache_hit", {
        source: "redis",
        name: trimmed,
        country: country ?? null,
      });
      // Cached "no result" is stored as the literal string "null" so
      // we don't keep retrying every request when the upstream
      // service has returned ZERO_RESULTS for this borough.
      if (cached === "null") return null;
      const parsed = JSON.parse(cached) as BoroughCoords;
      return parsed;
    }
  } catch (err) {
    redisAvailable = false;
    logger.warn("geocode.redis_unavailable", {
      err: err instanceof Error ? err.message : String(err),
    });
  }

  // 2. In-process fallback cache (only consulted when Redis errored).
  if (!redisAvailable) {
    const memHit = memoryGet(key);
    if (memHit) {
      logger.info("geocode.cache_hit", {
        source: "memory",
        name: trimmed,
        country: country ?? null,
      });
      return memHit.coords;
    }
  }

  // 3. Geocoding API call.
  const params = new URLSearchParams({
    address: trimmed,
    key: apiKey,
  });
  if (country) {
    params.set("components", `country:${country}`);
  }

  const url = `${GEOCODE_API_BASE}?${params.toString()}`;

  let parsed: GeocodeApiResponse;
  try {
    const res = await fetchWithTimeout(url, { method: "GET" });
    if (!res.ok) {
      logger.warn("geocode.api_fail", {
        name: trimmed,
        country: country ?? null,
        status: res.status,
      });
      return null;
    }
    parsed = (await res.json()) as GeocodeApiResponse;
  } catch (err) {
    logger.warn("geocode.api_error", {
      name: trimmed,
      country: country ?? null,
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }

  // Common failure modes:
  //   REQUEST_DENIED → the project's API key does not have Geocoding
  //     API enabled. Log once and treat as unavailable.
  //   ZERO_RESULTS   → genuinely unknown locality; cache as null so we
  //     don't retry on every Discovery click.
  //   OVER_QUERY_LIMIT / UNKNOWN_ERROR → transient; do NOT cache, let
  //     the next request retry.
  if (parsed.status === "REQUEST_DENIED") {
    if (!warnedDisabled) {
      warnedDisabled = true;
      logger.warn("geocode.api_disabled", {
        message: parsed.error_message ?? "Geocoding API request denied",
      });
    }
    return null;
  }

  if (parsed.status === "OVER_QUERY_LIMIT" || parsed.status === "UNKNOWN_ERROR") {
    logger.warn("geocode.api_transient", {
      name: trimmed,
      country: country ?? null,
      status: parsed.status,
    });
    return null;
  }

  const loc = parsed.results?.[0]?.geometry?.location;
  if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") {
    // Cache "no result" so we don't pound the API for unknown
    // boroughs.
    await writeCache(key, null, redisAvailable);
    logger.info("geocode.api_zero_results", {
      name: trimmed,
      country: country ?? null,
      status: parsed.status,
    });
    return null;
  }

  const coords: BoroughCoords = { lat: loc.lat, lng: loc.lng };
  await writeCache(key, coords, redisAvailable);
  logger.info("geocode.api_success", {
    name: trimmed,
    country: country ?? null,
    lat: coords.lat,
    lng: coords.lng,
  });
  return coords;
}

async function writeCache(
  key: string,
  value: BoroughCoords | null,
  redisAvailable: boolean,
): Promise<void> {
  const expiresAt = Date.now() + GEOCODE_CACHE_TTL_SECONDS * 1000;
  if (redisAvailable) {
    try {
      const redis = getRequestRedis();
      const payload = value === null ? "null" : JSON.stringify(value);
      await redis.set(key, payload, "EX", GEOCODE_CACHE_TTL_SECONDS);
      return;
    } catch (err) {
      logger.warn("geocode.redis_write_failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }
  // Either Redis was down, or the write failed. Use the in-process
  // fallback so at least the same process doesn't re-geocode on the
  // next click.
  memorySet(key, { coords: value, expiresAt });
}
