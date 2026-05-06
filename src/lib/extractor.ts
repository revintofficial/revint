import type { WebsiteFeatures } from "@/types";
import * as cheerio from "cheerio";
import { detectBookingProvider, extractContactEmails } from "@/lib/audit/booking-detection";
import { extractSocialProfiles } from "@/lib/audit/social-scraper";

// Restaurant niche: QR menu provider patterns.
//
// Round 2 §3.5 split: a single substring search over the entire HTML
// body produces a flood of false positives whenever the page (a) has
// the literal phrase "e-menu" / "emenu" in body copy ("our e-menu is
// coming soon"), or (b) embeds a third-party widget whose URL happens
// to share a 4-6 char substring with one of our short fingerprints.
//
//   • LONG patterns are distinctive enough (≥8 chars, vendor-only) that
//     a fullHtml `includes` match is acceptable. These rarely collide
//     with editorial copy.
//   • SHORT patterns are hostname-only — we only count them when they
//     appear inside an actual `<a href>`'s hostname (or the menuUrl
//     parsed by Cheerio), never in body text.
//
// `e-menu` and `emenu` were the two worst offenders (Round 2 evidence:
// Glass Camden, Camden Roastery, Black Sheep Coffee all flagged
// `detectedMenuTool="E-Menu"` because their pages mentioned the phrase
// in editorial copy or in unrelated widget URLs). They are intentionally
// removed from both lists. If a real `e-menu.com` provider needs to be
// re-introduced, do it as a hostname-only entry in QR_MENU_SHORT_PATTERNS
// AFTER running the pre-flight SQL gate (`scripts/sprint1-preflight.ts`)
// to confirm nothing else collides.
const QR_MENU_LONG_PATTERNS: { pattern: string; label: string }[] = [
  { pattern: "finedinemenu", label: "FineDine" },
  { pattern: "menutiger", label: "MenuTiger" },
  { pattern: "flipmenu", label: "Flipmenu" },
  { pattern: "glorifood", label: "Gloriafood" },
  { pattern: "flipdish", label: "Flipdish" },
  { pattern: "digitalmenu", label: "Digital Menu" },
];

const QR_MENU_SHORT_PATTERNS: { pattern: string; label: string }[] = [
  { pattern: "plumqr", label: "PlumQR" },
  { pattern: "yoello", label: "Yoello" },
  { pattern: "tableqr", label: "TableQR" },
  { pattern: "qr-menu", label: "QR Menu" },
  { pattern: "qrmenu", label: "QR Menu" },
];

const RESERVATION_PATTERNS = [
  "opentable",
  "sevenrooms",
  "resy.com",
  "bookatable",
  "quandoo",
  "fork.com",
  "yelp.com/reservations",
  "tablein",
  "tablecheck",
  "eat-app",
  "restobooking",
];

// Round 2 §3.4 — `hasOnlineReservation` was firing on any body-text
// mention of "OpenTable", "Resy", etc. (LUMI Camden flipped to true
// because the press section quoted a Resy review). We now require the
// pattern to appear inside an actual link's hostname OR href path,
// matching the Path A symmetry already used by `hasBookingSystemFinal`.
function hasReservationHostname(
  links: { href: string }[],
  pattern: string,
): boolean {
  return links.some((l) => {
    const href = l.href || "";
    if (!href) return false;
    try {
      const parsed = new URL(href);
      const host = parsed.hostname.toLowerCase();
      const path = parsed.pathname.toLowerCase();
      // The provider can show up either as a hostname segment
      // (`opentable.com`) or as a path segment of an aggregator
      // (`yelp.com/reservations/...`). Both are real reservation
      // signals; body-only matches are not.
      if (host.includes(pattern)) return true;
      // For multi-segment patterns like "yelp.com/reservations",
      // build the host+path and check inclusion.
      if (pattern.includes("/")) {
        return (host + path).includes(pattern);
      }
      return false;
    } catch {
      return false;
    }
  });
}

const DELIVERY_PATTERNS = [
  "deliveroo",
  "ubereats",
  "uber-eats",
  "justeat",
  "getir",
  "yemeksepeti",
  "talabat",
  "doordash",
  "grubhub",
  "wolt",
  "bolt food",
  "foodpanda",
];

/**
 * Keyword sets scoped to specific business niches.
 * Keys are lowercase GMaps/discovery type strings (or comma-separated aliases).
 * Only the matching set is tested against the page body so we never surface
 * phone-repair words on a plumber's site (or vice-versa).
 */
