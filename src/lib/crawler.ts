import { chromium, type Browser, type Page } from "playwright";
import { extractFeatures } from "./extractor";
import type { SecurityHeadersResult, WebsiteFeatures } from "@/types";

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

export async function crawlWebsite(url: string): Promise<WebsiteFeatures> {
  const browser = await getBrowser();
  let page: Page | null = null;

  try {
    page = await browser.newPage({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 720 },
    });

    // Collect console errors
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text().slice(0, 200));
      }
    });

    const startTime = Date.now();

    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    const loadTimeMs = Date.now() - startTime;

    if (!response || !response.ok()) {
      return createUnreachableResult(url);
    }

    await page.waitForTimeout(2000);

    // Extract security headers from response
    const responseHeaders = response.headers();
    const securityHeaders = extractSecurityHeaders(responseHeaders);

    const html = await page.content();

    const features = extractFeatures(html, url);
    features.loadTimeMs = loadTimeMs;
    features.securityHeaders = securityHeaders;
    features.consoleErrors = consoleErrors.slice(0, 10);

    // Check for Service Worker registration
    try {
      features.hasServiceWorker = await page.evaluate(() => {
        return "serviceWorker" in navigator &&
          navigator.serviceWorker.controller !== null;
      });
    } catch {
      features.hasServiceWorker = false;
    }

    // Mobile-friendliness: re-check with mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1000);
    const mobileHtml = await page.content();
    const hasViewportMeta = mobileHtml.includes("width=device");
    features.mobileFriendlyGuess = hasViewportMeta;

    return features;
  } catch (error) {
    console.error(`Crawl failed for ${url}:`, error);
    return createUnreachableResult(url);
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
  }
}

function createUnreachableResult(url: string): WebsiteFeatures {
  return {
    url,
    reachable: false,
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
