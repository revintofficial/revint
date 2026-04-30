/**
 * Phase 2 — best-effort timezone estimation for a Lead at discovery
 * time. We don't pay for the Google Time Zone API; instead we map
 * the formattedAddress / borough hint to an IANA zone using a
 * small static table covering the markets the FineDine pilot
 * actually targets (TR, UK, EU, US, MENA).
 *
 * Returns null if we can't make a confident guess. Better to leave
 * the field null than write a wrong zone — the UI will fall back
 * to "Local time unknown" gracefully.
 */
const COUNTRY_TO_TZ: Record<string, string> = {
  // Pilot markets — high confidence.
  Turkey: "Europe/Istanbul",
  Türkiye: "Europe/Istanbul",
  TR: "Europe/Istanbul",
  "United Kingdom": "Europe/London",
  UK: "Europe/London",
  England: "Europe/London",
  Scotland: "Europe/London",
  Wales: "Europe/London",
  // EU west.
  Ireland: "Europe/Dublin",
  France: "Europe/Paris",
  Spain: "Europe/Madrid",
  Portugal: "Europe/Lisbon",
  Italy: "Europe/Rome",
  Belgium: "Europe/Brussels",
  Netherlands: "Europe/Amsterdam",
  Germany: "Europe/Berlin",
  Switzerland: "Europe/Zurich",
  Austria: "Europe/Vienna",
  // EU central / east.
  Greece: "Europe/Athens",
  Bulgaria: "Europe/Sofia",
  Romania: "Europe/Bucharest",
  Poland: "Europe/Warsaw",
  // MENA.
  UAE: "Asia/Dubai",
  "United Arab Emirates": "Asia/Dubai",
  "Saudi Arabia": "Asia/Riyadh",
  Israel: "Asia/Jerusalem",
  Egypt: "Africa/Cairo",
  // North America (FineDine has UK + US ambitions).
  USA: "America/New_York",
  "United States": "America/New_York",
  Canada: "America/Toronto",
};

const STATE_TO_TZ: Record<string, string> = {
  // US states that span multiple zones — these override the country
  // default. Right side of America for UK-relative pilot.
  California: "America/Los_Angeles",
  CA: "America/Los_Angeles",
  Washington: "America/Los_Angeles",
  Oregon: "America/Los_Angeles",
  Nevada: "America/Los_Angeles",
  Arizona: "America/Phoenix",
  Texas: "America/Chicago",
  Illinois: "America/Chicago",
  Minnesota: "America/Chicago",
  Wisconsin: "America/Chicago",
  Florida: "America/New_York",
  "New York": "America/New_York",
  Massachusetts: "America/New_York",
};

const CITY_TO_TZ: Record<string, string> = {
  // London + Istanbul + NYC = >90% of the FineDine pilot dataset.
  London: "Europe/London",
  Istanbul: "Europe/Istanbul",
  Ankara: "Europe/Istanbul",
  Izmir: "Europe/Istanbul",
  "New York": "America/New_York",
  NYC: "America/New_York",
  "Los Angeles": "America/Los_Angeles",
  Chicago: "America/Chicago",
  Dubai: "Asia/Dubai",
  Paris: "Europe/Paris",
  Berlin: "Europe/Berlin",
};

/**
 * Estimate IANA timezone from a free-form formatted address.
 * Returns null when we can't make a confident guess.
 */
export function estimateTimezoneFromAddress(address: string | null | undefined): string | null {
  if (!address) return null;
  const lower = address.toLowerCase();

  // 1. City exact match (highest signal).
  for (const [city, tz] of Object.entries(CITY_TO_TZ)) {
    if (lower.includes(city.toLowerCase())) return tz;
  }
  // 2. State (US specific, matters more than country for US).
  for (const [state, tz] of Object.entries(STATE_TO_TZ)) {
    if (lower.includes(`, ${state.toLowerCase()}`) || lower.includes(`, ${state.toLowerCase()},`)) {
      return tz;
    }
  }
  // 3. Country fallback.
  for (const [country, tz] of Object.entries(COUNTRY_TO_TZ)) {
    if (lower.includes(country.toLowerCase())) return tz;
  }
  return null;
}

/**
 * Estimate timezone from lat/lng. Coarse — we use major-city
 * latitude bands rather than a real polygon lookup. Good enough
 * for the "is it lunch time at this prospect?" UX hint, not for
 * scheduling.
 */
export function estimateTimezoneFromLatLng(
  lat: number | null | undefined,
  lng: number | null | undefined,
): string | null {
  if (lat == null || lng == null) return null;
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

  // Europe/UK band (40-60 N, -10 to 30 E).
  if (lat >= 40 && lat <= 60) {
    if (lng >= -10 && lng <= 1) return "Europe/London";
    if (lng > 1 && lng <= 16) return "Europe/Paris";
    if (lng > 16 && lng <= 30) return "Europe/Istanbul";
  }
  // North America rough bands.
  if (lat >= 25 && lat <= 50 && lng <= -65 && lng >= -125) {
    if (lng >= -85) return "America/New_York";
    if (lng >= -100) return "America/Chicago";
    if (lng >= -115) return "America/Denver";
    return "America/Los_Angeles";
  }
  return null;
}

/**
 * Combined estimator — prefers address (string match cheap and
 * more accurate for postal-style addresses) then falls back to
 * lat/lng.
 */
export function estimateLeadTimezone(input: {
  formattedAddress?: string | null;
  borough?: string | null;
  sourceLat?: number | null;
  sourceLng?: number | null;
}): string | null {
  return (
    estimateTimezoneFromAddress(input.formattedAddress) ||
    estimateTimezoneFromAddress(input.borough) ||
    estimateTimezoneFromLatLng(input.sourceLat ?? null, input.sourceLng ?? null)
  );
}

/**
 * Format the prospect's local time as a short label e.g.
 *   "14:34 (lunch rush)" or "21:02 (after hours)" or "Local time —"
 *
 * Used by the call-sheet header on the lead detail page.
 */
export interface LocalTimeBadge {
  label: string;
  hint: string | null;
  isCallable: boolean;
}

export function formatLocalTimeBadge(timezone: string | null | undefined): LocalTimeBadge {
  if (!timezone) {
    return { label: "Local time —", hint: null, isCallable: true };
  }
  try {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const time = fmt.format(new Date());
    const hour = parseInt(time.split(":")[0] ?? "0", 10);
    let hint: string | null = null;
    let isCallable = true;

    // Hospitality-tuned hints — FineDine prospects are restaurants
    // and hotels. Mid-day "service rush" is a bad time to call;
    // 09-11 and 14-17 are the sweet spots.
    if (hour < 9 || hour >= 19) {
      hint = "after hours";
      isCallable = false;
    } else if (hour >= 12 && hour < 14) {
      hint = "lunch service — don't call";
      isCallable = false;
    } else if (hour === 9) {
      hint = "morning prep";
    } else if (hour >= 14 && hour < 17) {
      hint = "best window";
    } else if (hour >= 17 && hour < 19) {
      hint = "dinner setup";
    }
    return {
      label: hint ? `${time} · ${hint}` : `${time}`,
      hint,
      isCallable,
    };
  } catch {
    return { label: "Local time —", hint: null, isCallable: true };
  }
}
