import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo/metadata";

/**
 * Crawler policy for Leadac AI.
 *
 * Priorities:
 *  1. Let Googlebot and Bingbot index everything that can be indexed.
 *  2. Keep /app/, /api/, /auth/, /m/ and query-string crawl traps out.
 *  3. Advertise every sitemap in the index so crawlers can parallelize.
 *  4. Throttle aggressive bots that eat crawl budget without ranking us.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = SITE.url;

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api/indexnow-key"],
        disallow: [
          "/app/",
          "/api/",
          "/auth/",
          "/m/",
          "/*?utm_*",
          "/*?gclid=*",
          "/*?fbclid=*",
          "/*?ref=*",
        ],
      },
      // AhrefsBot, SemrushBot and MJ12bot love directory sites. Let them
      // through at a throttled rate so we still show up in backlink tools
      // but don't chew through our crawl budget.
      {
        userAgent: "AhrefsBot",
        allow: ["/"],
        disallow: ["/app/", "/api/", "/auth/", "/m/"],
        crawlDelay: 10,
      },
      {
        userAgent: "SemrushBot",
        allow: ["/"],
        disallow: ["/app/", "/api/", "/auth/", "/m/"],
        crawlDelay: 10,
      },
      {
        userAgent: "MJ12bot",
        allow: ["/"],
        disallow: ["/app/", "/api/", "/auth/", "/m/"],
        crawlDelay: 10,
      },
    ],
    sitemap: [
      `${baseUrl}/sitemap.xml`,
    ],
    host: baseUrl,
  };
}
