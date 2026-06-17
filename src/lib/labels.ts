export const OUTREACH_LABELS: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  INTERESTED: "Interested",
  MEETING: "Meeting Scheduled",
  WON: "Won",
  LOST: "Lost",
};

export const CRAWL_LABELS: Record<string, string> = {
  PENDING: "Queued",
  CRAWLING: "Scanning…",
  CRAWLED: "Scanned",
  FAILED: "Scan Failed",
  NO_WEBSITE: "No Website",
};

export const ANALYZE_LABELS: Record<string, string> = {
  PENDING: "Queued",
  ANALYZING: "Analyzing…",
  ANALYZED: "Analyzed",
  FAILED: "Analysis Failed",
};

export const REVIEW_ANALYSIS_LABELS: Record<string, string> = {
  PENDING: "Review IQ queued",
  ANALYZING: "Review IQ running…",
  ANALYZED: "Review IQ done",
  FAILED: "Review IQ failed",
  NO_REVIEWS: "No reviews to analyze",
};

/** Lead row `pipelineStatus` — gates `lead_created`, not kanban stage. */
export const LEAD_PIPELINE_GATE_LABELS: Record<string, string> = {
  OK: "Intake OK",
  BLOCKED_NEEDS_PACKAGES: "Blocked — add packages",
};

export const OFFER_LABELS: Record<string, string> = {
  STARTER: "Starter",
  GROWTH: "Growth",
  SALES: "Sales",
};

export const MEETING_LABELS: Record<string, string> = {
  POSITIVE: "Positive",
  NEGATIVE: "Negative",
  IN_PROGRESS: "In Progress",
};

export const REASON_LABELS: Record<string, string> = {
  no_website: "No Website",
  poor_mobile: "Not Mobile-Friendly",
  no_booking: "No Booking System",
  no_whatsapp: "No WhatsApp",
  no_https: "No HTTPS",
  weak_seo: "Weak SEO",
  slow_site: "Slow Website",
  no_ecommerce: "No E-commerce",
  high_rating_weak_site: "High Rating, Weak Site",
  good_rating: "Good Rating",
  site_unreachable: "Site Unreachable",
  services_unclear: "Services Unclear",
  uncrawled_website: "Site Not Scanned",
  no_contact_form: "No Contact Form",
  no_analytics: "No Analytics",
  weak_security_headers: "Weak Security",
  no_open_graph: "No Open Graph",
  no_structured_data: "No Structured Data",
  accessibility_issues: "Accessibility Issues",
  no_pwa: "No PWA",
};

// Compact chip labels: shorter, all-lowercase phrases used inside the
// leads list reason chips where horizontal real estate is tight. We
// prefer shipped REASON_LABELS for tooltips / detail pages and use
// REASON_CODE_LABELS for in-row pills only.
export const REASON_CODE_LABELS: Record<string, string> = {
  no_website: "no site",
  poor_mobile: "not mobile",
  no_booking: "no booking",
  no_whatsapp: "no whatsapp",
  no_https: "no https",
  weak_seo: "weak seo",
  slow_site: "slow",
  slow_load: "slow",
  no_ecommerce: "no ecom",
  high_rating_weak_site: "rating ↑ site ↓",
  good_rating: "rating ↑",
  site_unreachable: "unreachable",
  services_unclear: "unclear svcs",
  uncrawled_website: "unscanned",
  no_contact_form: "no form",
  no_analytics: "no analytics",
  weak_security_headers: "weak sec",
  no_open_graph: "no og",
  no_schema: "no schema",
  no_structured_data: "no schema",
  accessibility_issues: "a11y",
  no_pwa: "no pwa",
  low_rating_trend: "rating ↓",
};

export const PIPELINE_STAGE_LABELS: Record<string, string> = {
  NEW: "New",
  REACHED_OUT: "Reached Out",
  IN_TALKS: "In Talks",
  WON: "Won",
  LOST: "Lost",
};

