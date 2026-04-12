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

  const res = await fetch(`${PLACES_API_BASE}/places:searchText`, {
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

  const res = await fetch(`${PLACES_API_BASE}/places/${placeId}`, {
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

  const res = await fetch(`${PLACES_API_BASE}/places/${placeId}`, {
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
  borough: { name: string; lat: number; lng: number },
  radiusMeters = 5000
): Promise<PlaceResult[]> {
  const allPlaces: PlaceResult[] = [];
  const query: DiscoveryQuery = {
    textQuery: `${searchQuery} in ${borough.name} London`,
    locationBias: {
      circle: {
        center: { latitude: borough.lat, longitude: borough.lng },
        radius: radiusMeters,
      },
    },
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
