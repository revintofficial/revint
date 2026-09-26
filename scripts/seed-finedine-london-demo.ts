/**
 * Curated London demo leads for the FineDine beta workspace.
 *
 * Replaces every lead in the workspace owned by finedine-owner@leadac.beta
 * with a small set of real restaurants. Facts below were checked against
 * each venue's own site in September 2026. Ratings and review counts are
 * deliberately omitted — they go stale and a wrong number on a shared
 * screen is worse than a blank. The angle the Action Sheet shows is
 * computed by `pickAngle` from the audit flags, not from the copy here.
 *
 * Usage:
 *   npx tsx scripts/seed-finedine-london-demo.ts
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { gatherEvidence, type DemoPage, type DemoReview } from "./finedine-demo-evidence";

const SKIP_GOOGLE_PHONE = new Set(["demo-padella-soho", "demo-flat-iron-covent-garden"]);

const OWNER_EMAIL = "finedine-owner@leadac.beta";
const SEED_TAG = "finedine-demo-seed";

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000);

interface DemoLead {
  placeId: string;
  businessName: string;
  formattedAddress: string;
  borough: string;
  phone: string | null;
  websiteUrl: string;
  googleMapsQuery: string;
  priceLevel: number;
  /** Rounded public figures. Re-check Google before quoting them in the room. */
  rating: number | null;
  reviewCount: number | null;
  primaryType: string;
  subNicheSlug: string;
  account: { name: string; apexDomain: string; locationsCount: number } | null;
  stage: string;
  temperature: "HOT" | "WARM" | "COLD";
  inboundHoursAgo: number;
  lastContactedHoursAgo: number | null;
  lastDisposition: "NO_ANSWER" | "ANSWERED_INTERESTED" | "BOOKED_MEETING" | null;
  salesConfidence: number;
  audit: {
    hasBookingSystem: boolean;
    bookingProvider: string | null;
    hasEcommerce: boolean;
    hasOnlineReservation?: boolean;
    hasQrMenu?: boolean;
    hasDeliveryIntegration?: boolean;
    hasContactForm?: boolean;
    menuUrl?: string | null;
    detectedMenuTool?: string | null;
  };
  emails?: string[];
  /** Which workspace service package this lead should show. */
  packageName: "Single site" | "Guest CRM" | "Multi-location";
  why: string;
  pains: string[];
  bestAngle: string;
  hook: string;
  doNotPitch: string[];
  calls: { hoursAgo: number; disposition: "NO_ANSWER" | "VOICEMAIL" | "ANSWERED_INTERESTED" | "BOOKED_MEETING" }[];
  qualification: Record<string, boolean> | null;
}

