export interface PlaceResult {
  id: string;
  displayName?: { text: string; languageCode: string };
  formattedAddress?: string;
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
  locationBias?: {
    circle: {
      center: { latitude: number; longitude: number };
      radius: number;
    };
  };
}

export interface WebsiteFeatures {
  url: string;
  reachable: boolean;
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
  suggested_offer: "starter" | "growth" | "sales";
  personalized_first_message: string;
  expected_price_band: string;
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
