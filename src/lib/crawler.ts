import { chromium, type Browser, type Page } from "playwright";
import { extractFeatures } from "./extractor";
import { assertSafeFetchUrl } from "./url-guard";
import { detectSocialMediaPlatform } from "./audit/social-url-gate";
import type { CrawlError, SecurityHeadersResult, WebsiteFeatures } from "@/types";

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browserInstance;
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

// Round 2 §3.7 — narrow expired/parked-domain heuristic. Three signals,
// any one of which is enough:
//   1. Title matches the parking phrase regex. The phrases are
//      *deliberately specific* — bare "expired" matches body copy
//      like "Coffee shop expired its menu" and is a smoke-test
//      regression we caught in Sprint 1. The list anchors each token
//      to a vendor-fingerprint phrase ("Website Expired",
//      "Domain Expired", parking lander text, etc.).
//   2. The final response URL's hostname matches one of the well-known
//      parking / for-sale hosts (GoDaddy, Sedo, Bodis, plus the
//      Squarespace and Wix expired-domain landings).
//   3. The HTML body contains a vendor's own expired-page fingerprint
//      (e.g. Squarespace's `<title>Squarespace - Website Expired</title>`
//      followed by their canonical "renew this domain" copy).
const EXPIRED_TITLE_RE =
  /\b(?:website expired|domain expired|account (?:has been )?suspended|page unavailable|this domain is parked|domain (?:is )?for sale|domain for sale|parked domain|coming soon)\b/i;

const EXPIRED_HOST_HINTS: string[] = [
  "domaincontrol.com",       // GoDaddy parking
  "sedo.com",                 // Sedo for-sale lander
  "sedoparking.com",
  "bodis.com",                // Bodis parking
  "parkingcrew.net",
  "above.com",                // Above (Snapnames / NameJet) parking
  "registrar-servers.com",
];

const EXPIRED_BODY_HINTS: RegExp[] = [
  /squarespace[\s\S]{0,40}website expired/i,
  /this domain is for sale/i,
  /buy this domain/i,
  /renew (?:this )?domain/i,
  /godaddy[\s\S]{0,40}(expired|parked)/i,
  /wix[\s\S]{0,40}(expired|unavailable)/i,
];

/**
 * Round 2 §3.5 — exported for the Sprint 1 smoke-test runner so the
 * detection logic can be exercised against synthetic fixtures
 * without booting a Playwright browser. The crawler's own call site
 * (`classifyCrawlError`) consumes this directly.
 */
export function detectExpiredOrParked(
  title: string | null,
  finalUrl: string | null,
  html: string,
): boolean {
  if (title && EXPIRED_TITLE_RE.test(title)) return true;
  if (finalUrl) {
    try {
      const host = new URL(finalUrl).hostname.toLowerCase();
      if (EXPIRED_HOST_HINTS.some((h) => host.endsWith(h))) return true;
    } catch {
      // ignore — falls through to body hints
    }
  }
  if (html && EXPIRED_BODY_HINTS.some((re) => re.test(html))) return true;
  return false;
}

function extractSecurityHeaders(headers: Record<string, string>): SecurityHeadersResult {
  const lowerHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    lowerHeaders[k.toLowerCase()] = v;
  }

  return {
    hasCSP: "content-security-policy" in lowerHeaders,
    hasXFrameOptions: "x-frame-options" in lowerHeaders,
    hasXContentTypeOptions: "x-content-type-options" in lowerHeaders,
    hasReferrerPolicy: "referrer-policy" in lowerHeaders,
    hasHSTS: "strict-transport-security" in lowerHeaders,
    hasXXSSProtection: "x-xss-protection" in lowerHeaders,
    hasPermissionsPolicy: "permissions-policy" in lowerHeaders,
  };
}

