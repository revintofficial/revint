/**
 * Server-side helper for the Google Places Autocomplete (New) flow.
 *
 * Two endpoints, both proxied via `/api/places/autocomplete` and
 * `/api/places/details`:
 *
 *   1. `places:autocomplete` — turns a partial typed string into a list
 *      of place suggestions (placeId + two-line label). Filtered to
 *      admin/locality types so the dropdown never offers a business as
 *      a "location" (Google would happily suggest "Big Chefs" if we
 *      didn't restrict types).
 *
 *   2. `places/{placeId}` — fetches the picked place's viewport,
 *      lat/lng, country, and full canonical name. The viewport is the
 *      whole point of this rewrite: it goes straight into
 *      `discoverLeads()` as `locationRestriction.rectangle` and gives
 *      Google a hard server-side bounding box that fits the actual
 *      admin polygon — no more 5km circle missing the eastern half of
 *      Büyükçekmece, no more "buyukcekmece" leaking to Bend, Oregon.
 *
 * Caching strategy mirrors `src/lib/geocoding.ts`:
 *   - Redis 24h on (query+countryHint) for autocomplete and on placeId
 *     for details. Repeated typing of "istanbul" / "london" / etc.
 *     stays free after the first session of the day.
 *   - In-process LRU fallback when Redis is unavailable.
 *
 * Cost guard: autocomplete uses session tokens. Every keystroke in one
 * typing session is part of the SAME billing event (until either a
 * details call closes the session or 3 minutes pass). The frontend is
 * responsible for generating + reusing a session token across one
 * picker session and rotating after each chip add.
 */

import { logger } from "@/lib/logger";
import { getRequestRedis } from "@/lib/redis";
import type { PickedLocation, PlaceViewport } from "@/types";

const PLACES_API_BASE = "https://places.googleapis.com/v1";
const FETCH_TIMEOUT_MS = 8000;
const CACHE_TTL_SECONDS = 60 * 60 * 24; // 24h
const CACHE_VERSION = "v1";

// Suggestion types we want surfaced. Anything else (`establishment`,
// `restaurant`, `point_of_interest`) is a business, not a place to
// search inside, and would defeat the whole purpose of the picker.
//
// Google's "(cities)" / "(regions)" group filters from the legacy API
// don't exist on the new API; you list specific primary types or use
// the broader `regions` umbrella. We use explicit types so we get
// admin levels 1-3 + locality + sublocality + postal_code, which
// covers everything from a country to a neighbourhood worldwide.
const INCLUDED_PRIMARY_TYPES = [
  "country",
  "administrative_area_level_1",
  "administrative_area_level_2",
  "administrative_area_level_3",
  "locality",
  "sublocality",
  "sublocality_level_1",
  "neighborhood",
  "postal_code",
];

const MEMORY_CACHE_MAX = 500;
type MemoryEntry<T> = { value: T; expiresAt: number };
const autocompleteMem = new Map<string, MemoryEntry<AutocompleteSuggestion[]>>();
const detailsMem = new Map<string, MemoryEntry<PickedLocation>>();

function memorySet<T>(
  cache: Map<string, MemoryEntry<T>>,
  key: string,
  value: T,
): void {
  if (cache.size >= MEMORY_CACHE_MAX) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000,
  });
}

function memoryGet<T>(
  cache: Map<string, MemoryEntry<T>>,
  key: string,
): T | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
}