const NICHE_SERVICE_KEYWORDS: Record<string, string[]> = {
  // Phone / electronics repair & retail
  "phone_repair,electronics_repair,electronics_store,mobile_phone_repair,cell_phone_store": [
    "repair", "fix", "screen", "battery", "unlock", "accessories",
    "buy", "sell", "trade", "refurbished", "case", "charger",
    "iphone", "samsung", "huawei", "pixel", "ipad", "tablet",
    "laptop", "macbook", "data recovery", "water damage",
  ],
  // Plumbing / gas / heating
  "plumber,plumbing,gas_installer,heating_contractor": [
    "boiler", "drain", "pipe", "leak", "radiator", "hot water",
    "central heating", "gas", "blocked drain", "burst pipe",
    "installation", "maintenance", "emergency", "24/7",
  ],
  // Electrician
  "electrician,electrical_contractor": [
    "wiring", "fuse", "socket", "lighting", "consumer unit",
    "rewire", "inspection", "certificate", "installation",
    "fault finding", "emergency", "24/7",
  ],
  // Restaurant / café / food
  "restaurant,cafe,bakery,food": [
    "dine in", "takeaway", "delivery", "reservation", "menu",
    "breakfast", "lunch", "dinner", "catering", "vegan", "vegetarian",
  ],
  // Hair / beauty / barber
  "hair_salon,beauty_salon,barber,spa": [
    "haircut", "colour", "highlights", "balayage", "wax",
    "facial", "manicure", "pedicure", "massage", "eyelash",
    "appointment", "walk-in",
  ],
  // Dental / medical
  "dentist,dental_clinic,doctor,medical_clinic": [
    "appointment", "consultation", "implant", "whitening", "cleaning",
    "check-up", "emergency", "braces", "invisalign",
  ],
  // Cleaning services
  "cleaning_service,house_cleaning,commercial_cleaning": [
    "deep clean", "end of tenancy", "carpet cleaning", "office cleaning",
    "oven clean", "window cleaning", "regular clean",
  ],
  // Automotive / garage
  "car_repair,auto_repair,mechanic,mot": [
    "service", "repair", "mot", "tyres", "brakes", "exhaust",
    "oil change", "diagnostics", "bodywork", "valeting",
  ],
};

// Beta finding §1: BOOKING_KEYWORDS used to be substring-matched
// against the page body, which caused "Facebook" → "book" false
// positives on social-only leads (Black Eye Coffee, Brewed,
// Blackheath Cafe). The new policy uses word-boundary regex AND
// requires multi-signal confirmation: a single keyword inside body
// text is no longer enough — we need either a recognised provider
// fingerprint, JSON-LD reservation markup, or a CTA link whose visible
// text or href anchors the keyword. The keyword list itself stays
// conservative; "book" alone is too noisy to count regardless of
// boundary.
const BOOKING_KEYWORDS = [
  "appointment", "schedule", "reserve", "reservation", "booking",
  "calendly", "acuity", "setmore", "timely", "opentable", "resy",
];

const ECOMMERCE_KEYWORDS = [
  "add to cart", "add to basket", "buy now", "shop now",
  "checkout", "shopping cart", "shopify", "woocommerce",
];

/**
 * Beta finding §1: word-boundary keyword check. The previous
 * `bodyText.includes("book")` implementation matched "Facebook",
 * "notebook", "ebook" and similar substrings on social-only leads,
 * inflating `hasBookingSystem` false positives. Word-boundary regex
 * fixes that without adding any new dependency.
 */
function hasKeywordToken(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}

/**
 * Returns true when JSON-LD on the page declares a Restaurant /
 * LocalBusiness with a `potentialAction.type` of `ReserveAction`
 * (the schema.org marker for online booking systems).
 *
 * Schema.org's structured data is the authoritative signal — a real
 * booking system that publishes JSON-LD is much more reliable than
 * loose substring matches on body text. Used as one of the multiple
 * signals required for `hasBookingSystem = true`.
 */
// `ReturnType<typeof cheerio.load>` resolves to whichever Cheerio API
// type the installed cheerio version exposes; using it directly avoids
// a clash between cheerio@1.x's built-in `CheerioAPI` and the legacy
// `@types/cheerio@0.22.x` shim (which still ships the old `Root` type).
type CheerioRoot = ReturnType<typeof cheerio.load>;

