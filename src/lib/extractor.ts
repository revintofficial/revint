import type { WebsiteFeatures } from "@/types";
import * as cheerio from "cheerio";
import { detectBookingProvider, extractContactEmails } from "@/lib/audit/booking-detection";
import { extractSocialProfiles } from "@/lib/audit/social-scraper";

const SERVICE_KEYWORDS = [
  "repair", "fix", "screen", "battery", "unlock", "accessories",
  "buy", "sell", "trade", "refurbished", "case", "charger",
  "iphone", "samsung", "huawei", "pixel", "ipad", "tablet",
  "laptop", "macbook", "data recovery", "water damage",
];

const BOOKING_KEYWORDS = [
  "book", "appointment", "schedule", "reserve", "booking",
  "calendly", "acuity", "setmore", "timely",
];

const ECOMMERCE_KEYWORDS = [
  "add to cart", "add to basket", "buy now", "shop now",
  "checkout", "shopping cart", "shopify", "woocommerce", "price",
];

const CSS_FRAMEWORKS: [string, string][] = [
  ["tailwind", "tailwindcss"],
  ["bootstrap", "bootstrap"],
  ["bulma", "bulma"],
  ["foundation", "foundation"],
  ["materialize", "materialize"],
  ["semantic-ui", "semantic"],
];

export function extractFeatures(html: string, url: string): WebsiteFeatures {
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

  const hasBookingSystem =
    allLinks.some((l) =>
      BOOKING_KEYWORDS.some(
        (k) =>
          l.text.toLowerCase().includes(k) ||
          l.href.toLowerCase().includes(k)
      )
    ) || BOOKING_KEYWORDS.some((k) => bodyText.includes(k));

  const hasEcommerce =
    ECOMMERCE_KEYWORDS.some((k) => bodyText.includes(k)) ||
    !!$('meta[name="shopify-checkout-api-token"]').length ||
    bodyText.includes("woocommerce");

  const hasContactForm =
    $("form").length > 0 &&
    ($('input[type="email"]').length > 0 ||
      $('input[type="tel"]').length > 0 ||
      $("textarea").length > 0);

  const servicesDetected = SERVICE_KEYWORDS.filter((k) => bodyText.includes(k));

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

  // Booking provider + contact emails (used for outreach + segmentation)
  const linksForDetection = allLinks.map((l) => ({ href: l.href }));
  const bookingProvider = detectBookingProvider({ html, links: linksForDetection });
  const contactEmails = extractContactEmails({ html, links: linksForDetection });

  // P0.5 - extended social profile scraping (IG, FB, LinkedIn, TikTok, YouTube, Twitter/X, WhatsApp, Pinterest)
  const socialProfiles = extractSocialProfiles({ html, links: linksForDetection });

  // Strengthen the boolean: keyword-based detection misses iframes, provider
  // detection catches them. If either says yes, we say yes.
  const hasBookingSystemFinal = hasBookingSystem || bookingProvider !== null;

  return {
    url,
    reachable: true,
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
