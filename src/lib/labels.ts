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

// Per-stage dot color (kept inline so consumers don't need to import a
// design-token util just to render a 6×6 dot).
export const PIPELINE_STAGE_DOT: Record<string, string> = {
  NEW: "hsl(220 8% 70%)",
  REACHED_OUT: "hsl(38 70% 52%)",
  IN_TALKS: "hsl(248 62% 60%)",
  WON: "hsl(152 48% 50%)",
  LOST: "hsl(4 62% 54%)",
};
