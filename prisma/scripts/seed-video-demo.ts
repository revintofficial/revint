/**
 * Video launch film seed.
 *
 * Wipes Mert's Workspace and re-seeds it with a deterministic, "showtime-ready"
 * fixture set crafted to mirror the Revint landing page narrative
 * (Bella Vita Trattoria as hero lead) and to give Steel scenarios stable IDs
 * to target during scripted recording.
 *
 * Idempotent: every run leaves the workspace in the exact same state.
 * The seed wipes everything Lead-scoped on this workspace and rebuilds it,
 * so it is safe to run repeatedly while iterating on the video.
 *
 * Run with:  pnpm tsx prisma/scripts/seed-video-demo.ts
 */
import { prisma } from "../../src/lib/prisma";
import "dotenv/config";

const WORKSPACE_ID = "cmo4u34lc00057kacjwfi1smv"; // Mert's Workspace
const OWNER_USER_ID = "0e634c3f-864d-4218-adfc-52194869ead3"; // meertseker@gmail.com

// ─── Workspace identity for the agency POV in the video ───────────────────────
const OFFER = {
  offerName: "Local Web Refresh",
  valueProposition:
    "Mobile-first websites for local restaurants and clinics. Live in 14 days, $2,400 flat. No retainer, no contracts.",
  socialProof:
    "47 local sites shipped this year. Pilot users see 4x reply lift when the cold email arrives with a mockup attached.",
  offerHook:
    "I made you a draft of what your site could look like — link below.",
  objective: "BOOK_MEETING",
  tone: "warm-direct",
  length: "short",
  language: "en",
  senderName: "Mert Şeker",
  conversionLink: "https://hustle-zeta.vercel.app/m/",
} as const;

// ─── The 12 deterministic leads for the launch film ───────────────────────────
// Lead 01 (Bella Vita) is the hero across scenes 02-07. The rest fill the
// discovery grid and supply movement when the camera pulls back.
type SeedLead = {
  id: string;
  placeId: string;
  businessName: string;
  formattedAddress: string;
  borough: string;
  phone: string;
  websiteUrl: string | null;
  hasWebsite: boolean;
  rating: number;
  reviewCount: number;
  primaryType: string;
  sourceQuery: string;
  sourceLat: number;
  sourceLng: number;
  // audit
  audit: {
    https: boolean;
    mobileFriendlyGuess: boolean;
    hasBookingSystem: boolean;
    hasContactForm: boolean;
    loadTimeMs: number;
    title: string;
    metaDescription: string;
    h1: string;
    contactEmails: string[];
    servicesDetected: string[];
  } | null;
  // opportunity
  opp: {
    score: number;
    pitch: string;
    painPoints: string[];
    suggestedOffer: "STARTER" | "GROWTH" | "SALES";
    angle: string;
    firstMessage: string;
    priceBand: string;
  };
  // pipeline
  pipelineStage: "NEW" | "REACHED_OUT" | "IN_TALKS" | "WON" | "LOST";
  stageOrder: number;
  notes?: string;
  // 5 deterministic Google reviews per lead
  reviews: Array<{ author: string; rating: number; text: string; relative: string; daysAgo: number }>;
};

