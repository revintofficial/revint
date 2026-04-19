/**
 * P1.5 - GPS-based lead sorting helpers.
 *
 * Haversine distance for "sort by nearest" + "within X miles" filter.
 * ICP4 use case: walk-in agency morning planning. "I parked in Camden, show
 * me plumbers within 1 mile of me, sorted by walking distance."
 */

const EARTH_RADIUS_KM = 6371;
const KM_TO_MILES = 0.621371;

/** Great-circle distance in kilometers between two lat/lng points. */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export function haversineMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  return haversineKm(lat1, lng1, lat2, lng2) * KM_TO_MILES;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

interface Geocoded {
  sourceLat: number | null;
  sourceLng: number | null;
}

/**
 * Sort an array of leads by distance from `(lat, lng)`. Leads without a
 * location go to the end of the list. Returns a new array.
 */
export function sortByDistance<T extends Geocoded>(
  leads: T[],
  lat: number,
  lng: number,
): Array<T & { distanceMiles: number | null }> {
  const annotated = leads.map((l) => ({
    ...l,
    distanceMiles:
      l.sourceLat != null && l.sourceLng != null
        ? haversineMiles(lat, lng, l.sourceLat, l.sourceLng)
        : null,
  }));
  return annotated.sort((a, b) => {
    if (a.distanceMiles == null && b.distanceMiles == null) return 0;
    if (a.distanceMiles == null) return 1;
    if (b.distanceMiles == null) return -1;
    return a.distanceMiles - b.distanceMiles;
  });
}

/** Filter to only leads within `maxMiles` of `(lat, lng)`. */
export function filterWithinMiles<T extends Geocoded>(
  leads: T[],
  lat: number,
  lng: number,
  maxMiles: number,
): T[] {
  return leads.filter((l) => {
    if (l.sourceLat == null || l.sourceLng == null) return false;
    return haversineMiles(lat, lng, l.sourceLat, l.sourceLng) <= maxMiles;
  });
}