function jsonLdDeclaresReservation($: CheerioRoot): boolean {
  let found = false;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (found) return;
    try {
      const content = $(el).html();
      if (!content) return;
      const parsed: unknown = JSON.parse(content);
      const visit = (obj: unknown): void => {
        if (found || !obj) return;
        if (Array.isArray(obj)) {
          obj.forEach(visit);
          return;
        }
        if (typeof obj !== "object") return;
        const o = obj as Record<string, unknown>;
        const action = o.potentialAction;
        if (action) {
          const flat = Array.isArray(action) ? action : [action];
          for (const a of flat) {
            if (!a || typeof a !== "object") continue;
            const t = (a as Record<string, unknown>)["@type"];
            if (typeof t === "string" && /reserveaction|orderaction/i.test(t)) {
              found = true;
              return;
            }
            if (Array.isArray(t) && t.some((x) => typeof x === "string" && /reserveaction|orderaction/i.test(x))) {
              found = true;
              return;
            }
          }
        }
        Object.values(o).forEach(visit);
      };
      visit(parsed);
    } catch {
      // malformed JSON-LD — silently ignore, the rest of the
      // extractor's structured-data scan will still surface schemaTypes
    }
  });
  return found;
}

const CSS_FRAMEWORKS: [string, string][] = [
  ["tailwind", "tailwindcss"],
  ["bootstrap", "bootstrap"],
  ["bulma", "bulma"],
  ["foundation", "foundation"],
  ["materialize", "materialize"],
  ["semantic-ui", "semantic"],
];

/** Return the keyword list for a given business type, or [] if unrecognised. */
function getServiceKeywords(businessType?: string | null): string[] {
  if (!businessType) return [];
  const needle = businessType.toLowerCase().trim();
  for (const [keyStr, keywords] of Object.entries(NICHE_SERVICE_KEYWORDS)) {
    if (keyStr.split(",").some((k) => needle.includes(k) || k.includes(needle))) {
      return keywords;
    }
  }
  return [];
}