/**
 * Phase 0/B1 — error tag inference.
 *
 * The previous implementation zeroed every audit field whenever
 * `response.ok()` was false (i.e. anything outside 200-299). This
 * marked LOTS of legitimate sites as "unreachable" because:
 *  - 401/403 from Cloudflare bot challenge to Playwright UA
 *  - 15s timeout on slower hosting (genuinely reachable to humans)
 *  - 3xx redirect loops where each hop responded but final was non-2xx
 *
 * The new policy: classify the failure, retry once on transient
 * conditions, and on persistent failure surface a partial result that
 * still includes whatever useful HTML we did manage to grab. That way
 * the FineDine SDR sees "Site responded 403 — open manually" instead
 * of "Reachable: No / Title: — / Mobile Friendly: No".
 */
function classifyError(message: string): CrawlError {
  const m = message.toLowerCase();
  if (m.includes("timeout")) return "TIMEOUT";
  if (m.includes("dns") || m.includes("err_name_not_resolved")) return "DNS_ERROR";
  if (
    m.includes("ssl") ||
    m.includes("certificate") ||
    m.includes("tls") ||
    m.includes("err_cert")
  ) return "TLS_ERROR";
  if (m.includes("redirect")) return "REDIRECT_LOOP";
  if (m.includes("crash") || m.includes("closed")) return "PLAYWRIGHT_CRASH";
  return "UNKNOWN";
}

const NAV_TIMEOUT_MS = 25_000;
const RETRY_DELAY_MS = 4_000;

export async function crawlWebsite(
  url: string,
  businessType?: string | null,
): Promise<WebsiteFeatures> {
  // Beta finding §1: gate social-media-only URLs BEFORE the SSRF check.
  // When a lead has no real website, the discovery worker stores the
  // venue's IG/FB profile in `websiteUrl`. Loading the page through
  // Playwright then surfaces social-platform chrome to the extractor,
  // which keyword-matches "book" / "shop" / "menu" inside it and writes
  // a wildly wrong audit row. The gate returns SOCIAL_MEDIA_ONLY so
  // the website-auditor adapter can flip `Lead.hasWebsite=false` and
  // the UI can render a specific "Instagram only — no website" badge
  // instead of a misleading "no booking" / "no e-commerce" verdict.
  const socialPlatform = detectSocialMediaPlatform(url);
  if (socialPlatform) {
    const result = createUnreachableResult(url, "SOCIAL_MEDIA_ONLY", null, socialPlatform);
    return result;
  }

  // C2 fix - SSRF guard at the entry. Crawl callers pass URLs that
  // came from Google Places, lead enrichment, or operator input;
  // none are trusted enough to skip a redirect-aware private-address
  // check. assertSafeFetchUrl rejects:
  //   - non-http(s) protocols (file://, gopher://)
  //   - loopback / link-local / RFC1918 / cgnat / multicast
  //   - DNS-rebinding-style hostnames (resolves to private)
  //   - "metadata.google.internal" + .local + .internal
  // The guard at crawlOnce's `route()` interceptor enforces the same
  // policy on every redirect hop the navigation triggers, so a
  // public host that 302s into 169.254.169.254 still gets blocked.
  try {
    await assertSafeFetchUrl(url);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return createUnreachableResult(url, "BLOCKED_BY_GUARD", null, detail);
  }

  let last: WebsiteFeatures = await crawlOnce(url, businessType);
  const transient: CrawlError[] = ["TIMEOUT", "PLAYWRIGHT_CRASH"];
  if (
    !last.reachable &&
    last.crawlError &&
    transient.includes(last.crawlError)
  ) {
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    last = await crawlOnce(url, businessType);
  }
  return last;
}

