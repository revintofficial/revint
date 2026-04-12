import type { WebsiteFeatures } from "@/types";
import * as cheerio from "cheerio";

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

export function extractFeatures(html: string, url: string): WebsiteFeatures {
  const $ = cheerio.load(html);
  const bodyText = $("body").text().toLowerCase();

  const title = $("title").first().text().trim() || null;
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() || null;
  const h1 = $("h1").first().text().trim() || null;

  const navItems: { text: string; href: string }[] = [];
  $("nav a, header a, .navbar a, .nav a").each((_, el) => {
    const text = $(el).text().trim();
    const href = $(el).attr("href") || "";
    if (text && text.length < 50) {
      navItems.push({ text, href });
    }
  });

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
    hasBookingSystem,
    hasEcommerce,
    servicesDetected,
    navItems: navItems.slice(0, 20),
    ctaLinks: ctaLinks.slice(0, 10),
    brokenLinksCount: 0,
    structuredDataPresent,
  };
}
