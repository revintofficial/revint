import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

/**
 * Sitemap for crawlable pages:
 *   - Marketing pages (hard-coded; change here when routes are added)
 *   - Public lead profiles for workspaces that opted in and whose leads
 *     have been analyzed
 *
 * Returns at most 50k entries (Google's hard limit). For multi-workspace
 * scale we will need per-workspace sitemap index files, but a single file
 * is fine up to that threshold.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://leadac.ai";

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, changeFrequency: "weekly", priority: 1.0 },
    { url: `${baseUrl}/pricing`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/for/agencies`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/for/smma`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/for/walk-in-web-agencies`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/partners`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/legal/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/legal/terms`, changeFrequency: "yearly", priority: 0.3 },
  ];

  let publicLeads: Array<{
    id: string;
    borough: string | null;
    businessName: string;
    updatedAt: Date;
  }> = [];

  try {
    publicLeads = await prisma.lead.findMany({
      where: {
        analyzeStatus: "ANALYZED",
        workspace: { publicProfilesEnabled: true },
      },
      select: {
        id: true,
        borough: true,
        businessName: true,
        updatedAt: true,
      },
      take: 49_000,
      orderBy: { updatedAt: "desc" },
    });
  } catch {
    // DB unreachable at build time (e.g. static generation with no network)
    // - return just the static routes rather than failing the build.
    publicLeads = [];
  }

  const leadRoutes: MetadataRoute.Sitemap = publicLeads.map((lead) => {
    const citySlug = slugify(lead.borough || "unknown");
    const idSuffix = lead.id.slice(-6);
    const businessSlug = `${slugify(lead.businessName)}-${idSuffix}`;
    return {
      url: `${baseUrl}/b/${citySlug}/${businessSlug}`,
      lastModified: lead.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    };
  });

  return [...staticRoutes, ...leadRoutes];
}
