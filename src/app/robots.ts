import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://leadengine.app";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        // App shell, API, and auth callback paths have no indexable content
        // and leaking them just wastes crawl budget. Opt-in indexable routes
        // live under /, /pricing, /for/*, /legal/*, and /b/*.
        disallow: ["/app/", "/api/", "/auth/", "/m/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
