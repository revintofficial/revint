export interface PlaceAddressComponent {
  longText: string;
  shortText: string;
  // Google emits a list of typed roles per component, e.g.
  // ["administrative_area_level_2", "political"] for "Kartal".
  types: string[];
  languageCode?: string;
}

export interface PlaceResult {
  id: string;
  displayName?: { text: string; languageCode: string };
  formattedAddress?: string;
  // Structured breakdown of the address. Optional because legacy /
  // detail-view code paths don't always request this field.
  addressComponents?: PlaceAddressComponent[];
  websiteUri?: string;
  googleMapsUri?: string;
  nationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
  primaryType?: string;
  primaryTypeDisplayName?: { text: string };
}

export interface PlacesSearchResponse {
  places: PlaceResult[];
  nextPageToken?: string;
}

export interface DiscoveryQuery {
  textQuery: string;
  // Soft hint — Google ranks places inside the circle higher but
  // does NOT exclude others. Useful when we only have a fuzzy
  // location (e.g. neighbourhood name without coordinates).
  locationBias?: {
    circle: {
      center: { latitude: number; longitude: number };
      radius: number;
    };
  };
  // Hard exclude — Google drops any place outside the area. We
  // prefer this whenever we have geocoded coordinates (see
  // src/lib/geocoding.ts) so a search for "Istanbul Kartal" cannot
  // surface a hotel in Maltepe or Basel. Either circle (geocoded
  // free-text fallback path) OR rectangle (preferred — comes from
  // the picked place's own viewport bounds, which fit the actual
  // admin polygon better than a fixed-radius circle).
  locationRestriction?:
    | {
        circle: {
          center: { latitude: number; longitude: number };
          radius: number;
        };
      }
    | {
        rectangle: {
          low: { latitude: number; longitude: number };
          high: { latitude: number; longitude: number };
        };
      };
  // Server-side type filter. e.g. ["restaurant", "bar"] makes Google
  // return only those primary types — the cheapest way to keep
  // "food truck" from matching a truck dealer.
  includedTypes?: string[];
}

/**
 * A geographic viewport (rectangle) returned by Google Places for any
 * place. NE corner = `high`, SW corner = `low`, in Google's own
 * vocabulary. We use this directly as `locationRestriction.rectangle`
 * so a search inside Büyükçekmece (a ~15km coastal district) covers
 * the actual admin polygon instead of a 5km circle around the
 * centroid.
 */
export interface PlaceViewport {
  ne: { lat: number; lng: number };
  sw: { lat: number; lng: number };
}

/**
 * The shape produced by the LocationPicker (combobox + chips) and
 * consumed by /api/discovery. Each entry corresponds to one user
 * selection from the Google Places Autocomplete (New) dropdown.
 *
 *   placeId       – Google Places opaque id (e.g. "ChIJ..."). Stable
 *                   across sessions; we stamp it onto Lead.sourceQuery
 *                   so analytics can group by the picked area instead
 *                   of by user typing.
 *   displayName   – the full canonical name ("Büyükçekmece, Istanbul,
 *                   Türkiye"). Used in toast / breadcrumb copy.
 *   primaryText / secondaryText – the two-line label Google shows in
 *                   the autocomplete dropdown. Stored so we can render
 *                   the picked chip the same way.
 *   lat, lng      – fallback circle centre when viewport is missing.
 *   viewport      – the place's own bounding box; preferred over lat/
 *                   lng for fan-out queries.
 *   countryCode   – ISO-2 (e.g. "TR"). Optional — derived from the
 *                   addressComponents when the picker fetches details.
 */
export interface PickedLocation {
  placeId: string;
  displayName: string;
  primaryText: string;
  secondaryText: string;
  lat: number;
  lng: number;
  viewport?: PlaceViewport;
  countryCode?: string;
}

/**
 * Crawl outcome tag. Phase 0/B1 — disambiguates "we never tried" from
 * "we tried but the site blocked our bot" from "DNS / SSL hard fail".
 * Surfaced in the lead detail UI so the SDR can decide whether to
 * trust the audit or open the site themselves.
 */
