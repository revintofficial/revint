import type { DemoLead } from "./types";

// Curated demo data for marketing pages. Hardcoded — no API calls.

export const HOME_LEADS: DemoLead[] = [
  {
    name: "Bella Vita Trattoria",
    city: "Brooklyn, NY",
    phone: "+1 (718) 555-0142",
    website: "bellavita-trattoria.com",
    rating: 4.7,
    reviewCount: 318,
    score: 87,
    issues: ["No mobile site", "No HTTPS", "No booking"],
    pitch:
      "Site looks like 2008. They're 4.7★ but losing reservations on mobile.",
    services: ["Online reservations", "Menu + photos", "Click-to-call"],
    signals: [
      { label: "HTTPS", status: "bad", detail: "Site served over HTTP only" },
      { label: "Mobile fit", status: "bad", detail: "Viewport not configured" },
      { label: "Booking flow", status: "bad", detail: "No booking, only a tel: link" },
      { label: "Page speed", status: "warning", detail: "5.2s on mobile 4G" },
      { label: "Last updated", status: "warning", detail: "© 2019 in footer" },
    ],
  },
  {
    name: "Marlow Coffee Co.",
    city: "Williamsburg, NY",
    phone: "+1 (718) 555-0298",
    website: null,
    rating: 4.9,
    reviewCount: 612,
    score: 94,
    issues: ["No website", "No online ordering"],
    pitch:
      "5★ café with no website, getting 200+ Instagram DMs/week asking for a menu.",
    services: ["Single-page menu", "Order ahead", "Loyalty signup"],
    signals: [
      { label: "Website", status: "bad", detail: "No site listed on Google" },
      { label: "Mobile fit", status: "bad", detail: "N/A — no website" },
      { label: "Online ordering", status: "bad", detail: "Manual DMs only" },
      { label: "Reviews", status: "good", detail: "4.9★ from 612 reviewers" },
      { label: "Posts on IG", status: "good", detail: "Active, 28k followers" },
    ],
  },
  {
    name: "Nova Dental Studio",
    city: "Queens, NY",
    phone: "+1 (347) 555-0118",
    website: "novadental-ny.com",
    rating: 4.6,
    reviewCount: 84,
    score: 72,
    issues: ["Slow load (5.2s)", "No SEO", "Outdated design"],
    pitch:
      "Practices in this zip earn $1.2M+/yr. Their site is killing 30%+ of organic search.",
    services: ["Local SEO landing", "Insurance verifier", "Online intake form"],
    signals: [
      { label: "HTTPS", status: "good", detail: "Cert valid until 2027" },
      { label: "Mobile fit", status: "warning", detail: "Touch targets too small" },
      { label: "Booking flow", status: "bad", detail: "Phone-only intake" },
      { label: "Page speed", status: "bad", detail: "5.2s LCP on 4G" },
      { label: "SEO basics", status: "bad", detail: "No meta description, 1 H1" },
    ],
  },
];

export const AGENCY_LEADS: DemoLead[] = [
  {
    name: "Hudson Smile Co.",
    city: "Manhattan, NY",
    phone: "+1 (212) 555-0148",
    website: "hudsonsmile.co",
    rating: 4.8,
    reviewCount: 211,
    score: 89,
    issues: ["No mobile fit", "No booking", "Slow load"],
    pitch:
      "$2M+ practice with a site that loses 40% of mobile traffic. Easy first call.",
    services: ["Mobile rebuild", "Online booking", "Insurance check"],
  },
  {
    name: "TriBeCa Aesthetics",
    city: "Manhattan, NY",
    phone: "+1 (212) 555-0322",
    website: "tribeca-aesthetics.com",
    rating: 4.9,
    reviewCount: 412,
    score: 81,
    issues: ["No HTTPS", "Outdated copy", "Weak SEO"],
    pitch:
      "5★ aesthetics, but their site reads like 2017. Premium audience, premium retainer.",
    services: ["Brand refresh", "Service pages", "Local SEO"],
  },
  {
    name: "Park Slope Family Dental",
    city: "Brooklyn, NY",
    phone: "+1 (718) 555-0941",
    website: "parkslopefamily-dental.com",
    rating: 4.6,
    reviewCount: 178,
    score: 74,
    issues: ["No reviews schema", "No CTA", "Form broken"],
    pitch:
      "High intent, dead form. Recover 8-12 leads a month with one fix.",
    services: ["Conversion audit", "Reviews integration", "Lead form"],
  },
];

