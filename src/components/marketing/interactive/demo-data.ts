import type { DemoLead } from "./types";

// Curated demo data for marketing pages. Hardcoded — no API calls.

export const HOME_LEADS: DemoLead[] = [
  {
    name: "Bella Vita Trattoria",
    niche: "Italian restaurant",
    city: "Brooklyn, NY",
    phone: "+1 (718) 555-0142",
    website: "bellavita-trattoria.com",
    rating: 4.7,
    reviewCount: 318,
    score: 87,
    issues: ["No HTTPS", "No mobile site", "No online booking"],
    pitch:
      "4.7★ trattoria with a 2009-era site. Losing weekend reservations on mobile.",
    services: ["Online reservations", "Menu + photos", "Click-to-call hero"],
    reviewQuote:
      "Best carbonara in the borough — but their website wouldn't even load on my phone.",
    signals: [
      { label: "HTTPS", status: "bad", detail: "Served over HTTP only · no SSL cert" },
      { label: "Mobile viewport", status: "bad", detail: "No responsive meta tag · 360px renders broken" },
      { label: "Online booking", status: "bad", detail: "No reservation system · tel: link only" },
      { label: "Page speed", status: "warning", detail: "5.2s LCP on simulated 4G · 2.1MB unoptimized images" },
      { label: "Last updated", status: "warning", detail: "© 2019 in footer · WordPress 5.4 (EOL)" },
      { label: "Schema markup", status: "bad", detail: "No Restaurant or LocalBusiness JSON-LD" },
    ],
  },
  {
    name: "Marlow Coffee Co.",
    niche: "Specialty café",
    city: "Williamsburg, NY",
    phone: "+1 (718) 555-0298",
    website: null,
    rating: 4.9,
    reviewCount: 612,
    score: 94,
    issues: ["No website at all", "DMs-only ordering"],
    pitch:
      "4.9★ café with no website. 28k IG followers asking for the menu in DMs.",
    services: ["One-page menu site", "Order-ahead form", "Loyalty signup"],
    reviewQuote:
      "Their oat flat white is unreal. Wish I could see the hours without DMing them.",
    signals: [
      { label: "Website", status: "bad", detail: "No site listed on Google Business Profile" },
      { label: "Mobile presence", status: "bad", detail: "Instagram only · no fallback URL" },
      { label: "Online ordering", status: "bad", detail: "Manual via DM · 200+/week per their last reel" },
      { label: "Google reviews", status: "good", detail: "4.9★ from 612 reviewers · 18 in last 30d" },
      { label: "Social cadence", status: "good", detail: "Active IG · 28.4k followers · daily posts" },
      { label: "GBP completeness", status: "warning", detail: "No menu link · no hours on holidays" },
    ],
  },
  {
    name: "Nova Dental Studio",
    niche: "Dental practice",
    city: "Queens, NY",
    phone: "+1 (347) 555-0118",
    website: "novadental-ny.com",
    rating: 4.6,
    reviewCount: 84,
    score: 72,
    issues: ["Slow load · 5.2s", "Phone-only intake", "Thin SEO"],
    pitch:
      "Practices in this zip clear $1.2M/yr. Their site leaks 30%+ of organic search.",
    services: ["Local SEO landing", "Insurance verifier", "Online intake form"],
    reviewQuote:
      "Dr. Patel is amazing. Their booking system is 'leave a voicemail and we'll call back'.",
    signals: [
      { label: "HTTPS", status: "good", detail: "Valid Let's Encrypt cert · auto-renewing" },
      { label: "Mobile viewport", status: "warning", detail: "Responsive but tap targets <44px" },
      { label: "Online booking", status: "bad", detail: "Phone-only intake · no calendar widget" },
      { label: "Page speed", status: "bad", detail: "5.2s LCP · 12 render-blocking scripts" },
      { label: "SEO basics", status: "bad", detail: "No meta description · 1 H1 across whole site" },
      { label: "Reviews surfaced", status: "warning", detail: "Hidden behind footer link · no schema" },
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

export const HOME_CITIES = ["Brooklyn, NY", "Queens, NY", "Manhattan, NY"];
export const HOME_NICHES = ["Restaurants & F&B", "Cafés & bakeries", "Dental practices"];

export const AGENCY_CITIES = ["Manhattan, NY", "Brooklyn, NY", "Queens, NY"];
export const AGENCY_NICHES = ["Dental practices", "Aesthetics", "Med spas"];

export const SPECIALIST_CITIES = ["Berlin, DE", "Stockholm, SE", "Amsterdam, NL"];
export const SPECIALIST_NICHES = ["Shopify DTC", "Subscription brands", "Beauty"];

export const SMMA_CITIES = ["Manchester, UK", "Salford, UK", "Liverpool, UK"];
export const SMMA_NICHES = ["Phone repair", "Barbershops", "Auto detailing"];