const LEADS: DemoLead[] = [
  {
    placeId: "demo-padella-soho",
    businessName: "Padella Soho",
    formattedAddress: "2 Kingly Street, London W1B 5PB",
    borough: "Soho",
    phone: null,
    websiteUrl: "https://www.padella.co/soho/",
    googleMapsQuery: "Padella Soho 2 Kingly Street London",
    priceLevel: 2,
    rating: null,
    reviewCount: null,
    primaryType: "italian_restaurant",
    subNicheSlug: "fnb-casual-dining",
    account: { name: "Padella", apexDomain: "padella.co", locationsCount: 3 },
    stage: "new_inbound",
    temperature: "HOT",
    inboundHoursAgo: 0.7,
    lastContactedHoursAgo: null,
    lastDisposition: null,
    salesConfidence: 84,
    audit: {
      hasBookingSystem: true,
      bookingProvider: "Padella direct (up to 4 weeks ahead)",
      hasEcommerce: false,
      hasOnlineReservation: true,
      menuUrl: "https://www.padella.co/soho/",
    },
    why: "Three live sites (Soho, Borough Market, Shoreditch) with a pasta menu that changes by the day. Soho and Shoreditch take reservations; groups of 7+ are a set menu booked by email. Borough does not take reservations — it runs a Dojo virtual queue from a door QR.",
    pains: [
      "The menu is rewritten per site and per day, so a PDF or a static page drifts immediately.",
      "Group bookings (7–29 covers) are still an email thread, not a system.",
      "Borough's queue and the other sites' reservation books are different products.",
    ],
    bestAngle: "Multi-location",
    packageName: "Multi-location",
    hook: "You've got three rooms and a menu that changes daily — Borough is a Dojo queue, Soho and Shoreditch are real bookings, and groups of seven still go through email. Worth 15 minutes on one menu and one book across the group?",
    doNotPitch: [
      "A basic QR menu. Borough already queues on a door QR via Dojo, and the menu is already live HTML.",
      "Order & Pay. The product is the pasta and the queue, not table-side checkout.",
    ],
    calls: [],
    qualification: null,
  },
  {
    placeId: "demo-honest-burgers-dalston",
    businessName: "Honest Burgers Dalston",
    formattedAddress: "14-16 Bradbury Street, London N16 8JN",
    borough: "Dalston",
    phone: "+442035976260",
    websiteUrl: "https://www.honestburgers.co.uk/locations/dalston/",
    googleMapsQuery: "Honest Burgers Dalston 14-16 Bradbury Street",
    priceLevel: 2,
    rating: null,
    reviewCount: null,
    primaryType: "hamburger_restaurant",
    subNicheSlug: "fnb-casual-dining",
    account: { name: "Honest Burgers", apexDomain: "honestburgers.co.uk", locationsCount: 40 },
    stage: "attempting",
    temperature: "WARM",
    inboundHoursAgo: 30,
    lastContactedHoursAgo: 6,
    lastDisposition: "NO_ANSWER",
    salesConfidence: 58,
    audit: {
      hasBookingSystem: true,
      bookingProvider: "Honest Burgers booking",
      hasEcommerce: true,
      hasOnlineReservation: true,
      hasDeliveryIntegration: true,
      hasQrMenu: false,
      menuUrl: "https://www.honestburgers.co.uk/menus/",
      detectedMenuTool: "Own site + location PDF",
    },
    why: "National burger group. Dalston already does click & collect, Uber Eats, and (at several London sites) Deliveroo. They publish a shared menu plus per-site PDFs, and they run Honest Rewards.",
    pains: [
      "The PDF explicitly says not every burger is at every restaurant — the menu is already fragmenting by site.",
      "Delivery is split across Uber Eats and a partial Deliveroo return, not one order book.",
    ],
    bestAngle: "Multi-location",
    packageName: "Multi-location",
    hook: "Dalston already takes bookings and does click & collect — I'm not calling to sell you a QR menu. The crack is the menu: your own PDF says items differ by restaurant. That's the 15 minutes.",
    doNotPitch: [
      "A new QR menu or Order & Pay build. Click & collect, Uber Eats and a loyalty stamp card are already live.",
      "A from-scratch reservation product. This site already says booking is available.",
    ],
    calls: [
      { hoursAgo: 26, disposition: "NO_ANSWER" },
      { hoursAgo: 6, disposition: "NO_ANSWER" },
    ],
    qualification: null,
  },
  {
    placeId: "demo-the-wolseley",
    businessName: "The Wolseley",
    formattedAddress: "160 Piccadilly, London W1J 9EB",
    borough: "Mayfair",
    phone: "+442074996996",
    websiteUrl: "https://www.thewolseleypiccadilly.com/",
    googleMapsQuery: "The Wolseley 160 Piccadilly London",
    priceLevel: 3,
    rating: 4.4,
    reviewCount: 3500,
    primaryType: "restaurant",
    subNicheSlug: "fnb-fine-dining",
    account: null,
    stage: "qualified",
    temperature: "HOT",
    inboundHoursAgo: 20,
    lastContactedHoursAgo: 5,
    lastDisposition: "ANSWERED_INTERESTED",
    salesConfidence: 76,
    audit: {
      hasBookingSystem: true,
      bookingProvider: "Own reservations (card guarantee, no-show fee)",
      hasEcommerce: false,
      hasOnlineReservation: true,
      menuUrl: "https://www.thewolseleypiccadilly.com/menu/dinner/",
    },
    why: "Single landmark café-restaurant on Piccadilly. All-day service from 7am, reservations on their own site, and a no-show fee (£15 breakfast/tea, £25 lunch/dinner) because people don't turn up. The menu is a full HTML carte, not a PDF.",
    pains: [
      "No-shows are already expensive enough that they take a card to hold the table.",
      "Breakfast regulars and one-off tourists sit in the same book, with no owned guest record after the visit.",
    ],
    bestAngle: "CRM / Loyalty",
    packageName: "Guest CRM",
    hook: "You're already charging for no-shows, so the book isn't the problem. The gap is the morning regular who comes three times a week and you still don't have them anywhere except the reservation name.",
    doNotPitch: [
      "Order & Pay or a QR menu. Service is the product — self-ordering would cheapen the room.",
      "A new reservation system. They already book online, take a card, and publish the fee.",
    ],
    calls: [{ hoursAgo: 5, disposition: "ANSWERED_INTERESTED" }],
    qualification: {
      decision_maker: true,
      need: true,
      timing: true,
      budget: false,
      next_step: true,
      demo_interest: true,
      info_only: false,
    },
  },
  {
    placeId: "demo-flat-iron-covent-garden",
    businessName: "Flat Iron Covent Garden",
    formattedAddress: "17-18 Henrietta Street, London WC2E 8QH",
    borough: "Covent Garden",
    phone: null,
    websiteUrl: "https://flatironsteak.co.uk/restaurant/covent-garden/",
    googleMapsQuery: "Flat Iron Covent Garden 17-18 Henrietta Street",
    priceLevel: 2,
    rating: null,
    reviewCount: null,
    primaryType: "steak_house",
    subNicheSlug: "fnb-casual-dining",
    account: { name: "Flat Iron", apexDomain: "flatironsteak.co.uk", locationsCount: 24 },
    stage: "connected",
    temperature: "WARM",
    inboundHoursAgo: 10,
    lastContactedHoursAgo: 3,
    lastDisposition: "ANSWERED_INTERESTED",
    salesConfidence: 70,
    audit: {
      hasBookingSystem: true,
      bookingProvider: "Flat Iron website booking",
      hasEcommerce: false,
      hasOnlineReservation: true,
      hasContactForm: true,
      menuUrl: "https://flatironsteak.co.uk/restaurant/covent-garden/",
    },
    why: "Twenty-plus steak restaurants, London and out. Covent Garden books online and still holds most of the room for walk-ins; if they're full they take a name and text you. Their own FAQ says the restaurants cannot be reached by phone — contact is the website form or the booking email.",
    pains: [
      "No phone into the site. A rep who dials a directory number is calling a dead end.",
      "Walk-in text list and the online book are two queues for the same room.",
      "Menu and butchery specials change by site (Covent Garden has an in-house butchery the others don't).",
    ],
    bestAngle: "Multi-location",
    packageName: "Multi-location",
    hook: "I won't call the restaurant — your FAQ says none of the sites pick up. The useful conversation is one book across 20 rooms, where Covent Garden's walk-in text list and the website reservations are still separate.",
    doNotPitch: [
      "A phone-first reservation pitch. They have told guests the restaurants cannot be reached by phone.",
      "Order & Pay. Steak service is the format; the operational mess is the two queues, not the bill.",
    ],
    calls: [{ hoursAgo: 3, disposition: "ANSWERED_INTERESTED" }],
    qualification: {
      decision_maker: false,
      need: true,
      timing: true,
      budget: false,
      next_step: false,
      demo_interest: true,
      info_only: false,
    },
  },
  {
    placeId: "demo-andrew-edmunds",
    businessName: "Andrew Edmunds",
    formattedAddress: "46 Lexington Street, London W1F 0LP",
    borough: "Soho",
    phone: "+442074375708",
    websiteUrl: "https://www.andrewedmunds.com/",
    googleMapsQuery: "Andrew Edmunds 46 Lexington Street Soho",
    priceLevel: 3,
    rating: 4.5,
    reviewCount: 1800,
    primaryType: "restaurant",
    subNicheSlug: "fnb-fine-dining",
    account: null,
    stage: "meeting_booked",
    temperature: "WARM",
    inboundHoursAgo: 120,
    lastContactedHoursAgo: 26,
    lastDisposition: "BOOKED_MEETING",
    salesConfidence: 61,
    audit: {
      hasBookingSystem: true,
      bookingProvider: "Own site + phone line (10:00–18:00 weekdays)",
      hasEcommerce: false,
      hasOnlineReservation: true,
      menuUrl: "https://www.andrewedmunds.com/",
    },
    why: "Single Soho dining room. Bookings open 90 days out for lunch and 30 for dinner, online or on 020 7437 5708, and they still call on the day to reconfirm. One room, one book, a phone line with office hours.",
    pains: [
      "The reservation line is only open 10:00–18:00 on weekdays, so evening intent has nowhere to go but the website.",
      "They already reconfirm by phone on the day — a second reservation product would duplicate that.",
    ],
    bestAngle: "CRM / Loyalty",
    packageName: "Guest CRM",
    hook: "Demo is already in the diary. Don't reopen the reservation question — they book online, they have a phone line, and they reconfirm on the day. The only new thing worth showing is what happens to the guest after they leave.",
    doNotPitch: [
      "A reservation system. Online booking and a staffed phone line are both live, plus a same-day reconfirmation call.",
      "QR menus or Order & Pay. It's a small Soho dining room; the format is the waiter.",
    ],
    calls: [
      { hoursAgo: 96, disposition: "VOICEMAIL" },
      { hoursAgo: 48, disposition: "ANSWERED_INTERESTED" },
      { hoursAgo: 26, disposition: "BOOKED_MEETING" },
    ],
    qualification: {
      decision_maker: true,
      need: true,
      timing: true,
      budget: true,
      next_step: true,
      demo_interest: true,
      info_only: false,
    },
  },
  {
    placeId: "demo-dishoom-covent-garden",
    businessName: "Dishoom Covent Garden",
    formattedAddress: "12 Upper St Martin's Lane, London WC2H 9FB",
    borough: "Covent Garden",
    phone: "+442074209320",
    websiteUrl: "https://www.dishoom.com/covent-garden/",
    googleMapsQuery: "Dishoom Covent Garden 12 Upper St Martin's Lane",
    priceLevel: 2,
    rating: null,
    reviewCount: null,
    primaryType: "indian_restaurant",
    subNicheSlug: "fnb-casual-dining",
    account: { name: "Dishoom", apexDomain: "dishoom.com", locationsCount: 10 },
    stage: "new_inbound",
    temperature: "HOT",
    inboundHoursAgo: 3,
    lastContactedHoursAgo: null,
    lastDisposition: null,
    salesConfidence: 81,
    audit: {
      hasBookingSystem: true,
      bookingProvider: "Dishoom reservations (daytime any size; after 6pm groups of 6+)",
      hasEcommerce: false,
      hasOnlineReservation: true,
      menuUrl: "https://www.dishoom.com/covent-garden/",
    },
    why: "A group of cafés. Covent Garden keeps most tables for walk-ins. Bookings are open online up to four months ahead: any party size before 6pm, groups of six or more after 6pm, and 16+ goes to the café directly. A deposit is taken against the bill and refunded if they cancel 24 hours out.",
    pains: [
      "The evening book and the walk-in floor are two different products in the same room.",
      "Parties of 16 and up still leave the website and contact the café.",
      "The same rules are not identical at every café (Manchester and Birmingham keep all-size bookings after 6pm).",
    ],
    bestAngle: "Multi-location",
    packageName: "Multi-location",
    hook: "You're not short of a booking link — daytime is open, and after six it's groups of six. The crack is the 16-cover enquiry that still leaves the site, and a rule that isn't the same café to café. That's the 15 minutes.",
    doNotPitch: [
      "A basic reservation widget. They already book online, four months out, with a deposit.",
      "Order & Pay. The queue and the room are the product; most tables are held for walk-ins.",
    ],
    calls: [],
    qualification: null,
  },
  {
    placeId: "demo-pizza-pilgrims-soho",
    businessName: "Pizza Pilgrims Soho",
    formattedAddress: "11 Dean Street, London W1D 3RP",
    borough: "Soho",
    phone: "+442072878964",
    websiteUrl: "https://www.pizzapilgrims.co.uk/pizzerias/soho/",
    googleMapsQuery: "Pizza Pilgrims 11 Dean Street Soho",
    priceLevel: 2,
    rating: null,
    reviewCount: null,
    primaryType: "pizza_restaurant",
    subNicheSlug: "fnb-casual-dining",
    account: { name: "Pizza Pilgrims", apexDomain: "pizzapilgrims.co.uk", locationsCount: 15 },
    stage: "attempting",
    temperature: "WARM",
    inboundHoursAgo: 18,
    lastContactedHoursAgo: 4,
    lastDisposition: "NO_ANSWER",
    salesConfidence: 64,
    audit: {
      hasBookingSystem: true,
      bookingProvider: "Pizza Pilgrims bookings",
      hasEcommerce: true,
      hasOnlineReservation: true,
      hasDeliveryIntegration: false,
      menuUrl: "https://www.pizzapilgrims.co.uk/",
      hasContactForm: true,
    },
    emails: ["bookings@pizzapilgrims.co.uk"],
    why: "Neapolitan pizza group, Dean Street plus pizzerias and events across the UK. The site says walk-ins can just turn up, and groups of 8+ are a separate feasting menu from £25 a head, not a normal table book. Dough is made fresh daily, so the menu is not a static PDF.",
    pains: [
      "A table for four and a birthday for eight are different products, and only one of them is a booking widget.",
      "Events, classes and catering sit next to the pizzeria book.",
    ],
    bestAngle: "Multi-location",
    packageName: "Multi-location",
    hook: "Dean Street already takes a booking and still tells people to walk in. I'm not calling about a QR menu. Groups of eight are on a feasting menu, and that menu has to stay the same shape in every city you open.",
    doNotPitch: [
      "A from-scratch reservation product. Bookings are already on pizzapilgrims.co.uk.",
      "A single-site QR menu. The dough and the feasting menus are a group problem.",
    ],
    calls: [
      { hoursAgo: 16, disposition: "NO_ANSWER" },
      { hoursAgo: 4, disposition: "NO_ANSWER" },
    ],
    qualification: null,
  },
  {
    placeId: "demo-hawksmoor-seven-dials",
    businessName: "Hawksmoor Seven Dials",
    formattedAddress: "11 Langley Street, London WC2H 9JG",
    borough: "Covent Garden",
    phone: "+442074209390",
    websiteUrl: "https://thehawksmoor.com/locations/seven-dials/",
    googleMapsQuery: "Hawksmoor Seven Dials 11 Langley Street",
    priceLevel: 3,
    rating: null,
    reviewCount: null,
    primaryType: "steak_house",
    subNicheSlug: "fnb-fine-dining",
    account: { name: "Hawksmoor", apexDomain: "thehawksmoor.com", locationsCount: 8 },
    stage: "qualified",
    temperature: "HOT",
    inboundHoursAgo: 14,
    lastContactedHoursAgo: 2,
    lastDisposition: "ANSWERED_INTERESTED",
    salesConfidence: 73,
    audit: {
      hasBookingSystem: true,
      bookingProvider: "Hawksmoor book-a-table (under 15 instant; 15+ events team)",
      hasEcommerce: false,
      hasOnlineReservation: true,
      hasContactForm: true,
      menuUrl: "https://thehawksmoor.com/locations/seven-dials/",
    },
    emails: ["sevendials@thehawksmoor.com"],
    why: "Steak group. Seven Dials publishes a direct line and sevendials@thehawksmoor.com. Parties under 15 get an instant confirmation on their own book-a-table page; parties over 15 are handed to an events team and a private-dining form. Allergens have to be declared on the booking.",
    pains: [
      "The under-15 book and the events team are two systems for one group.",
      "A guest who eats at Seven Dials on Tuesday and Borough on Friday is not one record.",
    ],
    bestAngle: "Multi-location",
    packageName: "Multi-location",
    hook: "You already confirm parties under 15 on the site, and 15-plus goes to events. Don't show them another reservation tool. Show them one guest across Seven Dials and the other rooms.",
    doNotPitch: [
      "A new reservation system. Instant confirmation for under 15 is already live, and the restaurant phone is published.",
      "Order & Pay or a QR menu. This is a steakhouse; the bill is part of the service.",
    ],
    calls: [{ hoursAgo: 2, disposition: "ANSWERED_INTERESTED" }],
    qualification: {
      decision_maker: true,
      need: true,
      timing: true,
      budget: false,
      next_step: true,
      demo_interest: true,
      info_only: false,
    },
  },
];