function getApiKey(): string | null {
  const k = process.env.GOOGLE_PLACES_API_KEY;
  return k && k.length > 0 ? k : null;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export interface AutocompleteSuggestion {
  placeId: string;
  primaryText: string;
  secondaryText: string;
  fullText: string;
  types: string[];
}

export interface AutocompleteOptions {
  query: string;
  sessionToken: string;
  /** ISO-2 country to bias ranking. Never used as a hard restriction
   *  because an agency in TR may legitimately target London. */
  regionCode?: string;
  languageCode?: string;
}

interface RawAutocompleteResponse {
  suggestions?: Array<{
    placePrediction?: {
      placeId: string;
      types?: string[];
      structuredFormat?: {
        mainText?: { text: string };
        secondaryText?: { text: string };
      };
      text?: { text: string };
    };
  }>;
  error?: { code?: number; message?: string; status?: string };
}

function autocompleteCacheKey(o: AutocompleteOptions): string {
  const q = o.query.trim().toLowerCase().replace(/\s+/g, " ");
  const r = (o.regionCode ?? "").toUpperCase();
  const l = (o.languageCode ?? "").toLowerCase();
  return `places:ac:${CACHE_VERSION}:${q}|${r}|${l}`;
}

let warnedNoKey = false;
let warnedDenied = false;

/**
 * Resolves a partial typed query into autocomplete suggestions.
 * Returns an empty array on any failure (missing key, API disabled,
 * transient error). Caller is expected to render "no suggestions"
 * gracefully rather than blocking the user — they can still fall
 * through to the legacy free-text + geocode path.
 */
export async function placeAutocomplete(
  opts: AutocompleteOptions,
): Promise<AutocompleteSuggestion[]> {
  const query = opts.query.trim();
  if (query.length < 2) return [];

  const apiKey = getApiKey();
  if (!apiKey) {
    if (!warnedNoKey) {
      warnedNoKey = true;
      logger.warn("places.autocomplete.no_api_key", {});
    }
    return [];
  }

  const key = autocompleteCacheKey(opts);

  // Redis cache. Fail-open: any error falls through to the API.
  let redisAvailable = true;
  try {
    const redis = getRequestRedis();
    const cached = await redis.get(key);
    if (cached !== null) {
      logger.info("places.autocomplete.cache_hit", { source: "redis", q: query });
      try {
        return JSON.parse(cached) as AutocompleteSuggestion[];
      } catch {
        // Bad cache entry — drop and re-fetch.
      }
    }
  } catch (err) {
    redisAvailable = false;
    logger.warn("places.autocomplete.redis_unavailable", {
      err: err instanceof Error ? err.message : String(err),
    });
  }

  if (!redisAvailable) {
    const memHit = memoryGet(autocompleteMem, key);
    if (memHit) {
      logger.info("places.autocomplete.cache_hit", { source: "memory", q: query });
      return memHit;
    }
  }

  const body: Record<string, unknown> = {
    input: query,
    sessionToken: opts.sessionToken,
    includedPrimaryTypes: INCLUDED_PRIMARY_TYPES,
  };
  if (opts.regionCode) body.regionCode = opts.regionCode;
  if (opts.languageCode) body.languageCode = opts.languageCode;

  let parsed: RawAutocompleteResponse;
  try {
    const res = await fetchWithTimeout(`${PLACES_API_BASE}/places:autocomplete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      // Differentiate "API not enabled in this project" from transient
      // 5xx so we don't keep flooding logs with the same line.
      if (res.status === 403 && !warnedDenied) {
        warnedDenied = true;
        logger.warn("places.autocomplete.api_denied", {
          status: res.status,
          body: text.slice(0, 200),
        });
      } else {
        logger.warn("places.autocomplete.api_fail", {
          status: res.status,
          body: text.slice(0, 200),
        });
      }
      return [];
    }

    parsed = (await res.json()) as RawAutocompleteResponse;
  } catch (err) {
    logger.warn("places.autocomplete.api_error", {
      err: err instanceof Error ? err.message : String(err),
      q: query,
    });
    return [];
  }

  const suggestions: AutocompleteSuggestion[] = [];
  for (const s of parsed.suggestions ?? []) {
    const p = s.placePrediction;
    if (!p?.placeId) continue;
    const main = p.structuredFormat?.mainText?.text ?? "";
    const secondary = p.structuredFormat?.secondaryText?.text ?? "";
    const full = p.text?.text ?? `${main}${secondary ? `, ${secondary}` : ""}`;
    suggestions.push({
      placeId: p.placeId,
      primaryText: main || full,
      secondaryText: secondary,
      fullText: full,
      types: Array.isArray(p.types) ? p.types : [],
    });
  }

  await writeCache(autocompleteMem, key, suggestions, redisAvailable);
  logger.info("places.autocomplete.api_success", {
    q: query,
    count: suggestions.length,
  });
  return suggestions;
}

interface RawDetailsResponse {
  id?: string;
  displayName?: { text: string; languageCode?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  viewport?: {
    low?: { latitude: number; longitude: number };
    high?: { latitude: number; longitude: number };
  };
  types?: string[];
  addressComponents?: Array<{
    longText?: string;
    shortText?: string;
    types?: string[];
  }>;
  error?: { code?: number; message?: string; status?: string };
}

function detailsCacheKey(placeId: string): string {
  return `places:det:${CACHE_VERSION}:${placeId}`;
}

/**
 * Fetches the picked place's viewport, lat/lng and country.
 * Returns null on failure — the picker should surface a generic
 * "couldn't fetch place details, try another" toast and let the user
 * pick again.
 *
 * `sessionToken` is forwarded so Google can attribute this Details
 * call to the autocomplete session and bill it together. Passing a
 * mismatched / expired token only breaks the session-billing
 * optimisation; the call still succeeds.
 */
export async function placeDetails(
  placeId: string,
  sessionToken: string,
): Promise<PickedLocation | null> {
  if (!placeId) return null;

  const apiKey = getApiKey();
  if (!apiKey) return null;

  const key = detailsCacheKey(placeId);

  let redisAvailable = true;
  try {
    const redis = getRequestRedis();
    const cached = await redis.get(key);
    if (cached !== null) {
      logger.info("places.details.cache_hit", { source: "redis", placeId });
      try {
        return JSON.parse(cached) as PickedLocation;
      } catch {
        // bad cache entry — drop and re-fetch.
      }
    }
  } catch (err) {
    redisAvailable = false;
    logger.warn("places.details.redis_unavailable", {
      err: err instanceof Error ? err.message : String(err),
    });
  }

  if (!redisAvailable) {
    const memHit = memoryGet(detailsMem, key);
    if (memHit) {
      logger.info("places.details.cache_hit", { source: "memory", placeId });
      return memHit;
    }
  }

  const fieldMask = [
    "id",
    "displayName",
    "formattedAddress",
    "location",
    "viewport",
    "types",
    "addressComponents",
  ].join(",");

  // Session token rides on the URL — Google's Place Details (New)
  // accepts it as a query param to close the autocomplete session.
  const url = `${PLACES_API_BASE}/places/${encodeURIComponent(
    placeId,
  )}?sessionToken=${encodeURIComponent(sessionToken)}`;

  let parsed: RawDetailsResponse;
  try {
    const res = await fetchWithTimeout(url, {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": fieldMask,
      },
    });
    if (!res.ok) {
      const text = await res.text();
      logger.warn("places.details.api_fail", {
        status: res.status,
        placeId,
        body: text.slice(0, 200),
      });
      return null;
    }
    parsed = (await res.json()) as RawDetailsResponse;
  } catch (err) {
    logger.warn("places.details.api_error", {
      err: err instanceof Error ? err.message : String(err),
      placeId,
    });
    return null;
  }

  const lat = parsed.location?.latitude;
  const lng = parsed.location?.longitude;
  if (typeof lat !== "number" || typeof lng !== "number") {
    logger.warn("places.details.no_location", { placeId });
    return null;
  }

  let viewport: PlaceViewport | undefined;
  const vLow = parsed.viewport?.low;
  const vHigh = parsed.viewport?.high;
  if (
    vLow &&
    vHigh &&
    typeof vLow.latitude === "number" &&
    typeof vLow.longitude === "number" &&
    typeof vHigh.latitude === "number" &&
    typeof vHigh.longitude === "number"
  ) {
    viewport = {
      sw: { lat: vLow.latitude, lng: vLow.longitude },
      ne: { lat: vHigh.latitude, lng: vHigh.longitude },
    };
  }

  // Pull ISO-2 country from addressComponents. Google emits the short
  // text as the alpha-2 code (e.g. "TR", "GB", "US").
  let countryCode: string | undefined;
  for (const c of parsed.addressComponents ?? []) {
    if (c.types?.includes("country") && c.shortText) {
      countryCode = c.shortText.toUpperCase();
      break;
    }
  }

  // Build a stable `displayName`: prefer formattedAddress because it's
  // already in the user's locale and includes the country. Fall back
  // to displayName.text + administrative chain if the formatted
  // string is missing.
  const displayName =
    parsed.formattedAddress ||
    parsed.displayName?.text ||
    placeId;

  // Split into the same two-line format the picker shows in chips,
  // mirroring autocomplete's structuredFormat. Google doesn't return
  // the structured split on Place Details, so we approximate by
  // splitting at the first comma — good enough for chip rendering.
  const commaIdx = displayName.indexOf(",");
  const primaryText =
    commaIdx > 0 ? displayName.slice(0, commaIdx).trim() : displayName;
  const secondaryText =
    commaIdx > 0 ? displayName.slice(commaIdx + 1).trim() : "";

  const picked: PickedLocation = {
    placeId,
    displayName,
    primaryText,
    secondaryText,
    lat,
    lng,
    viewport,
    countryCode,
  };

  await writeCache(detailsMem, key, picked, redisAvailable);
  logger.info("places.details.api_success", {
    placeId,
    hasViewport: !!viewport,
    countryCode: countryCode ?? null,
  });
  return picked;
}

async function writeCache<T>(
  mem: Map<string, MemoryEntry<T>>,
  key: string,
  value: T,
  redisAvailable: boolean,
): Promise<void> {
  if (redisAvailable) {
    try {
      const redis = getRequestRedis();
      await redis.set(key, JSON.stringify(value), "EX", CACHE_TTL_SECONDS);
      return;
    } catch (err) {
      logger.warn("places.cache.redis_write_failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }
  memorySet(mem, key, value);
}
