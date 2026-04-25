import type { PlaceResult, PlacesSearchResponse, DiscoveryQuery, PlaceReview } from "@/types";
import { LONDON_BOROUGHS } from "@/types";

const PLACES_API_BASE = "https://places.googleapis.com/v1";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
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
  radiusMeters = 5000
): Promise<PlaceResult[]> {
  const allPlaces: PlaceResult[] = [];
  const countryPart = location.country ? `, ${location.country}` : "";
  const query: DiscoveryQuery = {
    textQuery: `${searchQuery} in ${location.name}${countryPart}`,
    // Only attach a lat/lng bias when both coordinates are truthy — passing
    // 0,0 would bias results towards the Gulf of Guinea.
    ...(location.lat && location.lng
      ? {
          locationBias: {
            circle: {
              center: { latitude: location.lat, longitude: location.lng },
              radius: radiusMeters,
            },
          },
        }
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

export function extractBoroughFromAddress(address: string): string | null {
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
