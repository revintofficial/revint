import type { PlaceResult, PlacesSearchResponse, DiscoveryQuery, PlaceReview } from "@/types";
import { LONDON_BOROUGHS } from "@/types";

const PLACES_API_BASE = "https://places.googleapis.com/v1";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  // Structured address parts so we can pick the borough /
  // administrative_area_level_2 reliably for non-UK addresses (see
  // Bug #7 in research/finedine/discovery-bugs.md).
  "places.addressComponents",
  "places.websiteUri",
  "places.googleMapsUri",
  "places.nationalPhoneNumber",
  "places.rating",
  "places.userRatingCount",
  "places.businessStatus",
  "places.primaryType",
  "places.primaryTypeDisplayName",
].join(",");

function getApiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY is not set");
  return key;
}

// Hard cap on every outbound call to Google Places. Without this a hung TCP
// connection (or a Google-side incident) silently holds the entire /api/discovery
// HTTP handler open until the Vercel/edge function timeout kills it mid-flight,
// which the client then sees as an indefinite "Searching…" spinner.
const PLACES_FETCH_TIMEOUT_MS = 15000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = PLACES_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(
        `Google Places request timed out after ${timeoutMs}ms. ` +
          `Try again or narrow the search.`,
      );
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function textSearch(
  query: DiscoveryQuery,
  pageToken?: string
): Promise<PlacesSearchResponse> {
  const body: Record<string, unknown> = {
    textQuery: query.textQuery,
    languageCode: "en",
    maxResultCount: 20,
  };

  if (query.locationBias) {
    body.locationBias = query.locationBias;
  }

  // locationRestriction is a hard exclude; locationBias is a soft hint.
  // Google rejects requests that send both, so callers MUST pick one.
  if (query.locationRestriction) {
    body.locationRestriction = query.locationRestriction;
  }

  if (query.includedTypes && query.includedTypes.length > 0) {
    body.includedType = query.includedTypes[0];
  }

  if (pageToken) {
    body.pageToken = pageToken;
  }

  const res = await fetchWithTimeout(`${PLACES_API_BASE}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": getApiKey(),
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    let message = `Places API error (${res.status})`;
    try {
      const errJson = JSON.parse(errText);
      if (errJson.error?.status === "PERMISSION_DENIED") {
        message = "Google Places API aktif degil. Google Cloud Console'dan 'Places API (New)' servisini etkinlestirin.";
      } else if (res.status === 429) {
        message = "Google Places API kota limiti asildi. Lutfen bekleyin.";
      } else {
        message = errJson.error?.message || message;
      }
    } catch { /* use default message */ }
    throw new Error(message);
  }

  return res.json();
}

export async function getPlaceDetails(placeId: string): Promise<PlaceResult> {
  const detailFields = [
    "id",
    "displayName",
    "formattedAddress",
    "websiteUri",
    "googleMapsUri",
    "nationalPhoneNumber",
    "rating",
    "userRatingCount",
    "businessStatus",
    "primaryType",
    "primaryTypeDisplayName",
  ].join(",");

  const res = await fetchWithTimeout(`${PLACES_API_BASE}/places/${placeId}`, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": getApiKey(),
      "X-Goog-FieldMask": detailFields,
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Places API Details failed (${res.status}): ${err}`);
  }

  return res.json();
}

