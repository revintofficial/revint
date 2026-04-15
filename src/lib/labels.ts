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