const EMPTY_SECURITY = {
  hasCSP: false,
  hasXFrameOptions: false,
  hasXContentTypeOptions: false,
  hasReferrerPolicy: false,
  hasHSTS: false,
  hasXXSSProtection: false,
  hasPermissionsPolicy: false,
};

function buildFeatures(lead: DemoLead, page: DemoPage | null): Prisma.InputJsonObject {
  return {
    url: lead.websiteUrl,
    reachable: true,
    httpStatus: page?.httpStatus ?? 200,
    crawlError: null,
    loadTimeMs: null,
    https: page?.https ?? true,
    mobileFriendlyGuess: true,
    title: page?.title || lead.businessName,
    metaDescription: page?.metaDescription ?? null,
    h1: page?.h1 || lead.businessName,
    hasWhatsappLink: page?.hasWhatsapp ?? false,
    hasContactForm: lead.audit.hasContactForm ?? page?.hasContactForm ?? false,
    hasBookingSystem: lead.audit.hasBookingSystem,
    hasEcommerce: lead.audit.hasEcommerce,
    servicesDetected: lead.pains.slice(0, 3),
    navItems: page?.navItems ?? [],
    ctaLinks: page?.ctaLinks ?? [],
    brokenLinksCount: 0,
    structuredDataPresent: page?.structuredDataPresent ?? false,
    hasOpenGraph: page?.hasOpenGraph ?? false,
    hasTwitterCards: page?.hasTwitterCards ?? false,
    hasFavicon: page?.hasFavicon ?? false,
    hasManifest: false,
    hasServiceWorker: false,
    hasGoogleAnalytics: page?.hasGoogleAnalytics ?? false,
    hasCookieConsent: page?.hasCookieConsent ?? false,
    hasResponsiveImages: false,
    hasFontDisplay: false,
    securityHeaders: EMPTY_SECURITY,
    schemaTypes: page?.schemaTypes ?? [],
    accessibilityIssues: [],
    fontsDetected: [],
    performanceHints: [],
    cssFramework: null,
    pageCount: 1,
    consoleErrors: [],
    contactEmails: page?.emails ?? [],
    bookingProvider: lead.audit.bookingProvider,
    hasQrMenu: lead.audit.hasQrMenu ?? false,
    hasOnlineReservation: lead.audit.hasOnlineReservation ?? lead.audit.hasBookingSystem,
    hasDeliveryIntegration: lead.audit.hasDeliveryIntegration ?? false,
    detectedMenuTool: lead.audit.detectedMenuTool ?? null,
    menuUrl: lead.audit.menuUrl ?? null,
    socialProfiles: page?.socials ?? {},
  };
}