export function extractFeatures(html: string, url: string, businessType?: string | null): WebsiteFeatures {
  const $ = cheerio.load(html);
  const bodyText = $("body").text().toLowerCase();
  const fullHtml = html.toLowerCase();

  const title = $("title").first().text().trim() || null;
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() || null;
  const h1 = $("h1").first().text().trim() || null;

  // Navigation items
  const navItems: { text: string; href: string }[] = [];
  $("nav a, header a, .navbar a, .nav a").each((_, el) => {
    const text = $(el).text().trim();
    const href = $(el).attr("href") || "";
    if (text && text.length < 50) {
      navItems.push({ text, href });
    }
  });

  // All links
  const allLinks: { text: string; href: string }[] = [];
  $("a[href]").each((_, el) => {
    const text = $(el).text().trim();
    const href = $(el).attr("href") || "";
    allLinks.push({ text, href });
  });

  const hasWhatsappLink = allLinks.some(
    (l) =>
      l.href.includes("wa.me") ||
      l.href.includes("whatsapp.com") ||
      l.href.includes("api.whatsapp")
  );

  // Beta finding §1: multi-signal threshold for booking detection.
  //
  // Old behaviour: any substring match anywhere on the page flipped
  // `hasBookingSystem=true`. That produced wildly wrong audits for
  // social-only leads (the social URL gate now blocks those at the
  // crawler level) AND for content sites that just mention the words
  // "booking" or "reservation" in copy (e.g. "we recommend booking a
  // hotel via..."). The new check requires either:
  //   (a) a recognised third-party booking provider fingerprint
  //       (OpenTable, Resy, Calendly, Setmore, ...) — see
  //       `detectBookingProvider`, OR
  //   (b) a CTA link whose visible text or href ANCHORS one of the
  //       narrow keyword set with word boundaries, OR
  //   (c) JSON-LD declares a `ReserveAction` / `OrderAction` on the
  //       business schema.
  //
  // Body-text-only matches no longer count — too many false positives
  // ("we recommend reservations") and the surviving keywords are
  // already strong enough that their presence in a real booking link
  // (a) or (b) catches them. We compute (b) on the link text/href
  // separately so a link like <a href="/reserve">Book now</a> still
  // counts via the keyword anchor.
  const ctaSignalsBooking = allLinks.some((l) => {
    const text = l.text || "";
    const href = l.href || "";
    return BOOKING_KEYWORDS.some(
      (k) => hasKeywordToken(text, k) || hasKeywordToken(href, k),
    );
  });
  const jsonLdReservation = jsonLdDeclaresReservation($);

  const hasEcommerce =
    ECOMMERCE_KEYWORDS.some((k) => bodyText.includes(k)) ||
    !!$('meta[name="shopify-checkout-api-token"]').length ||
    bodyText.includes("woocommerce");

  const hasContactForm =
    $("form").length > 0 &&
    ($('input[type="email"]').length > 0 ||
      $('input[type="tel"]').length > 0 ||
      $("textarea").length > 0);

  const serviceKeywords = getServiceKeywords(businessType);
  const servicesDetected = serviceKeywords.filter((k) => bodyText.includes(k));

  const ctaLinks = allLinks.filter((l) => {
    const t = l.text.toLowerCase();
    return (
      t.includes("contact") ||
      t.includes("call") ||
      t.includes("book") ||
      t.includes("get a quote") ||
      t.includes("free") ||
      t.includes("whatsapp")
    );
  });

  const structuredDataPresent =
    $('script[type="application/ld+json"]').length > 0;

  const isHttps = url.startsWith("https");

  const mobileFriendlyGuess =
    !!$('meta[name="viewport"]').attr("content")?.includes("width=device");

  // --- Extended Audit Fields ---

  // Open Graph
  const hasOpenGraph = $('meta[property^="og:"]').length >= 2;

  // Twitter Cards
  const hasTwitterCards = $('meta[name^="twitter:"]').length >= 1;

  // Favicon
  const hasFavicon =
    $('link[rel="icon"]').length > 0 ||
    $('link[rel="shortcut icon"]').length > 0 ||
    $('link[rel="apple-touch-icon"]').length > 0;

  // PWA Manifest
  const hasManifest = $('link[rel="manifest"]').length > 0;

  // Google Analytics / GTM detection
  const hasGoogleAnalytics =
    fullHtml.includes("googletagmanager.com") ||
    fullHtml.includes("google-analytics.com") ||
    fullHtml.includes("gtag(") ||
    fullHtml.includes("ga('create'");

  // Cookie consent
  const hasCookieConsent =
    fullHtml.includes("cookie-consent") ||
    fullHtml.includes("cookie-banner") ||
    fullHtml.includes("cookieconsent") ||
    fullHtml.includes("gdpr") ||
    fullHtml.includes("cookie-notice") ||
    bodyText.includes("cookie policy") ||
    bodyText.includes("we use cookies");

  // Schema.org types
  const schemaTypes: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const content = $(el).html();
      if (content) {
        const parsed = JSON.parse(content);
        const extractTypes = (obj: Record<string, unknown>) => {
          if (obj["@type"]) {
            const t = obj["@type"];
            if (typeof t === "string") schemaTypes.push(t);
            if (Array.isArray(t)) schemaTypes.push(...t.filter((x): x is string => typeof x === "string"));
          }
        };
        if (Array.isArray(parsed)) {
          parsed.forEach((item: Record<string, unknown>) => extractTypes(item));
        } else {
          extractTypes(parsed);
        }
      }
    } catch {
      // malformed JSON-LD
    }
  });

  // Accessibility issues
  const accessibilityIssues: string[] = [];
  const imagesWithoutAlt = $("img").filter((_, el) => {
    const alt = $(el).attr("alt");
    return alt === undefined || alt === null;
  }).length;
  if (imagesWithoutAlt > 0) {
    accessibilityIssues.push(`${imagesWithoutAlt} image(s) missing alt attribute`);
  }

  const inputsWithoutLabel = $("input:not([type=hidden]):not([type=submit]):not([type=button])").filter((_, el) => {
    const id = $(el).attr("id");
    const ariaLabel = $(el).attr("aria-label");
    const ariaLabelledby = $(el).attr("aria-labelledby");
    if (ariaLabel || ariaLabelledby) return false;
    if (id && $(`label[for="${id}"]`).length > 0) return false;
    if ($(el).closest("label").length > 0) return false;
    return true;
  }).length;
  if (inputsWithoutLabel > 0) {
    accessibilityIssues.push(`${inputsWithoutLabel} input(s) missing label`);
  }

  const h1Count = $("h1").length;
  if (h1Count === 0) accessibilityIssues.push("No h1 element found");
  if (h1Count > 1) accessibilityIssues.push(`Multiple h1 elements (${h1Count})`);

  if (!$("html").attr("lang")) {
    accessibilityIssues.push("Missing lang attribute on html element");
  }

  if ($('a:not([href]), a[href=""], a[href="#"]').length > 3) {
    accessibilityIssues.push("Multiple empty/placeholder links found");
  }

  const semanticEls = ["header", "nav", "main", "footer", "article", "section"];
  const missingSemantic = semanticEls.filter((tag) => $(tag).length === 0);
  if (missingSemantic.length > 3) {
    accessibilityIssues.push(`Missing semantic elements: ${missingSemantic.join(", ")}`);
  }

  // Font detection
  const fontsDetected: string[] = [];
  $('link[href*="fonts.googleapis.com"], link[href*="fonts.gstatic.com"]').each((_, el) => {
    const href = $(el).attr("href") || "";
    const familyMatch = href.match(/family=([^&:]+)/);
    if (familyMatch) {
      familyMatch[1].split("|").forEach((f) => fontsDetected.push(decodeURIComponent(f.replace(/\+/g, " "))));
    }
  });
  if (fontsDetected.length === 0) {
    const fontFaceMatches = fullHtml.match(/@font-face\s*\{[^}]*font-family:\s*['"]?([^'";}]+)/gi);
    if (fontFaceMatches) {
      fontFaceMatches.forEach((m) => {
        const name = m.match(/font-family:\s*['"]?([^'";}]+)/i);
        if (name) fontsDetected.push(name[1].trim());
      });
    }
  }

  // font-display: swap detection
  const hasFontDisplay =
    fullHtml.includes("font-display:swap") ||
    fullHtml.includes("font-display: swap") ||
    fullHtml.includes("display=swap") ||
    $('link[href*="display=swap"]').length > 0;

  // Performance hints
  const performanceHints: string[] = [];
  const largeImagesWithoutLazy = $("img:not([loading])").filter((_, el) => {
    const src = $(el).attr("src") || "";
    return !src.startsWith("data:") && src.length > 0;
  }).length;
  if (largeImagesWithoutLazy > 3) {
    performanceHints.push(`${largeImagesWithoutLazy} images without lazy loading`);
  }

  const renderBlockingStyles = $('link[rel="stylesheet"]:not([media])').length;
  if (renderBlockingStyles > 3) {
    performanceHints.push(`${renderBlockingStyles} render-blocking stylesheets`);
  }

  const inlineScripts = $("script:not([src]):not([type])").length;
  if (inlineScripts > 5) {
    performanceHints.push(`${inlineScripts} inline scripts detected`);
  }

  if (!$('link[rel="preconnect"]').length && !$('link[rel="dns-prefetch"]').length) {
    performanceHints.push("No preconnect or dns-prefetch hints");
  }

  if ($('link[rel="preload"]').length === 0) {
    performanceHints.push("No preload hints for critical resources");
  }

  // Responsive images
  const hasResponsiveImages =
    $("img[srcset]").length > 0 ||
    $("picture source").length > 0 ||
    $("img[sizes]").length > 0;

  // CSS framework detection
  let cssFramework: string | null = null;
  for (const [name, pattern] of CSS_FRAMEWORKS) {
    if (fullHtml.includes(pattern) || $(`link[href*="${pattern}"]`).length > 0) {
      cssFramework = name;
      break;
    }
  }

  // Page count (unique internal links)
  const internalPaths = new Set<string>();
  allLinks.forEach((l) => {
    try {
      const parsed = new URL(l.href, url);
      if (parsed.hostname === new URL(url).hostname) {
        internalPaths.add(parsed.pathname);
      }
    } catch {
      if (l.href.startsWith("/") && !l.href.startsWith("//")) {
        internalPaths.add(l.href.split("?")[0].split("#")[0]);
      }
    }
  });

  // Restaurant niche signals — zero extra HTTP cost, pure DOM parse.
  // LONG patterns (≥8 char vendor names) match against the full HTML;
  // SHORT patterns (≤7 chars, frequent collisions) match only inside
  // an actual <a href> hostname. See QR_MENU_*_PATTERNS for rationale.
  let hasQrMenu = false;
  let detectedMenuTool: string | null = null;
  let menuUrl: string | null = null;

  for (const { pattern, label } of QR_MENU_LONG_PATTERNS) {
    if (fullHtml.includes(pattern)) {
      hasQrMenu = true;
      detectedMenuTool = label;
      const menuLink = allLinks.find(
        (l) =>
          l.href.toLowerCase().includes(pattern) ||
          l.text.toLowerCase().includes("menu")
      );
      if (menuLink) menuUrl = menuLink.href;
      break;
    }
  }

  if (!hasQrMenu) {
    for (const { pattern, label } of QR_MENU_SHORT_PATTERNS) {
      const matchingLink = allLinks.find((l) => {
        const href = (l.href || "").toLowerCase();
        if (!href) return false;
        try {
          const parsed = new URL(href);
          return parsed.hostname.includes(pattern);
        } catch {
          // Relative or malformed hrefs can't be a menu vendor host.
          return false;
        }
      });
      if (matchingLink) {
        hasQrMenu = true;
        detectedMenuTool = label;
        menuUrl = matchingLink.href;
        break;
      }
    }
  }

  // Booking provider + contact emails (used for outreach + segmentation).
  // We resolve `bookingProvider` BEFORE `hasOnlineReservation` so the
  // latter can reuse the same recognised-hostname signal — Path A of the
  // multi-signal symmetry.
  const linksForDetection = allLinks.map((l) => ({ href: l.href }));
  const bookingProvider = detectBookingProvider({ html, links: linksForDetection });
  const contactEmails = extractContactEmails({ html, links: linksForDetection });

  // P0.5 - extended social profile scraping (IG, FB, LinkedIn, TikTok, YouTube, Twitter/X, WhatsApp, Pinterest)
  const socialProfiles = extractSocialProfiles({ html, links: linksForDetection });

  // Round 2 §3.4 — multi-signal `hasOnlineReservation`, symmetric with
  // `hasBookingSystemFinal` below. A recognised provider hostname OR
  // (JSON-LD reservation marker AND CTA link with a booking keyword)
  // is required. Body-text mentions alone are no longer trusted.
  const hasOnlineReservation =
    bookingProvider !== null ||
    RESERVATION_PATTERNS.some((p) => hasReservationHostname(allLinks, p)) ||
    (jsonLdReservation && ctaSignalsBooking);
  const hasDeliveryIntegration = DELIVERY_PATTERNS.some((p) => fullHtml.includes(p));

  // Beta finding §1: multi-signal final decision. A specific provider
  // fingerprint is the strongest signal and stands alone. Without one,
  // we require BOTH the JSON-LD reservation marker AND a CTA link with
  // a booking keyword — either signal in isolation is too noisy to
  // trust. See `BOOKING_KEYWORDS`, `jsonLdDeclaresReservation`, and
  // the audit booking-detection helper for the underlying signals.
  const hasBookingSystemFinal =
    bookingProvider !== null ||
    (jsonLdReservation && ctaSignalsBooking);

  return {
    url,
    reachable: true,
    httpStatus: null,
    crawlError: null,
    loadTimeMs: null,
    https: isHttps,
    mobileFriendlyGuess,
    title,
    metaDescription,
    h1,
    hasContactForm,
    hasWhatsappLink,
    hasBookingSystem: hasBookingSystemFinal,
    hasEcommerce,
    servicesDetected,
    navItems: navItems.slice(0, 20),
    ctaLinks: ctaLinks.slice(0, 10),
    brokenLinksCount: 0,
    structuredDataPresent,
    contactEmails,
    bookingProvider,
    socialProfiles,
    hasQrMenu,
    detectedMenuTool,
    menuUrl,
    hasOnlineReservation,
    hasDeliveryIntegration,

    hasOpenGraph,
    hasTwitterCards,
    hasFavicon,
    hasManifest,
    hasServiceWorker: false, // Set by crawler via Playwright
    hasGoogleAnalytics,
    hasCookieConsent,
    hasResponsiveImages,
    hasFontDisplay,
    securityHeaders: {
      hasCSP: false,
      hasXFrameOptions: false,
      hasXContentTypeOptions: false,
      hasReferrerPolicy: false,
      hasHSTS: false,
      hasXXSSProtection: false,
      hasPermissionsPolicy: false,
    }, // Set by crawler via response headers
    schemaTypes: [...new Set(schemaTypes)],
    accessibilityIssues,
    fontsDetected: [...new Set(fontsDetected)],
    performanceHints,
    cssFramework,
    pageCount: internalPaths.size,
    consoleErrors: [], // Set by crawler via Playwright
  };
}