const LEADS: SeedLead[] = [
  // ── HERO LEAD ──────────────────────────────────────────────────────────────
  {
    id: "vid_lead_01_bellavita",
    placeId: "vid_pl_001_bellavita",
    businessName: "Bella Vita Trattoria",
    formattedAddress: "284 Smith St, Brooklyn, NY 11231",
    borough: "Brooklyn",
    phone: "+1 (718) 555-0142",
    websiteUrl: "http://bellavita-trattoria.com",
    hasWebsite: true,
    rating: 4.7,
    reviewCount: 318,
    primaryType: "italian_restaurant",
    sourceQuery: "Italian restaurants in Brooklyn, NY",
    sourceLat: 40.6782,
    sourceLng: -73.9994,
    audit: {
      https: false,
      mobileFriendlyGuess: false,
      hasBookingSystem: false,
      hasContactForm: false,
      loadTimeMs: 5240,
      title: "Bella Vita Trattoria | Authentic Italian in Brooklyn",
      metaDescription: "Hand-rolled pasta, wood-fired pizza, family-owned since 1998.",
      h1: "Bella Vita Trattoria",
      contactEmails: ["bella@bellavita-trattoria.com"],
      servicesDetected: ["dine-in", "takeout"],
    },
    opp: {
      score: 87,
      pitch:
        "Site looks like 2008. They're 4.7★ but losing reservations on mobile.",
      painPoints: [
        "No mobile-friendly site, killing reservations from phone traffic",
        "No booking system — phone-only intake during dinner rush",
        "HTTP only — Chrome shows 'Not secure' warning",
      ],
      suggestedOffer: "STARTER",
      angle:
        "Lead with the mobile reservation gap. They have demand (4.7★, 318 reviews); they just can't capture it after-hours.",
      firstMessage:
        "Hey Bella Vita — I drafted a one-page site for you that fixes the three things hurting reservations on mobile. Took me 4 minutes. Link below if you want to peek.",
      priceBand: "$2.4k flat",
    },
    pipelineStage: "NEW",
    stageOrder: 0,
    notes: "Owner: Marco. Lunch service is the calmest call window.",
    reviews: [
      {
        author: "Sarah K.",
        rating: 5,
        text: "Best carbonara in Brooklyn. The pappardelle is unreal. We come once a month and the staff remembers our wine.",
        relative: "2 weeks ago",
        daysAgo: 14,
      },
      {
        author: "James R.",
        rating: 4,
        text: "Food was excellent — the meatballs are legendary. Tried to book online and couldn't, ended up calling 3 times. Worth it though.",
        relative: "a month ago",
        daysAgo: 28,
      },
      {
        author: "Priya M.",
        rating: 5,
        text: "Hidden gem. Marco the owner came over and recommended a Barolo that paired perfectly with the osso buco. Will be back.",
        relative: "3 weeks ago",
        daysAgo: 21,
      },
      {
        author: "Daniel T.",
        rating: 3,
        text: "Food great, but 40 min wait with no way to reserve from my phone is rough on a Tuesday. Fix the website.",
        relative: "a month ago",
        daysAgo: 32,
      },
      {
        author: "Olivia C.",
        rating: 5,
        text: "Anniversary dinner. They printed our names on the menu. The tiramisu was the best I've had outside Rome. Marco runs a tight ship.",
        relative: "5 days ago",
        daysAgo: 5,
      },
    ],
  },
  // ── SECONDARY LEADS (fill the grid, drive the count animation) ────────────
  {
    id: "vid_lead_02_marlow",
    placeId: "vid_pl_002_marlow",
    businessName: "Marlow Coffee Co.",
    formattedAddress: "121 N 10th St, Williamsburg, NY 11249",
    borough: "Brooklyn",
    phone: "+1 (718) 555-0298",
    websiteUrl: null,
    hasWebsite: false,
    rating: 4.9,
    reviewCount: 612,
    primaryType: "cafe",
    sourceQuery: "Cafés in Brooklyn, NY",
    sourceLat: 40.7223,
    sourceLng: -73.9576,
    audit: null,
    opp: {
      score: 94,
      pitch:
        "5★ café with no website, getting 200+ Instagram DMs/week asking for a menu.",
      painPoints: [
        "No website at all — Google listing only",
        "Order intake via Instagram DMs",
        "Can't capture email for return visitors",
      ],
      suggestedOffer: "STARTER",
      angle:
        "Show them the cost of zero website: every IG DM is a missed direct customer.",
      firstMessage:
        "Marlow — built a one-pager for the cafe with menu + order ahead. 5★ without a site is rare; you're leaving real revenue in the DMs.",
      priceBand: "$2.4k flat",
    },
    pipelineStage: "REACHED_OUT",
    stageOrder: 0,
    reviews: [
      { author: "Ana L.", rating: 5, text: "Best flat white in Williamsburg. Beans roasted on-site.", relative: "a week ago", daysAgo: 7 },
      { author: "Mark P.", rating: 5, text: "I work from here 4 days a week. Wifi is fast, baristas are kind.", relative: "2 weeks ago", daysAgo: 14 },
      { author: "Yuki T.", rating: 4, text: "Coffee perfect but they need a website. DMd them for an oat milk question, took 2 days.", relative: "3 weeks ago", daysAgo: 21 },
      { author: "Lena S.", rating: 5, text: "Pastries from the bakery next door. Single origin rotation is dialed.", relative: "a month ago", daysAgo: 30 },
      { author: "Rob H.", rating: 5, text: "Owner roasts. You can taste the difference. No website is wild for a place this good.", relative: "2 months ago", daysAgo: 60 },
    ],
  },
  {
    id: "vid_lead_03_nova",
    placeId: "vid_pl_003_nova",
    businessName: "Nova Dental Studio",
    formattedAddress: "37-12 32nd Ave, Astoria, NY 11103",
    borough: "Queens",
    phone: "+1 (347) 555-0118",
    websiteUrl: "https://novadental-ny.com",
    hasWebsite: true,
    rating: 4.6,
    reviewCount: 84,
    primaryType: "dentist",
    sourceQuery: "Dentists in Queens, NY",
    sourceLat: 40.7615,
    sourceLng: -73.9242,
    audit: {
      https: true,
      mobileFriendlyGuess: false,
      hasBookingSystem: false,
      hasContactForm: true,
      loadTimeMs: 5180,
      title: "Nova Dental Studio - Astoria",
      metaDescription: "Family dentistry in Queens.",
      h1: "Nova Dental Studio",
      contactEmails: ["info@novadental-ny.com", "appointments@novadental-ny.com"],
      servicesDetected: ["cleanings", "whitening", "implants"],
    },
    opp: {
      score: 72,
      pitch:
        "Practices in this zip earn $1.2M+/yr. Their site is killing 30%+ of organic search.",
      painPoints: ["Slow load (5.2s LCP)", "No mobile booking", "Weak local SEO"],
      suggestedOffer: "GROWTH",
      angle: "Speed + booking. Family dentists live or die on mobile new-patient intake.",
      firstMessage:
        "Hi Nova — drafted a faster version of your site with online booking. The LCP fix alone should bump organic 20-30% in 90 days.",
      priceBand: "$3.6k + $400/mo",
    },
    pipelineStage: "IN_TALKS",
    stageOrder: 0,
    reviews: [
      { author: "Maria G.", rating: 5, text: "Dr. Chen is gentle and explains everything. Clean, modern office.", relative: "3 weeks ago", daysAgo: 21 },
      { author: "Chris W.", rating: 4, text: "Good dentist. Booking by phone in 2025 is a hassle though.", relative: "a month ago", daysAgo: 35 },
      { author: "Jenna F.", rating: 5, text: "Insurance verification was painless. Got me in same week.", relative: "2 months ago", daysAgo: 60 },
      { author: "Tomás R.", rating: 4, text: "Quality care. Website is from a different decade.", relative: "2 months ago", daysAgo: 72 },
      { author: "Ash B.", rating: 5, text: "Best whitening I've had. Hygienist is a pro.", relative: "3 months ago", daysAgo: 95 },
    ],
  },
  {
    id: "vid_lead_04_hudson",
    placeId: "vid_pl_004_hudson",
    businessName: "Hudson Smile Co.",
    formattedAddress: "245 W 14th St, Manhattan, NY 10011",
    borough: "Manhattan",
    phone: "+1 (212) 555-0148",
    websiteUrl: "https://hudsonsmile.co",
    hasWebsite: true,
    rating: 4.8,
    reviewCount: 211,
    primaryType: "dentist",
    sourceQuery: "Dentists in Manhattan, NY",
    sourceLat: 40.7396,
    sourceLng: -74.0026,
    audit: {
      https: true,
      mobileFriendlyGuess: false,
      hasBookingSystem: false,
      hasContactForm: true,
      loadTimeMs: 4120,
      title: "Hudson Smile Co.",
      metaDescription: "Boutique dentistry in Chelsea.",
      h1: "Hudson Smile Co.",
      contactEmails: ["hello@hudsonsmile.co"],
      servicesDetected: ["cleanings", "veneers", "invisalign"],
    },
    opp: {
      score: 89,
      pitch: "$2M+ practice with a site that loses 40% of mobile traffic. Easy first call.",
      painPoints: ["No mobile booking", "Slow LCP on phone", "No insurance verifier"],
      suggestedOffer: "GROWTH",
      angle: "Cosmetic dentistry buyer is mobile-first. Veneer leads abandon at 2s.",
      firstMessage:
        "Hudson Smile — built you a faster mobile site with online booking. Premium practice deserves a premium intake flow.",
      priceBand: "$3.6k + $400/mo",
    },
    pipelineStage: "REACHED_OUT",
    stageOrder: 1,
    reviews: [
      { author: "Sophia K.", rating: 5, text: "Got veneers here. Dr. Patel is an artist.", relative: "2 weeks ago", daysAgo: 14 },
      { author: "Ben T.", rating: 5, text: "Best cleaning of my life. The chairs face the city. Stunning office.", relative: "a month ago", daysAgo: 30 },
      { author: "Nina V.", rating: 4, text: "Quality everything. Booking still by phone which felt odd for a Chelsea practice.", relative: "a month ago", daysAgo: 35 },
      { author: "Khalid A.", rating: 5, text: "Invisalign journey was smooth. They text reminders, which helps.", relative: "3 months ago", daysAgo: 90 },
      { author: "Erin S.", rating: 5, text: "Premium experience. Worth every penny.", relative: "4 months ago", daysAgo: 120 },
    ],
  },
  {
    id: "vid_lead_05_rossini",
    placeId: "vid_pl_005_rossini",
    businessName: "Rossini Pizzeria",
    formattedAddress: "82 7th Ave, Brooklyn, NY 11217",
    borough: "Brooklyn",
    phone: "+1 (718) 555-0387",
    websiteUrl: "http://rossini-pizza.com",
    hasWebsite: true,
    rating: 4.6,
    reviewCount: 247,
    primaryType: "pizza_restaurant",
    sourceQuery: "Italian restaurants in Brooklyn, NY",
    sourceLat: 40.6712,
    sourceLng: -73.9821,
    audit: {
      https: false,
      mobileFriendlyGuess: false,
      hasBookingSystem: false,
      hasContactForm: false,
      loadTimeMs: 6020,
      title: "Rossini Pizzeria - Park Slope",
      metaDescription: "Wood-fired Neapolitan pizza.",
      h1: "Rossini Pizzeria",
      contactEmails: ["orders@rossini-pizza.com"],
      servicesDetected: ["dine-in", "takeout", "delivery"],
    },
    opp: {
      score: 81,
      pitch: "Wood-fired pizza spot with a site that won't load on a phone in line.",
      painPoints: ["6s mobile load", "No HTTPS", "No online ordering"],
      suggestedOffer: "STARTER",
      angle: "Pizza is impulse. Slow site = lost orders.",
      firstMessage:
        "Rossini — drafted a mobile site with online ordering. People decide on pizza in 30 seconds; your site takes 6.",
      priceBand: "$2.4k flat",
    },
    pipelineStage: "NEW",
    stageOrder: 0,
    reviews: [
      { author: "Marco D.", rating: 5, text: "Margherita is perfect. The crust is the best in the neighborhood.", relative: "a week ago", daysAgo: 7 },
      { author: "Liz K.", rating: 4, text: "Great pizza, slow website. Tried to order online, gave up, walked over.", relative: "2 weeks ago", daysAgo: 14 },
      { author: "Sam P.", rating: 5, text: "Family run, you can taste it. Fresh mozzarella daily.", relative: "a month ago", daysAgo: 30 },
      { author: "Hannah W.", rating: 4, text: "Solid neighborhood spot.", relative: "a month ago", daysAgo: 32 },
      { author: "Ivan R.", rating: 5, text: "Their nduja pizza is unreal. Add it to your menu, trust me.", relative: "2 months ago", daysAgo: 60 },
    ],
  },
  {
    id: "vid_lead_06_greenpoint",
    placeId: "vid_pl_006_greenpoint",
    businessName: "Greenpoint Espresso Bar",
    formattedAddress: "812 Manhattan Ave, Brooklyn, NY 11222",
    borough: "Brooklyn",
    phone: "+1 (718) 555-0421",
    websiteUrl: null,
    hasWebsite: false,
    rating: 4.8,
    reviewCount: 389,
    primaryType: "cafe",
    sourceQuery: "Cafés in Brooklyn, NY",
    sourceLat: 40.7298,
    sourceLng: -73.9542,
    audit: null,
    opp: {
      score: 76,
      pitch: "4.8★ café, no website, no online presence beyond Google.",
      painPoints: ["No website", "No newsletter capture", "No order ahead"],
      suggestedOffer: "STARTER",
      angle: "First mover advantage. Half the cafes on this stretch don't have a site.",
      firstMessage:
        "Greenpoint Espresso — made you a one-pager with order ahead. Worth a look while waiting for the next batch.",
      priceBand: "$2.4k flat",
    },
    pipelineStage: "NEW",
    stageOrder: 1,
    reviews: [
      { author: "Mira O.", rating: 5, text: "Cortado here is my morning ritual. Staff is sweet.", relative: "3 days ago", daysAgo: 3 },
      { author: "Oscar T.", rating: 5, text: "Old-school Polish bakery vibes meet modern espresso.", relative: "2 weeks ago", daysAgo: 14 },
      { author: "Jane K.", rating: 4, text: "Coffee great, no website is annoying when planning.", relative: "3 weeks ago", daysAgo: 21 },
      { author: "Pete S.", rating: 5, text: "Best espresso bar in Greenpoint, full stop.", relative: "a month ago", daysAgo: 30 },
      { author: "Amelia C.", rating: 5, text: "They remember your order on visit two. Lost art.", relative: "2 months ago", daysAgo: 60 },
    ],
  },
  {
    id: "vid_lead_07_williamsburg_dental",
    placeId: "vid_pl_007_wburg_dental",
    businessName: "Williamsburg Family Dental",
    formattedAddress: "168 N 8th St, Brooklyn, NY 11211",
    borough: "Brooklyn",
    phone: "+1 (718) 555-0512",
    websiteUrl: "http://williamsburgfamilydental.com",
    hasWebsite: true,
    rating: 4.5,
    reviewCount: 142,
    primaryType: "dentist",
    sourceQuery: "Dentists in Brooklyn, NY",
    sourceLat: 40.7196,
    sourceLng: -73.9572,
    audit: {
      https: false,
      mobileFriendlyGuess: false,
      hasBookingSystem: false,
      hasContactForm: false,
      loadTimeMs: 7340,
      title: "Williamsburg Family Dental",
      metaDescription: "Family dentistry.",
      h1: "Welcome",
      contactEmails: [],
      servicesDetected: ["cleanings", "fillings"],
    },
    opp: {
      score: 68,
      pitch: "Site is from 2014, no contact form, no SSL. Fixes pay back in two new patients.",
      painPoints: ["7s load time", "No HTTPS", "No contact form", "No booking"],
      suggestedOffer: "GROWTH",
      angle: "Insurance check + booking. New patient acquisition is everything in family dental.",
      firstMessage:
        "Williamsburg Family — drafted a faster site with online booking + insurance check. Should pay back in 2 new patients.",
      priceBand: "$3.6k + $400/mo",
    },
    pipelineStage: "NEW",
    stageOrder: 2,
    reviews: [
      { author: "Carla M.", rating: 5, text: "Dr. Levine is amazing with my kids. Patient and kind.", relative: "2 weeks ago", daysAgo: 14 },
      { author: "Pat N.", rating: 4, text: "Solid family dentist. Wish booking was online.", relative: "a month ago", daysAgo: 30 },
      { author: "Yara F.", rating: 5, text: "Got me out of an emergency on a Saturday.", relative: "2 months ago", daysAgo: 60 },
      { author: "Rick D.", rating: 4, text: "Old-school feel, modern care.", relative: "3 months ago", daysAgo: 90 },
      { author: "Linh P.", rating: 4, text: "Good dentist, website is rough.", relative: "5 months ago", daysAgo: 150 },
    ],
  },
  {
    id: "vid_lead_08_trattoria_bella",
    placeId: "vid_pl_008_trattoria_bella",
    businessName: "Trattoria Bella Notte",
    formattedAddress: "234 Mulberry St, Manhattan, NY 10012",
    borough: "Manhattan",
    phone: "+1 (212) 555-0612",
    websiteUrl: "https://trattoria-bellanotte.com",
    hasWebsite: true,
    rating: 4.7,
    reviewCount: 482,
    primaryType: "italian_restaurant",
    sourceQuery: "Italian restaurants in Manhattan, NY",
    sourceLat: 40.7222,
    sourceLng: -73.9967,
    audit: {
      https: true,
      mobileFriendlyGuess: true,
      hasBookingSystem: true,
      hasContactForm: true,
      loadTimeMs: 2410,
      title: "Trattoria Bella Notte | NoLita",
      metaDescription: "Northern Italian, by reservation.",
      h1: "Trattoria Bella Notte",
      contactEmails: ["reserve@trattoria-bellanotte.com"],
      servicesDetected: ["dine-in", "private events"],
    },
    opp: {
      score: 84,
      pitch: "Strong site already. Upsell to private events landing page + Klaviyo flow.",
      painPoints: ["No event booking flow", "No newsletter", "Generic SEO"],
      suggestedOffer: "GROWTH",
      angle: "Premium upsell — they don't need a rebuild, they need a private events funnel.",
      firstMessage:
        "Bella Notte — your site is solid. Drafted a private events landing page that should add 1-2 bookings/mo.",
      priceBand: "$3.6k + $400/mo",
    },
    pipelineStage: "WON",
    stageOrder: 0,
    reviews: [
      { author: "Elena R.", rating: 5, text: "Hosted my engagement party here. They handled everything.", relative: "a week ago", daysAgo: 7 },
      { author: "James M.", rating: 5, text: "Tagliatelle al ragu is religion.", relative: "2 weeks ago", daysAgo: 14 },
      { author: "Yuki S.", rating: 4, text: "Excellent food, hard to get a Saturday reservation.", relative: "a month ago", daysAgo: 30 },
      { author: "Carlos V.", rating: 5, text: "Service is what NoLita used to feel like.", relative: "2 months ago", daysAgo: 60 },
      { author: "Margaux D.", rating: 5, text: "Their sommelier knows what she's doing.", relative: "3 months ago", daysAgo: 90 },
    ],
  },
  {
    id: "vid_lead_09_park_slope_coffee",
    placeId: "vid_pl_009_psc",
    businessName: "Park Slope Coffee House",
    formattedAddress: "212 5th Ave, Brooklyn, NY 11215",
    borough: "Brooklyn",
    phone: "+1 (718) 555-0719",
    websiteUrl: "http://parkslopecoffee.com",
    hasWebsite: true,
    rating: 4.6,
    reviewCount: 528,
    primaryType: "cafe",
    sourceQuery: "Cafés in Brooklyn, NY",
    sourceLat: 40.6735,
    sourceLng: -73.9810,
    audit: {
      https: false,
      mobileFriendlyGuess: false,
      hasBookingSystem: false,
      hasContactForm: false,
      loadTimeMs: 4920,
      title: "Park Slope Coffee House",
      metaDescription: "",
      h1: "Coffee + Pastry",
      contactEmails: [],
      servicesDetected: ["dine-in", "takeout"],
    },
    opp: {
      score: 79,
      pitch: "500+ reviews, dead website. Easy local SEO + order ahead win.",
      painPoints: ["No HTTPS", "No order ahead", "No menu online"],
      suggestedOffer: "STARTER",
      angle: "Loyalty + order ahead. The customers exist; the digital intake doesn't.",
      firstMessage: "Park Slope Coffee — drafted a one-pager with menu + order ahead. 500+ reviews deserves better.",
      priceBand: "$2.4k flat",
    },
    pipelineStage: "REACHED_OUT",
    stageOrder: 2,
    reviews: [
      { author: "Diana T.", rating: 5, text: "Pour over is the best in the neighborhood.", relative: "5 days ago", daysAgo: 5 },
      { author: "Frank L.", rating: 4, text: "Coffee great. Their website looks broken.", relative: "2 weeks ago", daysAgo: 14 },
      { author: "Maya K.", rating: 5, text: "Cardamom bun + flat white is my Sunday ritual.", relative: "a month ago", daysAgo: 30 },
      { author: "Ben S.", rating: 5, text: "Locally roasted. Friendly staff. Wifi works.", relative: "2 months ago", daysAgo: 60 },
      { author: "Amir J.", rating: 4, text: "Solid spot. Could use online menu, hard to know what's daily.", relative: "3 months ago", daysAgo: 90 },
    ],
  },
  {
    id: "vid_lead_10_east_village_smiles",
    placeId: "vid_pl_010_evs",
    businessName: "East Village Smiles",
    formattedAddress: "318 E 6th St, Manhattan, NY 10003",
    borough: "Manhattan",
    phone: "+1 (212) 555-0823",
    websiteUrl: "https://eastvillagesmiles.com",
    hasWebsite: true,
    rating: 4.9,
    reviewCount: 304,
    primaryType: "dentist",
    sourceQuery: "Dentists in Manhattan, NY",
    sourceLat: 40.7274,
    sourceLng: -73.9851,
    audit: {
      https: true,
      mobileFriendlyGuess: true,
      hasBookingSystem: true,
      hasContactForm: true,
      loadTimeMs: 1820,
      title: "East Village Smiles | NYC Cosmetic Dentistry",
      metaDescription: "Boutique cosmetic dentistry in the East Village.",
      h1: "Modern dentistry, NYC craft.",
      contactEmails: ["hi@eastvillagesmiles.com"],
      servicesDetected: ["veneers", "invisalign", "cleanings", "whitening"],
    },
    opp: {
      score: 91,
      pitch: "Premium practice, modern site. Upsell to a paid ads landing page system.",
      painPoints: ["No service-specific landing pages", "No retargeting pixel", "No reviews schema"],
      suggestedOffer: "SALES",
      angle: "Performance funnel — they have the brand, they need the paid traffic engine.",
      firstMessage: "East Village Smiles — drafted a veneer-specific landing page for paid traffic. Their current funnel underprices them.",
      priceBand: "$5.4k + $700/mo",
    },
    pipelineStage: "IN_TALKS",
    stageOrder: 1,
    reviews: [
      { author: "Tess A.", rating: 5, text: "Got veneers here, life changing. Dr. Park is meticulous.", relative: "a week ago", daysAgo: 7 },
      { author: "Mick D.", rating: 5, text: "Booking online took 30 seconds. The whole experience is dialed.", relative: "2 weeks ago", daysAgo: 14 },
      { author: "Lina V.", rating: 5, text: "Best cleaning in the city. Office feels like a spa.", relative: "a month ago", daysAgo: 30 },
      { author: "Rod E.", rating: 4, text: "Pricey but earned. They text reminders, run on time.", relative: "2 months ago", daysAgo: 60 },
      { author: "Kim Y.", rating: 5, text: "Invisalign here. They use scanners not gunk. Modern.", relative: "3 months ago", daysAgo: 90 },
    ],
  },
  {
    id: "vid_lead_11_carroll_pasta",
    placeId: "vid_pl_011_cgp",
    businessName: "Carroll Gardens Pasta Co.",
    formattedAddress: "402 Court St, Brooklyn, NY 11231",
    borough: "Brooklyn",
    phone: "+1 (718) 555-0918",
    websiteUrl: "http://carrollpasta.com",
    hasWebsite: true,
    rating: 4.5,
    reviewCount: 178,
    primaryType: "italian_restaurant",
    sourceQuery: "Italian restaurants in Brooklyn, NY",
    sourceLat: 40.6789,
    sourceLng: -73.9981,
    audit: {
      https: false,
      mobileFriendlyGuess: false,
      hasBookingSystem: false,
      hasContactForm: false,
      loadTimeMs: 4810,
      title: "Carroll Gardens Pasta",
      metaDescription: "Fresh pasta, Carroll Gardens.",
      h1: "Carroll Gardens Pasta Co.",
      contactEmails: ["info@carrollpasta.com"],
      servicesDetected: ["dine-in", "takeout", "fresh pasta retail"],
    },
    opp: {
      score: 73,
      pitch: "Sells fresh pasta retail too. Site doesn't reflect the dual revenue stream.",
      painPoints: ["No e-commerce for pasta retail", "No reservation system", "Slow load"],
      suggestedOffer: "GROWTH",
      angle: "Two revenue lines, one site. Add Shopify Lite for the pasta retail.",
      firstMessage: "Carroll Gardens Pasta — your retail pasta is a hidden line item. Drafted a site that puts it front and center.",
      priceBand: "$3.6k + $400/mo",
    },
    pipelineStage: "LOST",
    stageOrder: 0,
    notes: "Owner ghosted after 3 follow-ups. Try again Q2.",
    reviews: [
      { author: "Sara T.", rating: 5, text: "Squid ink linguine. Ordered the dry pasta to take home, top tier.", relative: "a week ago", daysAgo: 7 },
      { author: "Vincent C.", rating: 4, text: "Family-owned. Charming. Slow website made me almost not come.", relative: "3 weeks ago", daysAgo: 21 },
      { author: "Maddie P.", rating: 5, text: "The cacio e pepe is the only one I'd compare to Roma.", relative: "a month ago", daysAgo: 30 },
      { author: "Tariq B.", rating: 4, text: "Great food, hard to get a table without calling.", relative: "2 months ago", daysAgo: 60 },
      { author: "Nadia O.", rating: 5, text: "I buy a kilo of fresh tagliatelle every Sunday.", relative: "3 months ago", daysAgo: 90 },
    ],
  },
  {
    id: "vid_lead_12_dumbo_roasters",
    placeId: "vid_pl_012_dumbo",
    businessName: "Dumbo Roasters",
    formattedAddress: "55 Pearl St, Brooklyn, NY 11201",
    borough: "Brooklyn",
    phone: "+1 (718) 555-1042",
    websiteUrl: "https://dumboroasters.com",
    hasWebsite: true,
    rating: 4.8,
    reviewCount: 712,
    primaryType: "cafe",
    sourceQuery: "Cafés in Brooklyn, NY",
    sourceLat: 40.7036,
    sourceLng: -73.9889,
    audit: {
      https: true,
      mobileFriendlyGuess: true,
      hasBookingSystem: false,
      hasContactForm: true,
      loadTimeMs: 2610,
      title: "Dumbo Roasters | Specialty Coffee",
      metaDescription: "Single-origin coffee, roasted in Brooklyn.",
      h1: "Dumbo Roasters",
      contactEmails: ["wholesale@dumboroasters.com", "hello@dumboroasters.com"],
      servicesDetected: ["dine-in", "wholesale", "subscription"],
    },
    opp: {
      score: 88,
      pitch: "Roasting wholesale, has a subscription. Site doesn't capture either lead well.",
      painPoints: ["Wholesale CTA buried", "Subscription form generic", "No retention email flow"],
      suggestedOffer: "SALES",
      angle: "B2B wholesale + subscription retention. Two specific funnels missing.",
      firstMessage: "Dumbo Roasters — drafted a wholesale lead form + a subscription win-back flow. Both should pay back inside a quarter.",
      priceBand: "$5.4k + $700/mo",
    },
    pipelineStage: "WON",
    stageOrder: 1,
    reviews: [
      { author: "Holly M.", rating: 5, text: "Their Ethiopian roast is the best I've had outside Addis.", relative: "4 days ago", daysAgo: 4 },
      { author: "Gus N.", rating: 5, text: "I subscribe. Beans arrive 3 days off roast every time.", relative: "2 weeks ago", daysAgo: 14 },
      { author: "Ila K.", rating: 4, text: "Excellent coffee. Wholesale process was a bit slow, took a week.", relative: "a month ago", daysAgo: 30 },
      { author: "Jeb P.", rating: 5, text: "View of the bridge while drinking world-class coffee. Brooklyn at its best.", relative: "2 months ago", daysAgo: 60 },
      { author: "Ren T.", rating: 5, text: "They do a public cupping every Saturday. Worth showing up for.", relative: "3 months ago", daysAgo: 90 },
    ],
  },
];