// Round 2 §3.3 — Google Places `primaryType` is a snake_case enum
// (`coffee_shop`, `food_store`, `acai_shop`, …) that we used to render
// raw. Override map carries the niche-aware corrections for known
// misclassifications (Round 2 evidence: Black Sheep `food_store`, YBA
// Brazil `acai_shop`); everything else flows through a generic
// title-case fallback. Long-term this lives in `niches/index.ts`
// classifierHints (rapor §6 OQ.16) but the override map keeps the P0
// fix self-contained.
const PRIMARY_TYPE_DISPLAY_OVERRIDE: Record<string, string> = {
  food_store: "Coffee Shop / Chain",
  acai_shop: "Açaí & Coffee Shop",
};

export function humanizePrimaryType(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") return "—";
  const trimmed = raw.trim();
  if (!trimmed) return "—";
  if (PRIMARY_TYPE_DISPLAY_OVERRIDE[trimmed]) {
    return PRIMARY_TYPE_DISPLAY_OVERRIDE[trimmed];
  }
  return trimmed
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Round 2 §3.9 — defense-in-depth UI mask for stale audits whose
// `metaDescription` ended up holding a social platform's global login
// copy (e.g. Instagram's "Create an account or log in to Instagram —
// share what you're into …"). The Round 1 social-url-gate fix sets
// `metaDescription: null` for new social-only audits, but legacy rows
// stay until the backfill (P0.8) re-crawls them. This mask hides the
// junk text immediately while the backfill drains.
const SOCIAL_PLATFORM_DEFAULT_META_PATTERNS: RegExp[] = [
  /^create an account or log in to instagram/i,
  /^create an account or log in to facebook/i,
  /^log in to (instagram|facebook|tiktok|x|twitter|linkedin)\b/i,
  // Round 2 smoke-test caught: Facebook's actual default copy uses
  // "Log into Facebook" (one word, no space). Without this pattern the
  // mask leaks the generic "Log into Facebook to start sharing..."
  // string into the audit panel for every legacy social-only row.
  /^log into (instagram|facebook|tiktok|x|twitter|linkedin)\b/i,
  /^see posts, photos and more on facebook$/i,
  /share what you[''’]re into with the people who get you/i,
];

export function isSocialPlatformDefaultMeta(
  value: string | null | undefined,
): boolean {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return SOCIAL_PLATFORM_DEFAULT_META_PATTERNS.some((re) => re.test(trimmed));
}

// Round 2 §3.2 — `wedges` (deterministic audit signals) and
// `reasonCodes` (Gemini scorer output) frequently produce the same
// human-meaning under different keys (`"No WhatsApp"` vs `"no_whatsapp"`),
// so the strip rendered the badge twice. Normalize both sources to the
// same shape and dedupe across them. Lives here (instead of inline in
// `page.tsx`) so the Sprint 1 smoke-test runner and any future hero-strip
// surface can call the same shaping function.
export function normalizeWedgeKey(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Round 2 §3.2 / OQ.4 — when the audit confirms there is no website,
// Gemini still tends to emit "rating ↑ site ↓" / "weak SEO" / "poor
// mobile" / "site unreachable" reason codes that contradict the
// no-website signal. Suppress those when the deterministic source
// already says "No Website" so the strip stays internally consistent.
export const SUPPRESS_WHEN_NO_WEBSITE: Set<string> = new Set([
  "high_rating_weak_site",
  "weak_seo",
  "poor_mobile",
  "site_unreachable",
]);

// Per-stage dot color. Derived from the theme tokens so re-skinning the
// primary hue shifts the mid-pipeline dot too; semantic colors (success /
// warning / error) come from --revint-{success,warning,error}.
export const PIPELINE_STAGE_DOT: Record<string, string> = {
  NEW: "var(--revint-muted)",
  REACHED_OUT: "var(--revint-warning)",
  IN_TALKS: "var(--revint-400)",
  WON: "var(--revint-success)",
  LOST: "var(--revint-error)",
};