function summariseReviews(reviews: DemoReview[]) {
  const n = reviews.length;
  const positive = reviews.filter((r) => r.rating >= 4).length;
  const neutral = reviews.filter((r) => r.rating === 3).length;
  const negative = reviews.filter((r) => r.rating <= 2).length;
  const buckets = [
    { label: "Food", test: /food|dish|menu|pasta|burger|steak|delicious|tasty|flavour|flavor/i, kind: "strength" as const },
    { label: "Service", test: /service|staff|server|waiter|friendly|attentive/i, kind: "strength" as const },
    { label: "Room", test: /atmosphere|vibe|room|beautiful|cosy|cozy|design|decor/i, kind: "strength" as const },
    { label: "Wait or queue", test: /wait|queue|slow|understaff/i, kind: "weakness" as const },
  ];
  const strengthKpis = [];
  const weaknessKpis = [];
  for (const bucket of buckets) {
    const hits = reviews.filter((r) => r.text && bucket.test.test(r.text));
    if (hits.length === 0) continue;
    const kpi = {
      label: bucket.label,
      count: hits.length,
      percent: Math.round((hits.length / n) * 100),
      examples: hits.map((r) => (r.text ?? "").slice(0, 180)).filter(Boolean).slice(0, 2),
    };
    if (bucket.kind === "weakness") weaknessKpis.push(kpi);
    else strengthKpis.push(kpi);
  }
  const complaintShare = n === 0 ? 0 : negative / n;
  return {
    strengthKpis,
    weaknessKpis,
    sentiment: {
      positive: n ? positive / n : 0,
      neutral: n ? neutral / n : 0,
      negative: n ? negative / n : 0,
    },
    painPhrases: weaknessKpis.flatMap((k) => k.examples).slice(0, 4),
    strengthPhrases: strengthKpis.flatMap((k) => k.examples).slice(0, 4),
    leadScore: Math.round(20 + complaintShare * 40),
    summary: `Places returned ${n} review${n === 1 ? "" : "s"} for this listing, not the full Google corpus. ${positive} of them are 4 or 5 stars. Treat the bars as a sample, not a measured rate.`,
  };
}

