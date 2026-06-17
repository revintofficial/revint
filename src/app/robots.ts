import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo/metadata";

/**
 * Crawler policy for Revint.
 *
 * brand-assets §7.1 Task 1 mandates that every major AI crawler (GPTBot,
 * ChatGPT-User, ClaudeBot, PerplexityBot, Google-Extended, Applebot-Extended,
 * Bingbot) is explicitly allowed at `/`. AEO/GEO depends on this — being
 * silently blocked is the single most common reason LLMs stop citing a site.
 *
 * Priorities:
 *  1. Allow Googlebot, Bingbot, and every AI crawler to index every public
 *     `(site)/*` and `(public)/*` route.
 *  2. Keep `/app/`, `/api/`, `/auth/`, `/m/` and query-string crawl traps out.
 *  3. Throttle backlink-tool bots that eat budget without ranking us.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = SITE.url;

  const publicDisallow = [
    "/app/",
    "/api/",
    "/auth/",
    "/m/",
    "/*?utm_*",
    "/*?gclid=*",
    "/*?fbclid=*",
    "/*?ref=*",
  ];

  // AI crawlers — every one of these explicitly allowed per brand-assets §7.1
  // Task 1. Listed individually instead of via "*" because AEO research shows
  // some LLM crawlers ignore the wildcard rule and look only for their own
  // user-agent record.
  const aiCrawlers = [
    "GPTBot",
    "ChatGPT-User",
    "OAI-SearchBot",
    "ClaudeBot",
    "Claude-Web",
    "anthropic-ai",
    "PerplexityBot",
    "Perplexity-User",
    "Google-Extended",
    "Applebot-Extended",
    "Bingbot",
    "DuckDuckBot",
    "YouBot",
    "Amazonbot",
    "cohere-ai",
    "Meta-ExternalAgent",
    "Meta-ExternalFetcher",
  ];

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api/indexnow-key"],
        disallow: publicDisallow,
      },
      ...aiCrawlers.map((userAgent) => ({
        userAgent,
        allow: ["/"],
        disallow: publicDisallow,
      })),
      // Backlink-tool bots — let them through at a throttled rate so we still
      // show up in their reports without chewing crawl budget.
      {
        userAgent: "AhrefsBot",
        allow: ["/"],
        disallow: publicDisallow,
        crawlDelay: 10,
      },
      {
        userAgent: "SemrushBot",
        allow: ["/"],
        disallow: publicDisallow,
        crawlDelay: 10,
      },
      {
        userAgent: "MJ12bot",
        allow: ["/"],
        disallow: publicDisallow,
        crawlDelay: 10,
      },
    ],
    sitemap: [`${baseUrl}/sitemap.xml`],
    host: baseUrl,
  };
}