export type CrawlError =
  | "TIMEOUT"           // navigation exceeded our budget
  | "DNS_ERROR"         // hostname did not resolve
  | "TLS_ERROR"         // SSL handshake / cert failure
  | "BOT_BLOCKED_4XX"   // 401/403 — server refused our UA, human can usually open
  | "SERVER_5XX"        // 5xx — origin error
  | "REDIRECT_LOOP"     // too many redirects
  | "PLAYWRIGHT_CRASH"  // browser/page crashed mid-navigation
  | "EMPTY_RESPONSE"    // page loaded but produced 0 bytes
  | "UNKNOWN";

export interface WebsiteFeatures {
  url: string;
  reachable: boolean;
  /**
   * Phase 0/B1 — final HTTP status from the navigation, even when
   * 4xx/5xx. null when navigation never produced a response (timeout,
   * DNS, TLS). The previous crawler treated `!response.ok()` as
   * "unreachable" which zeroed every other field. Now `reachable` is
   * true when we got USEFUL HTML (2xx OR a 3xx that still rendered
   * content OR a 4xx that returned a real page like a custom 404).
   */
  httpStatus: number | null;
  /**
   * Phase 0/B1 — crawl error tag for non-success outcomes. Null on
   * fully successful crawls. When this is set the UI shows a "We
   * couldn't reach the site — open it manually" hint instead of
   * silently rendering "Title: —".
   */
  crawlError: CrawlError | null;
  loadTimeMs: number | null;
  https: boolean;
  mobileFriendlyGuess: boolean;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  hasContactForm: boolean;
  hasWhatsappLink: boolean;
  hasBookingSystem: boolean;
  hasEcommerce: boolean;
  servicesDetected: string[];
  navItems: { text: string; href: string }[];
  ctaLinks: { text: string; href: string }[];
  brokenLinksCount: number;
  structuredDataPresent: boolean;

  // Extended audit fields (El Kitabi compliant)
  hasOpenGraph: boolean;
  hasTwitterCards: boolean;
  hasFavicon: boolean;
  hasManifest: boolean;
  hasServiceWorker: boolean;
  hasGoogleAnalytics: boolean;
  hasCookieConsent: boolean;
  hasResponsiveImages: boolean;
  hasFontDisplay: boolean;
  securityHeaders: SecurityHeadersResult;
  schemaTypes: string[];
  accessibilityIssues: string[];
  fontsDetected: string[];
  performanceHints: string[];
  cssFramework: string | null;
  pageCount: number;
  consoleErrors: string[];

  // Extracted contact + integrations (used for outreach export and segmentation)
  contactEmails: string[];
  bookingProvider: string | null;

  // Restaurant niche signals (populated by extractor when patterns match)
  hasQrMenu?: boolean;
  hasOnlineReservation?: boolean;
  hasDeliveryIntegration?: boolean;
  /** e.g. "FineDine" | "MenuTiger" | "Flipdish" — first matched tool name */
  detectedMenuTool?: string | null;
  menuUrl?: string | null;

  // P0.5 - expanded social profile scraping
  socialProfiles?: {
    instagram: string | null;
    facebook: string | null;
    linkedin: string | null;
    tiktok: string | null;
    youtube: string | null;
    twitter: string | null;
    whatsapp: string | null;
    pinterest: string | null;
  };
}

export interface SecurityHeadersResult {
  hasCSP: boolean;
  hasXFrameOptions: boolean;
  hasXContentTypeOptions: boolean;
  hasReferrerPolicy: boolean;
  hasHSTS: boolean;
  hasXXSSProtection: boolean;
  hasPermissionsPolicy: boolean;
}

export interface CheckResult {
  category: "seo" | "performance" | "security" | "accessibility" | "ux" | "pwa" | "form";
  item: string;
  status: "pass" | "fail" | "unknown";
  priority: "critical" | "important" | "nice_to_have";
  recommendation: string;
}

export interface AuditChecklistResult {
  seo: CheckResult[];
  performance: CheckResult[];
  security: CheckResult[];
  accessibility: CheckResult[];
  ux: CheckResult[];
  pwa: CheckResult[];
  form: CheckResult[];
  summary: {
    totalChecks: number;
    passed: number;
    failed: number;
    unknown: number;
    scorePercent: number;
  };
}