export async function getPlaceReviews(placeId: string): Promise<PlaceReview[]> {
  const reviewFields = [
    "reviews.authorAttribution",
    "reviews.rating",
    "reviews.text",
    "reviews.relativePublishTimeDescription",
    "reviews.publishTime",
  ].join(",");

  const res = await fetchWithTimeout(`${PLACES_API_BASE}/places/${placeId}`, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": getApiKey(),
      "X-Goog-FieldMask": reviewFields,
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Places API Reviews failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.reviews || [];
}

export async function discoverLeads(
  searchQuery: string,
  location: { name: string; country?: string; lat?: number; lng?: number },
  radiusMeters = 5000,
  options: { includedTypes?: string[] } = {},
): Promise<PlaceResult[]> {
  const allPlaces: PlaceResult[] = [];
  const countryPart = location.country ? `, ${location.country}` : "";
  // Google rejects circle.radius > 50000m on locationRestriction.
  const clampedRadius = Math.min(Math.max(radiusMeters, 100), 50000);
  // Prefer locationRestriction (hard exclude) over locationBias (soft
  // hint) whenever we have real coordinates. The API rejects requests
  // that send both, so it's an either/or choice — keep the existing
  // 0,0 guard so a sentinel pair never leaks through.
  const haveCoords = !!location.lat && !!location.lng;
  const query: DiscoveryQuery = {
    textQuery: `${searchQuery} in ${location.name}${countryPart}`,
    ...(haveCoords
      ? {
          locationRestriction: {
            circle: {
              center: { latitude: location.lat!, longitude: location.lng! },
              radius: clampedRadius,
            },
          },
        }
      : {}),
    ...(options.includedTypes && options.includedTypes.length > 0
      ? { includedTypes: options.includedTypes }
      : {}),
  };

  let pageToken: string | undefined;
  let pages = 0;
  const maxPages = 3;

  do {
    const response = await textSearch(query, pageToken);
    if (response.places) {
      allPlaces.push(...response.places);
    }
    pageToken = response.nextPageToken;
    pages++;
    if (pageToken && pages < maxPages) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  } while (pageToken && pages < maxPages);

  return allPlaces;
}

/**
 * Extracts the borough / district / locality for a Google place.
 *
 * Prefers structured `addressComponents` (Bug #7): Google emits a
 * typed list like
 *   [
 *     { types: ["administrative_area_level_2"], longText: "Kartal" },
 *     { types: ["administrative_area_level_1"], longText: "Istanbul" },
 *     { types: ["country", "political"],         longText: "Türkiye" },
 *   ]
 * which works for any country. The legacy London-only string-match
 * fallback only fires when components are absent (older cached rows /
 * fields not requested).
 *
 * Order of preference:
 *   1. administrative_area_level_2 (county/district — best for most
 *      countries; UK borough, TR ilçe, US county)
 *   2. sublocality_level_1 / sublocality (neighbourhood)
 *   3. postal_town (UK / IE common)
 *   4. locality (city)
 *   5. London string-match map (legacy only)
 */
export function extractBoroughFromAddress(
  address: string,
  components?: {
    longText: string;
    shortText: string;
    types: string[];
  }[],
): string | null {
  if (components && components.length > 0) {
    // Defensive: Google's v1 Places schema documents `types` as a
    // required array, but in practice we've seen components arrive
    // without it (and `longText` occasionally absent on routes /
    // plus_codes). The TS type makes them required; runtime can lie.
    // A single bad component must not crash the whole Discovery POST.
    const findByType = (type: string): string | null => {
      const c = components.find(
        (x) => Array.isArray(x?.types) && x.types.includes(type),
      );
      return c && typeof c.longText === "string" && c.longText.length > 0
        ? c.longText
        : null;
    };
    return (
      findByType("administrative_area_level_2") ||
      findByType("sublocality_level_1") ||
      findByType("sublocality") ||
      findByType("postal_town") ||
      findByType("locality") ||
      null
    );
  }
  const addr = address.toLowerCase();
  for (const b of LONDON_BOROUGHS) {
    if (addr.includes(b.name.toLowerCase())) return b.name;
  }
  const neighbourhoodMap: Record<string, string> = {
    "woolwich": "Greenwich",
    "blackheath": "Greenwich",
    "deptford": "Lewisham",
    "catford": "Lewisham",
    "brixton": "Lambeth",
    "streatham": "Lambeth",
    "shoreditch": "Hackney",
    "dalston": "Hackney",
    "stratford": "Newham",
    "east ham": "Newham",
    "walthamstow": "Waltham Forest",
    "leyton": "Waltham Forest",
    "tottenham": "Haringey",
    "peckham": "Southwark",
    "bermondsey": "Southwark",
    "camberwell": "Southwark",
    "bethnal green": "Tower Hamlets",
    "bow": "Tower Hamlets",
    "whitechapel": "Tower Hamlets",
    "tooting": "Wandsworth",
    "putney": "Wandsworth",
    "battersea": "Wandsworth",
    "wimbledon": "Merton",
    "finchley": "Barnet",
    "edgware": "Barnet",
    "ilford": "Redbridge",
    "romford": "Havering",
    "uxbridge": "Hillingdon",
    "twickenham": "Richmond upon Thames",
    "chiswick": "Hounslow",
    "kilburn": "Brent",
    "wembley": "Brent",
    "croydon": "Croydon",
    "surbiton": "Kingston upon Thames",
    "notting hill": "Kensington and Chelsea",
    "chelsea": "Kensington and Chelsea",
    "fulham": "Hammersmith and Fulham",
    "shepherd's bush": "Hammersmith and Fulham",
  };
  for (const [neighbourhood, borough] of Object.entries(neighbourhoodMap)) {
    if (addr.includes(neighbourhood)) return borough;
  }
  return null;
}