function buildDossier(lead: DemoLead, evidence: PublicEvidence): string {
  const page = evidence.page;
  const reviewLines =
    evidence.reviews.length === 0
      ? "No review text came back from Places on this pass. The fit above is from the venue's own site, not from a review percentage."
      : evidence.reviews
          .map((review) => {
            const quote = (review.text ?? "").replace(/\s+/g, " ").trim().slice(0, 280);
            return `- ${review.rating}/5 · ${review.authorName}${review.relativeTime ? ` · ${review.relativeTime}` : ""}${quote ? `\n  ${quote}` : ""}`;
          })
          .join("\n");
  const nav =
    page && page.navItems.length > 0
      ? page.navItems.map((item) => item.text).slice(0, 8).join(", ")
      : "not read off the HTML";
  return [
    `# ${lead.businessName}`,
    "",
    "## What to do on this call",
    lead.hook,
    "",
    "## Do not pitch",
    ...lead.doNotPitch.map((line) => `- ${line}`),
    "",
    "## Why they're a fit",
    lead.why,
    "",
    "## Where it actually hurts",
    ...lead.pains.map((line) => `- ${line}`),
    "",
    "## What the website shows",
    `- Page: ${lead.websiteUrl}`,
    `- Title: ${page?.title || lead.businessName}`,
    `- Meta: ${page?.metaDescription || "not present in the HTML we fetched"}`,
    `- H1: ${page?.h1 || lead.businessName}`,
    `- Booking: ${lead.audit.bookingProvider ?? "none confirmed"}`,
    `- Menu: ${lead.audit.menuUrl ?? lead.websiteUrl}`,
    `- Contact form: ${lead.audit.hasContactForm || page?.hasContactForm ? "yes" : "not found"}`,
    `- WhatsApp: ${page?.hasWhatsapp ? "yes" : "not found"}`,
    `- Emails: ${[...(lead.emails ?? []), ...(page?.emails ?? [])].filter((v, i, a) => a.indexOf(v) === i).join(", ") || "none published on the page we fetched"}`,
    `- Nav: ${nav}`,
    "",
    "## Review sample",
    evidence.placeName
      ? `Google listing matched: ${evidence.placeName}. Rating ${evidence.rating ?? "—"}, ${evidence.reviewCount ?? "—"} reviews on the listing. The notes below are only the reviews Places returned (at most five), not the whole corpus.`
      : "Places did not confirm a listing on this pass. Do not quote a Google rating until you re-check.",
    reviewLines,
    "",
    "## How the score was built",
    `Sales fit ${lead.salesConfidence} is the deterministic score: website shape, the review sample, and the ${lead.subNicheSlug.replace("fnb-", "")} weights. It is not yet adjusted from closed deals. That waits until there are enough won and lost outcomes to learn from.`,
    "",
    `## Package`,
    `${lead.packageName}. Angle on the call: ${lead.bestAngle}.`,
    "",
    `Stage: ${lead.stage.replaceAll("_", " ")}. Temperature: ${lead.temperature}.`,
  ].join("\n");
}