export interface GeminiAnalysis {
  opportunity_score: number;
  reason_codes: string[];
  why_good_target: string;
  likely_pain_points: string[];
  best_sales_angle: string;
  personalized_first_message: string;
  /**
   * Workspace-defined ServicePackage id the analyst chose for this
   * lead. Required when the workspace has packages configured (the
   * `lead_created` chain is now gated on at least one ServicePackage
   * row, so this field should always come back populated in the new
   * pipeline). Null is tolerated for backwards compatibility with
   * legacy single-shot analyze callers (api/analyze, analyze-worker)
   * that don't pre-load packages — those rows simply lack a package
   * recommendation. Free-text id, NOT a Prisma enum.
   */
  recommended_package_id?: string | null;
  /**
   * 1-2 sentence justification: why this tier (e.g. "Independent
   * single-location bistro - Base covers QR menu without paying for
   * Premium's multi-brand console"). Surfaced verbatim in the lead
   * detail UI so reps can quote it on the discovery call.
   */
  recommended_package_reason?: string | null;
}

export interface PlaceReview {
  authorAttribution?: {
    displayName: string;
    uri?: string;
    photoUri?: string;
  };
  rating: number;
  text?: { text: string; languageCode: string };
  relativePublishTimeDescription?: string;
  publishTime?: string;
}

export interface DashboardStats {
  totalLeads: number;
  withWebsite: number;
  withoutWebsite: number;
  averageScore: number;
  boroughDistribution: { borough: string; count: number }[];
  recentLeads: number;
}

export const LONDON_BOROUGHS = [
  { name: "City of London", lat: 51.5155, lng: -0.0922 },
  { name: "Barking and Dagenham", lat: 51.5607, lng: 0.1557 },
  { name: "Barnet", lat: 51.6252, lng: -0.1517 },
  { name: "Bexley", lat: 51.4549, lng: 0.1505 },
  { name: "Brent", lat: 51.5588, lng: -0.2817 },
  { name: "Bromley", lat: 51.4039, lng: 0.0198 },
  { name: "Camden", lat: 51.5290, lng: -0.1255 },
  { name: "Croydon", lat: 51.3762, lng: -0.0982 },
  { name: "Ealing", lat: 51.5130, lng: -0.3089 },
  { name: "Enfield", lat: 51.6538, lng: -0.0799 },
  { name: "Greenwich", lat: 51.4826, lng: 0.0077 },
  { name: "Hackney", lat: 51.5450, lng: -0.0553 },
  { name: "Hammersmith and Fulham", lat: 51.4927, lng: -0.2339 },
  { name: "Haringey", lat: 51.6000, lng: -0.1119 },
  { name: "Harrow", lat: 51.5898, lng: -0.3346 },
  { name: "Havering", lat: 51.5812, lng: 0.1837 },
  { name: "Hillingdon", lat: 51.5441, lng: -0.4760 },
  { name: "Hounslow", lat: 51.4746, lng: -0.3680 },
  { name: "Islington", lat: 51.5465, lng: -0.1058 },
  { name: "Kensington and Chelsea", lat: 51.4990, lng: -0.1938 },
  { name: "Kingston upon Thames", lat: 51.4085, lng: -0.3064 },
  { name: "Lambeth", lat: 51.4571, lng: -0.1231 },
  { name: "Lewisham", lat: 51.4415, lng: -0.0117 },
  { name: "Merton", lat: 51.4098, lng: -0.1949 },
  { name: "Newham", lat: 51.5255, lng: 0.0352 },
  { name: "Redbridge", lat: 51.5590, lng: 0.0741 },
  { name: "Richmond upon Thames", lat: 51.4613, lng: -0.3037 },
  { name: "Southwark", lat: 51.5035, lng: -0.0804 },
  { name: "Sutton", lat: 51.3618, lng: -0.1945 },
  { name: "Tower Hamlets", lat: 51.5099, lng: -0.0059 },
  { name: "Waltham Forest", lat: 51.5886, lng: -0.0118 },
  { name: "Wandsworth", lat: 51.4567, lng: -0.1910 },
  { name: "Westminster", lat: 51.4975, lng: -0.1357 },
] as const;

export const SEARCH_QUERIES = [
  "phone repair shop",
  "barber shop",
  "nail salon",
  "beauty salon",
  "car wash",
  "laundry dry cleaning",
  "tattoo studio",
  "car mechanic garage",
  "dental clinic",
  "estate agent",
  "accountant",
  "solicitor law firm",
  "restaurant",
  "cafe coffee shop",
  "gym fitness centre",
  "pet grooming",
  "florist flower shop",
  "photography studio",
  "driving school",
  "tutoring centre",
];