// ─── Hero mockup variants for the morph scene ────────────────────────────────
const HERO_MOCKUP_VARIANTS = [
  { slug: "vid-bv-indigo", variant: "Indigo", primary: "#5e6ad2", accent: "#a5b4fc" },
  { slug: "vid-bv-emerald", variant: "Emerald", primary: "#059669", accent: "#34d399" },
  { slug: "vid-bv-warm", variant: "Warm", primary: "#b45309", accent: "#fbbf24" },
];

const HERO_PLAN_MARKDOWN = `# Bella Vita Trattoria
4.7★ in Brooklyn, NY, with a site that finally matches the reviews.

## Services
- Online reservations — never miss a Saturday booking again
- Menu + photos — let the food sell itself
- Click-to-call — the kitchen is one tap away

## Reviews
"Best carbonara in Brooklyn." — Sarah K.
"Hidden gem. Marco runs a tight ship." — Priya M.

## Contact
+1 (718) 555-0142
284 Smith St, Brooklyn, NY 11231
`;

function fixedDate(daysAgo: number): Date {
  const base = new Date("2026-04-15T12:00:00Z");
  return new Date(base.getTime() - daysAgo * 86400_000);
}

async function main() {
  console.log("\n=== Video launch film seed ===");
  console.log(`Workspace: ${WORKSPACE_ID}`);
  console.log(`Owner:     ${OWNER_USER_ID}`);
  console.log("");

  // Sanity check the workspace exists.
  const ws = await prisma.workspace.findUnique({ where: { id: WORKSPACE_ID } });
  if (!ws) {
    throw new Error(
      `Workspace ${WORKSPACE_ID} not found. Sign in once with meertseker@gmail.com to bootstrap it.`,
    );
  }

  // 1. Wipe everything Lead-scoped on this workspace.
  // Cascades through audit / opportunity / watchlist / reviews / mockups via FKs.
  console.log("Wiping existing data...");
  const wipe = await prisma.lead.deleteMany({ where: { workspaceId: WORKSPACE_ID } });
  console.log(`  Deleted ${wipe.count} existing leads (cascade removed all related rows)`);

  // 2. Update workspace offer fields so the AI opener generates real copy.
  console.log("\nUpdating workspace offer identity...");
  await prisma.workspace.update({
    where: { id: WORKSPACE_ID },
    data: {
      offerName: OFFER.offerName,
      valueProposition: OFFER.valueProposition,
      socialProof: OFFER.socialProof,
      offerHook: OFFER.offerHook,
      objective: OFFER.objective,
      tone: OFFER.tone,
      length: OFFER.length,
      language: OFFER.language,
      senderName: OFFER.senderName,
      conversionLink: OFFER.conversionLink,
    },
  });
  console.log(`  Offer: "${OFFER.offerName}" / sender: ${OFFER.senderName} / lang: ${OFFER.language}`);

  // 3. Insert leads + their dependent rows in deterministic order.
  console.log(`\nSeeding ${LEADS.length} leads...`);
  for (const [i, l] of LEADS.entries()) {
    const createdAt = fixedDate(LEADS.length - i);

    await prisma.lead.create({
      data: {
        id: l.id,
        workspaceId: WORKSPACE_ID,
        placeId: l.placeId,
        businessName: l.businessName,
        formattedAddress: l.formattedAddress,
        borough: l.borough,
        phone: l.phone,
        websiteUrl: l.websiteUrl,
        hasWebsite: l.hasWebsite,
        googleMapsUri: `https://www.google.com/maps/place/?q=place_id:${l.placeId}`,
        rating: l.rating,
        reviewCount: l.reviewCount,
        businessStatus: "OPERATIONAL",
        primaryType: l.primaryType,
        sourceQuery: l.sourceQuery,
        sourceLat: l.sourceLat,
        sourceLng: l.sourceLng,
        crawlStatus: l.hasWebsite ? "CRAWLED" : "NO_WEBSITE",
        analyzeStatus: "ANALYZED",
        reviewAnalysisStatus: "ANALYZED",
        createdAt,
        updatedAt: createdAt,
      },
    });

    if (l.audit && l.websiteUrl) {
      await prisma.websiteAudit.create({
        data: {
          leadId: l.id,
          url: l.websiteUrl,
          reachable: true,
          loadTimeMs: l.audit.loadTimeMs,
          https: l.audit.https,
          mobileFriendlyGuess: l.audit.mobileFriendlyGuess,
          title: l.audit.title,
          metaDescription: l.audit.metaDescription,
          h1: l.audit.h1,
          hasContactForm: l.audit.hasContactForm,
          hasBookingSystem: l.audit.hasBookingSystem,
          servicesDetected: l.audit.servicesDetected,
          contactEmails: l.audit.contactEmails,
          contactEmailsVerified: l.audit.contactEmails.map((email) => ({
            email,
            verified: true,
            verifiedAt: createdAt.toISOString(),
            status: "valid",
          })),
          socialProfiles: {},
          structuredDataPresent: false,
          createdAt,
        },
      });
    }

    await prisma.salesOpportunity.create({
      data: {
        leadId: l.id,
        opportunityScore: l.opp.score,
        // reasonCodes is a flat string[] in the lead detail UI — not objects.
        reasonCodes: l.opp.painPoints,
        whyGoodTarget: l.opp.pitch,
        likelyPainPoints: l.opp.painPoints,
        bestSalesAngle: l.opp.angle,
        suggestedOffer: l.opp.suggestedOffer,
        personalizedFirstMessage: l.opp.firstMessage,
        expectedPriceBand: l.opp.priceBand,
        status: l.pipelineStage === "NEW"
          ? "NEW"
          : l.pipelineStage === "REACHED_OUT"
            ? "CONTACTED"
            : l.pipelineStage === "IN_TALKS"
              ? "INTERESTED"
              : l.pipelineStage === "WON"
                ? "WON"
                : "LOST",
        createdAt,
        updatedAt: createdAt,
      },
    });

    await prisma.watchlistItem.create({
      data: {
        leadId: l.id,
        siteUrl: l.websiteUrl,
        notes: l.notes ?? null,
        selectedOffer: l.opp.suggestedOffer,
        pipelineStage: l.pipelineStage,
        stageOrder: l.stageOrder,
        createdAt,
        updatedAt: createdAt,
      },
    });

    for (const [r, rev] of l.reviews.entries()) {
      const reviewAt = fixedDate(rev.daysAgo);
      await prisma.googleReview.create({
        data: {
          id: `${l.id}_rev_${r + 1}`,
          leadId: l.id,
          authorName: rev.author,
          rating: rev.rating,
          text: rev.text,
          relativeTime: rev.relative,
          publishTime: reviewAt,
          createdAt: reviewAt,
        },
      });
    }

    process.stdout.write(`  [${String(i + 1).padStart(2, "0")}/${LEADS.length}] ${l.businessName} — ${l.opp.score}/100 — ${l.pipelineStage}\n`);
  }

  // 4. Mockups — Bella Vita gets all 3 colour variants for the morph scene.
  // NB: the `htmlContent` field actually stores raw markdown (legacy naming);
  // the /m/[slug] route renders it through renderMockupHtml at request time.
  // We must NOT pre-render here, or the route will double-encode it.
  console.log("\nSeeding hero mockup variants...");
  const heroLead = LEADS[0]!;
  for (const variant of HERO_MOCKUP_VARIANTS) {
    await prisma.mockup.upsert({
      where: { slug: variant.slug },
      create: {
        slug: variant.slug,
        leadId: heroLead.id,
        workspaceId: WORKSPACE_ID,
        htmlContent: HERO_PLAN_MARKDOWN,
        templateId: `video-demo-${variant.variant.toLowerCase()}`,
        isPublic: true,
        viewCount: 0,
      },
      update: {
        htmlContent: HERO_PLAN_MARKDOWN,
        templateId: `video-demo-${variant.variant.toLowerCase()}`,
      },
    });
    console.log(`  ${variant.variant.padEnd(8)} → ${OFFER.conversionLink}${variant.slug}`);
  }

  // 5. Final summary.
  console.log("\n=== Final state ===");
  const counts = await prisma.$transaction([
    prisma.lead.count({ where: { workspaceId: WORKSPACE_ID } }),
    prisma.websiteAudit.count({ where: { lead: { workspaceId: WORKSPACE_ID } } }),
    prisma.salesOpportunity.count({ where: { lead: { workspaceId: WORKSPACE_ID } } }),
    prisma.watchlistItem.count({ where: { lead: { workspaceId: WORKSPACE_ID } } }),
    prisma.googleReview.count({ where: { lead: { workspaceId: WORKSPACE_ID } } }),
    prisma.mockup.count({ where: { workspaceId: WORKSPACE_ID } }),
  ]);
  console.log(`  Leads:           ${counts[0]}`);
  console.log(`  Website audits:  ${counts[1]}`);
  console.log(`  Opportunities:   ${counts[2]}`);
  console.log(`  Watchlist items: ${counts[3]}`);
  console.log(`  Google reviews:  ${counts[4]}`);
  console.log(`  Mockups:         ${counts[5]}`);
  console.log("");
  console.log("Hero lead ID for Steel scenarios:", heroLead.id);
  console.log("Hero mockup slugs:", HERO_MOCKUP_VARIANTS.map((v) => v.slug).join(", "));
  console.log("");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
