import { chromium, type Browser, type Page } from "playwright";
import { extractFeatures } from "./extractor";
import type { WebsiteFeatures } from "@/types";

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

export async function crawlWebsite(url: string): Promise<WebsiteFeatures> {
  const browser = await getBrowser();
  let page: Page | null = null;

  try {
    page = await browser.newPage({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 720 },
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

    const html = await page.content();

    const features = extractFeatures(html, url);
    features.loadTimeMs = loadTimeMs;

    // Mobile-friendliness: re-check with mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1000);
    const mobileHtml = await page.content();
    const hasViewportMeta = mobileHtml.includes('width=device');
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
  };
}