const PACKAGES: { name: DemoLead["packageName"]; priceLabel: string; features: string[]; sortOrder: number }[] = [
  {
    name: "Single site",
    priceLabel: "Quoted per site",
    features: ["QR menu", "Order & pay", "Online reservations"],
    sortOrder: 1,
  },
  {
    name: "Guest CRM",
    priceLabel: "Quoted per site",
    features: ["Guest profile", "Visit history", "Loyalty"],
    sortOrder: 2,
  },
  {
    name: "Multi-location",
    priceLabel: "Quoted for the group",
    features: ["One menu across sites", "One book", "Group reporting"],
    sortOrder: 3,
  },
];

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: { equals: OWNER_EMAIL, mode: "insensitive" } },
    select: { id: true, email: true },
  });
  if (!user) {
    throw new Error(`No user ${OWNER_EMAIL}. Run scripts/seed-finedine-beta.ts first.`);
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: user.id, role: "OWNER" },
    select: { workspaceId: true, workspace: { select: { name: true } } },
  });
  if (!membership) {
    throw new Error(`${OWNER_EMAIL} owns no workspace.`);
  }
  const workspaceId = membership.workspaceId;
  console.log(`Workspace: ${membership.workspace.name} (${workspaceId})`);

  const existing = await prisma.lead.findMany({
    where: { workspaceId },
    select: { id: true, businessName: true },
  });
  console.log(`Removing ${existing.length} existing lead(s):`);
  for (const lead of existing) console.log(`  - ${lead.businessName}`);

  if (existing.length > 0) {
    const removed = await prisma.lead.deleteMany({ where: { workspaceId } });
    console.log(`Deleted ${removed.count} lead(s).`);
  }

  await prisma.account.deleteMany({
    where: { workspaceId, notes: SEED_TAG },
  });

  const packageIds = new Map<string, string>();
  for (const pkg of PACKAGES) {
    const row = await prisma.servicePackage.upsert({
      where: { workspaceId_name: { workspaceId, name: pkg.name } },
      create: {
        workspaceId,
        name: pkg.name,
        priceLabel: pkg.priceLabel,
        features: pkg.features,
        sortOrder: pkg.sortOrder,
        isPopular: pkg.name === "Multi-location",
      },
      update: {
        priceLabel: pkg.priceLabel,
        features: pkg.features,
        sortOrder: pkg.sortOrder,
      },
      select: { id: true, name: true },
    });
    packageIds.set(row.name, row.id);
  }

  const accountIds = new Map<string, string>();
  for (const lead of LEADS) {
    if (!lead.account || accountIds.has(lead.account.apexDomain)) continue;
    const existingAccount = await prisma.account.findFirst({
      where: { workspaceId, apexDomain: lead.account.apexDomain },
      select: { id: true },
    });
    const account = existingAccount
      ? await prisma.account.update({
          where: { id: existingAccount.id },
          data: {
            name: lead.account.name,
            locationsCount: lead.account.locationsCount,
            notes: SEED_TAG,
            tier: "TIER_1",
          },
          select: { id: true },
        })
      : await prisma.account.create({
          data: {
            workspaceId,
            name: lead.account.name,
            apexDomain: lead.account.apexDomain,
            locationsCount: lead.account.locationsCount,
            notes: SEED_TAG,
            tier: "TIER_1",
          },
          select: { id: true },
        });
    accountIds.set(lead.account.apexDomain, account.id);
  }

  for (const lead of LEADS) {
    const accountId = lead.account ? accountIds.get(lead.account.apexDomain) ?? null : null;
    const evidence = await gatherEvidence(lead.placeId, lead.googleMapsQuery, lead.websiteUrl);
    console.log(
      `Evidence ${lead.businessName}: places=${evidence.placeName ?? "none"} reviews=${evidence.reviews.length} page=${evidence.page ? evidence.page.httpStatus : "none"}`,
    );
    const phone =
      lead.phone ??
      (SKIP_GOOGLE_PHONE.has(lead.placeId) ? null : evidence.googlePhone);
    const created = await prisma.lead.create({
      data: {
        workspaceId,
        placeId: lead.placeId,
        businessName: lead.businessName,
        formattedAddress: lead.formattedAddress,
        borough: lead.borough,
        phone,
        websiteUrl: lead.websiteUrl,
        hasWebsite: true,
        googleMapsUri:
          evidence.googleMapsUri ??
          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.googleMapsQuery)}`,
        sourceLat: evidence.lat,
        sourceLng: evidence.lng,
        businessStatus: "OPERATIONAL",
        primaryType: lead.primaryType,
        priceLevel: lead.priceLevel,
        rating: evidence.rating ?? lead.rating,
        reviewCount: evidence.reviewCount ?? lead.reviewCount,
        reviewAnalysisStatus: evidence.reviews.length > 0 ? "ANALYZED" : "PENDING",
        sourceQuery: SEED_TAG,
        crawlStatus: "CRAWLED",
        analyzeStatus: "ANALYZED",
        nicheSlug: "fnb",
        subNicheSlug: lead.subNicheSlug,
        subNicheSource: "MANUAL",
        subNicheConfidence: 0.9,
        salesConfidence: lead.salesConfidence,
        leadSource: "HUBSPOT_INBOUND",
        leadTemperature: lead.temperature,
        inboundReceivedAt: hoursAgo(lead.inboundHoursAgo),
        lastContactedAt: lead.lastContactedHoursAgo === null ? null : hoursAgo(lead.lastContactedHoursAgo),
        lastDisposition: lead.lastDisposition,
        playbookStageKey: lead.stage,
        timezone: "Europe/London",
        accountId,
      },
      select: { id: true },
    });

    const page = evidence.page;
    const features = buildFeatures(lead, page);

    await prisma.websiteAudit.create({
      data: {
        leadId: created.id,
        url: lead.websiteUrl,
        reachable: true,
        crawlAttemptedAt: new Date(),
        httpStatus: page?.httpStatus ?? 200,
        https: page?.https ?? lead.websiteUrl.startsWith("https://"),
        mobileFriendlyGuess: true,
        title: page?.title || lead.businessName,
        metaDescription: page?.metaDescription ?? null,
        h1: page?.h1 || lead.businessName,
        hasContactForm: lead.audit.hasContactForm ?? page?.hasContactForm ?? false,
        hasWhatsappLink: page?.hasWhatsapp ?? false,
        hasBookingSystem: lead.audit.hasBookingSystem,
        bookingProvider: lead.audit.bookingProvider,
        hasEcommerce: lead.audit.hasEcommerce,
        servicesDetected: lead.pains.slice(0, 3),
        navItems: page?.navItems ?? [],
        ctaLinks: page?.ctaLinks ?? [],
        contactEmails: [...new Set([...(lead.emails ?? []), ...(page?.emails ?? [])])],
        socialProfiles: page?.socials ?? {},
        structuredDataPresent: page?.structuredDataPresent ?? false,
        rawFeaturesJson: features,
      },
    });

    if (evidence.reviews.length > 0) {
      await prisma.googleReview.createMany({
        data: evidence.reviews.map((review) => ({
          leadId: created.id,
          authorName: review.authorName,
          rating: review.rating,
          text: review.text,
          relativeTime: review.relativeTime,
          publishTime: review.publishTime,
        })),
      });
      const analysis = summariseReviews(evidence.reviews);
      await prisma.reviewAnalysis.create({
        data: {
          leadId: created.id,
          reviewsAnalyzedCount: evidence.reviews.length,
          weaknessKpis: analysis.weaknessKpis,
          strengthKpis: analysis.strengthKpis,
          sentimentBreakdown: analysis.sentiment,
          painPhrases: analysis.painPhrases,
          strengthPhrases: analysis.strengthPhrases,
          switchSignals: [],
          leadScore: analysis.leadScore,
          summary: analysis.summary,
        },
      });
    }

    await prisma.salesOpportunity.create({
      data: {
        leadId: created.id,
        opportunityScore: lead.salesConfidence,
        whyGoodTarget: lead.why,
        likelyPainPoints: lead.pains,
        bestSalesAngle: lead.bestAngle,
        suggestedOffer: "GROWTH",
        personalizedFirstMessage: lead.hook,
        recommendedPackageId: packageIds.get(lead.packageName) ?? null,
        recommendedPackageReason: lead.why,
        status: lead.stage === "new_inbound" ? "NEW" : lead.stage === "meeting_booked" ? "MEETING" : "CONTACTED",
      },
    });

    await prisma.leadNextAction.create({
      data: {
        workspaceId,
        leadId: created.id,
        version: 1,
        isPreliminary: false,
        actionKind: lead.stage === "meeting_booked" ? "WAIT_FOR_REPLY" : "CALL_NOW",
        channel: "PHONE",
        openingHook: lead.hook,
        whatNotToPitch: lead.doNotPitch,
        confidence: lead.salesConfidence,
        reasoning: lead.why,
      },
    });

    if (lead.qualification) {
      const required = ["decision_maker", "need", "timing", "next_step"];
      const qualified = required.every((key) => lead.qualification?.[key] === true);
      await prisma.leadQualification.create({
        data: {
          workspaceId,
          leadId: created.id,
          answers: lead.qualification,
          qualified,
          status: qualified ? "qualified" : "in_progress",
          updatedByUserId: user.id,
        },
      });
    }

    for (const call of lead.calls) {
      await prisma.leadActivity.create({
        data: {
          workspaceId,
          leadId: created.id,
          userId: user.id,
          kind: "CALL_LOGGED",
          payload: { disposition: call.disposition },
          createdAt: hoursAgo(call.hoursAgo),
        },
      });
    }

    const dossierFinished = new Date(Date.now() + 2 * 60 * 1000);
    const markdown = buildDossier(lead, evidence);
    await prisma.agentRun.create({
      data: {
        workspaceId,
        leadId: created.id,
        userId: user.id,
        workerKind: "LEAD_DOSSIER_GENERATOR",
        status: "SUCCEEDED",
        inputsJson: { source: SEED_TAG },
        outputJson: {
          markdown,
          generatedAt: new Date().toISOString(),
          stats: {
            agentRunCount: 3,
            memoryRowCount: 0,
            reviewCount: evidence.reviews.length,
            voiceNoteCount: 0,
          },
        },
        startedAt: new Date(),
        finishedAt: dossierFinished,
      },
    });
    await prisma.agentRun.createMany({
      data: [
        {
          workspaceId,
          leadId: created.id,
          userId: user.id,
          workerKind: "WEBSITE_AUDITOR",
          status: "SUCCEEDED",
          inputsJson: { url: lead.websiteUrl },
          outputJson: {
            reachable: true,
            url: lead.websiteUrl,
            bookingProvider: lead.audit.bookingProvider,
            title: page?.title || lead.businessName,
          },
          startedAt: new Date(),
          finishedAt: new Date(),
        },
        {
          workspaceId,
          leadId: created.id,
          userId: user.id,
          workerKind: "REVIEW_ANALYST",
          status: "SUCCEEDED",
          inputsJson: {},
          outputJson: {
            reviewsAnalyzedCount: evidence.reviews.length,
            summary: evidence.reviews.length
              ? `Sample of ${evidence.reviews.length} Places reviews.`
              : "No Places review text on this pass.",
          },
          startedAt: new Date(),
          finishedAt: new Date(),
        },
        {
          workspaceId,
          leadId: created.id,
          userId: user.id,
          workerKind: "SALES_OPPORTUNITY_SCORER",
          status: "SUCCEEDED",
          inputsJson: {},
          outputJson: {
            opportunityScore: lead.salesConfidence,
            bestSalesAngle: lead.bestAngle,
            packageName: lead.packageName,
          },
          startedAt: new Date(),
          finishedAt: new Date(),
        },
      ],
    });

    console.log(`Seeded ${lead.businessName} → ${lead.stage} / ${lead.temperature}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