async function crawlOnce(url: string, businessType?: string | null): Promise<WebsiteFeatures> {
  const browser = await getBrowser();
  let page: Page | null = null;
  // Set by the route interceptor when a redirect hop is rejected; the
  // catch block below uses it to surface BLOCKED_BY_GUARD instead of
  // the generic page.goto error message ("Request was aborted by the
  // browser") that Playwright produces.
  let blockedHop: { url: string; reason: string } | null = null;

  try {
    page = await browser.newPage({
      // Modern desktop UA. Many WAFs reject the default Playwright UA;
      // a real Chrome 120 string slips past most of them.
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 720 },
      // Bot-protection bypass: accept downloads false, do not honour
      // CSP that blocks our injected scripts (we don't inject any but
      // some WAFs trip on Playwright's instrumentation).
      acceptDownloads: false,
      bypassCSP: true,
      ignoreHTTPSErrors: true,
      locale: "en-US",
    });

    // C2 - SSRF redirect-chain guard. Validate every navigation hop
    // (initial nav + each 30x follow) against the same private-
    // address policy assertSafeFetchUrl uses for direct fetches. We
    // only intercept top-frame navigations: sub-resources (images,
    // scripts, XHR) typically hit CDNs and blocking them would break
    // legitimate audits. The threat model here is "lead's domain
    // 302s to internal metadata service"; restricting the navigation
    // chain covers it.
    await page.route("**/*", async (route, request) => {
      if (!request.isNavigationRequest()) {
        return route.continue();
      }
      try {
        await assertSafeFetchUrl(request.url());
      } catch (err) {
        blockedHop = {
          url: request.url(),
          reason: err instanceof Error ? err.message : String(err),
        };
        return route.abort("blockedbyclient");
      }
      return route.continue();
    });

    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text().slice(0, 200));
      }
    });

    const startTime = Date.now();

    // `load` (full document) is more reliable than `domcontentloaded`
    // for SPAs that hydrate after DOMContentLoaded. Worst case we wait
    // up to NAV_TIMEOUT_MS but the load event usually fires earlier.
    let response: Awaited<ReturnType<Page["goto"]>>;
    try {
      response = await page.goto(url, {
        waitUntil: "load",
        timeout: NAV_TIMEOUT_MS,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // If the route interceptor rejected a hop, prefer that over the
      // generic abort message. The original requested URL stays in
      // `url` for the result so callers see what they asked for, and
      // the blocked hop's reason goes into the detail field.
      if (blockedHop) {
        // TS narrows blockedHop to null (async callback assignment not tracked);
        // cast to escape the false-negative never type.
        const hop = blockedHop as { url: string; reason: string };
        return createUnreachableResult(
          url,
          "BLOCKED_BY_GUARD",
          null,
          `Redirect to ${hop.url} blocked: ${hop.reason}`,
        );
      }
      const tag = classifyError(message);
      return createUnreachableResult(url, tag, null, message);
    }

    const loadTimeMs = Date.now() - startTime;

    if (!response) {
      return createUnreachableResult(url, "EMPTY_RESPONSE", null, "no response object");
    }

    const status = response.status();

    // Phase 0/B1 — DO NOT abort on non-2xx. We still want the HTML the
    // server sent (e.g. a 403 page, a custom 404, a 500 error page) so
    // the audit shows "site responds with 403" instead of zeroing every
    // field. We only abort on 5xx because those usually mean nothing
    // useful was rendered.
    if (status >= 500) {
      return createUnreachableResult(url, "SERVER_5XX", status, `HTTP ${status}`);
    }

    // Allow time for client-side JS to render content above the fold.
    await page.waitForTimeout(2000);

    const responseHeaders = response.headers();
    const securityHeaders = extractSecurityHeaders(responseHeaders);

    const html = await page.content();

    // If the body is empty (e.g. SPA that needs longer hydration) and
    // status is 2xx/3xx, treat as a thin reachable result rather than
    // an unreachable error — the URL DID respond.
    if (!html || html.length < 50) {
      return createPartialResult(url, status, "EMPTY_RESPONSE", loadTimeMs);
    }

    const features = extractFeatures(html, url, businessType);
    features.loadTimeMs = loadTimeMs;
    features.securityHeaders = securityHeaders;
    features.consoleErrors = consoleErrors.slice(0, 10);
    features.httpStatus = status;

    // Round 2 §3.7 — domain expired / parked / for-sale detection.
    //
    // Fable and Falcon (Round 2) was a `404 Squarespace - Website
    // Expired` page; the previous classifier flagged it as `UNKNOWN`
    // and the opener still said "sitenizi inceledim". We now lift that
    // signal into a first-class `WEBSITE_EXPIRED` crawlError so the UI
    // shows a "domain expired — open it manually" hint and the opener
    // (Hafta 2 PR-W2.E) can route into the NO_WEBSITE branch.
    //
    // Detection is deliberately narrow: a strict title regex anchored
    // on the parking phrase, plus a small list of known parking-host
    // hints. Body-text mentions of "expired" alone do NOT trigger the
    // tag — that would re-introduce false positives the Fable opener
    // already burned us on.
    const finalUrl = (() => {
      try {
        return response.url();
      } catch {
        return url;
      }
    })();
    const isExpiredOrParked = detectExpiredOrParked(
      features.title,
      finalUrl,
      html,
    );

    if (status >= 400) {
      if (isExpiredOrParked) {
        features.crawlError = "WEBSITE_EXPIRED";
      } else if (status === 401 || status === 403) {
        features.crawlError = "BOT_BLOCKED_4XX";
      } else {
        features.crawlError = "UNKNOWN";
      }
      features.reachable = false; // strict definition kept for sales-confidence rollup
    } else if (isExpiredOrParked) {
      // Some parked-domain providers serve a 200 OK page with the
      // "Website Expired" copy. Still treat as expired even though the
      // status was 2xx/3xx — the audit body is meaningless either way.
      features.crawlError = "WEBSITE_EXPIRED";
      features.reachable = false;
    } else {
      features.crawlError = null;
      features.reachable = true;
    }

    try {
      features.hasServiceWorker = await page.evaluate(() => {
        return "serviceWorker" in navigator &&
          navigator.serviceWorker.controller !== null;
      });
    } catch {
      features.hasServiceWorker = false;
    }

    // Mobile-friendliness check — keep the existing viewport-meta heuristic.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1000);
    const mobileHtml = await page.content();
    const hasViewportMeta = /<meta[^>]+name=["']viewport["']/i.test(mobileHtml) ||
      mobileHtml.includes("width=device");
    features.mobileFriendlyGuess = hasViewportMeta;

    return features;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const tag = classifyError(message);
    console.error(`Crawl failed for ${url}:`, message);
    return createUnreachableResult(url, tag, null, message);
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
  }
}

function createUnreachableResult(
  url: string,
  crawlError: CrawlError,
  httpStatus: number | null,
  _detail: string,
): WebsiteFeatures {
  return {
    url,
    reachable: false,
    httpStatus,
    crawlError,
    loadTimeMs: null,
    https: url.startsWith("https"),
    mobileFriendlyGuess: false,
    title: null,
    metaDescription: null,
    h1: null,
    hasContactForm: false,
    hasWhatsappLink: false,
    hasBookingSystem: false,
    hasEcommerce: false,
    servicesDetected: [],
    navItems: [],
    ctaLinks: [],
    brokenLinksCount: 0,
    structuredDataPresent: false,
    hasOpenGraph: false,
    hasTwitterCards: false,
    hasFavicon: false,
    hasManifest: false,
    hasServiceWorker: false,
    hasGoogleAnalytics: false,
    hasCookieConsent: false,
    hasResponsiveImages: false,
    hasFontDisplay: false,
    securityHeaders: {
      hasCSP: false,
      hasXFrameOptions: false,
      hasXContentTypeOptions: false,
      hasReferrerPolicy: false,
      hasHSTS: false,
      hasXXSSProtection: false,
      hasPermissionsPolicy: false,
    },
    schemaTypes: [],
    accessibilityIssues: [],
    fontsDetected: [],
    performanceHints: [],
    cssFramework: null,
    pageCount: 0,
    consoleErrors: [],
    contactEmails: [],
    bookingProvider: null,
  };
}

function createPartialResult(
  url: string,
  httpStatus: number,
  crawlError: CrawlError,
  loadTimeMs: number,
): WebsiteFeatures {
  const base = createUnreachableResult(url, crawlError, httpStatus, "partial");
  return {
    ...base,
    loadTimeMs,
    // Reachable in the sense that the server responded; consumers
    // can still check `crawlError` to see this was a thin response.
    reachable: httpStatus < 400,
  };
}