export const SPECIALIST_LEADS: DemoLead[] = [
  {
    name: "Atelier Lumen",
    city: "Berlin, DE",
    phone: "+49 30 5550 1142",
    website: "atelier-lumen.de",
    rating: 4.8,
    reviewCount: 264,
    score: 86,
    issues: ["No abandoned cart", "No SMS flow", "Plain welcome"],
    pitch:
      "Premium Shopify store, Klaviyo on the free plan. The flows aren't built.",
    services: ["Welcome series", "Browse abandon", "Win-back flow"],
  },
  {
    name: "Färgbar",
    city: "Stockholm, SE",
    phone: "+46 8 555 0193",
    website: "fargbar.se",
    rating: 4.9,
    reviewCount: 521,
    score: 91,
    issues: ["Weak segmentation", "Generic newsletter", "No A/B"],
    pitch:
      "5★ DTC paint brand, 80k subscribers, one weekly batch. Big revenue lift sitting there.",
    services: ["Segmentation audit", "RFM flows", "Test calendar"],
  },
  {
    name: "North Roast Co.",
    city: "Amsterdam, NL",
    phone: "+31 20 555 0244",
    website: "northroast.coffee",
    rating: 4.7,
    reviewCount: 188,
    score: 78,
    issues: ["Subscription churn", "No win-back", "Plain receipts"],
    pitch:
      "Subscription coffee, 22% monthly churn. A win-back flow alone pays for the retainer.",
    services: ["Subscription save", "Win-back", "Receipt redesign"],
  },
];

export const SMMA_LEADS: DemoLead[] = [
  {
    name: "QuickFix Phone Repair",
    city: "Manchester, UK",
    phone: "+44 161 555 0142",
    website: "quickfixmcr.co.uk",
    rating: 4.7,
    reviewCount: 421,
    score: 88,
    issues: ["No same-day badge", "No quote form", "Slow load"],
    pitch:
      "421 reviews, no quote form on the site. Walk-ins only — easy upsell to web bookings.",
    services: ["Quote form", "Same-day badge", "Reviews proof"],
  },
  {
    name: "SnapRepair Hub",
    city: "Manchester, UK",
    phone: "+44 161 555 0298",
    website: null,
    rating: 4.9,
    reviewCount: 156,
    score: 92,
    issues: ["No website", "Inquiries via DM", "No price list"],
    pitch:
      "Five stars, no site, takes inquiries on Insta. Built-for-them landing page.",
    services: ["One-page site", "Price calculator", "WhatsApp link"],
  },
  {
    name: "Mobile Medic MCR",
    city: "Salford, UK",
    phone: "+44 161 555 0418",
    website: "mobilemedic-mcr.co.uk",
    rating: 4.5,
    reviewCount: 92,
    score: 76,
    issues: ["No reviews", "No service pages", "No GBP link"],
    pitch:
      "Mobile repair van, no service pages on the site. Easy local SEO win.",
    services: ["Service pages", "Reviews import", "GBP link"],
  },
];

export const HOME_CITIES = ["Brooklyn, NY", "London E14", "London / Hackney"];
export const HOME_NICHES = ["Italian restaurants", "Cafés", "Dental"];

export const AGENCY_CITIES = ["Manhattan, NY", "Brooklyn, NY", "Queens, NY"];
export const AGENCY_NICHES = ["Dental practices", "Aesthetics", "Med spas"];

export const SPECIALIST_CITIES = ["Berlin, DE", "Stockholm, SE", "Amsterdam, NL"];
export const SPECIALIST_NICHES = ["Shopify DTC", "Subscription brands", "Beauty"];

export const SMMA_CITIES = ["Manchester, UK", "Salford, UK", "Liverpool, UK"];
export const SMMA_NICHES = ["Phone repair", "Barbershops", "Auto detailing"];
