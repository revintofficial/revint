import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo/metadata";
import {
  getPublicCities,
  getPublicNiches,
  listAllPublicBusinesses,
  countPublicBusinesses,
} from "@/lib/seo/programmatic";
import { POSTS } from "@/content/blog";
import { GLOSSARY } from "@/content/site/glossary";
import { RESOURCES } from "@/content/site/resources";
import { VERTICALS } from "@/content/site/verticals";
import { TOOLS } from "@/content/site/tools";

/**
 * Chunked sitemap index via Next.js generateSitemaps().
 *
 * Crawler hits `/sitemap.xml` → Next emits the index → each chunk lives at
 * `/sitemap/{id}.xml`. robots.ts advertises the index URL.
 *
 * Chunks we emit:
 *   - core        : (site)/* pages + legal
 *   - cities      : /cities/* (programmatic directory)
 *   - niches      : /niches/* + /niches/{v}/{c} (programmatic directory)
 *   - compare     : /vs/* + /alternatives/* (real (site) pages only)
 *   - blog        : /blog + /blog/[slug]
 *   - glossary    : /glossary + /glossary/[slug]
 *   - businesses-N: chunks of BUSINESSES_PER_CHUNK for /b/* routes
 */

const BUSINESSES_PER_CHUNK = 45_000;
const BASE = SITE.url;

type ChunkId =
  | "core"
  | "cities"
  | "niches"
  | "compare"
  | "blog"
  | "glossary"
  | `businesses-${number}`;

export async function generateSitemaps(): Promise<{ id: ChunkId }[]> {
  const fixed: { id: ChunkId }[] = [
    { id: "core" },
    { id: "compare" },
    { id: "blog" },
    { id: "glossary" },
    { id: "cities" },
    { id: "niches" },
  ];

  let total = 0;
  try {
    total = await countPublicBusinesses();
  } catch {
    total = 0;
  }
  if (total === 0) return fixed;

  const businessChunks = Math.max(1, Math.ceil(total / BUSINESSES_PER_CHUNK));
  const businessIds: { id: ChunkId }[] = Array.from(
    { length: businessChunks },
    (_, i) => ({ id: `businesses-${i}` as ChunkId }),
  );

  return [...fixed, ...businessIds];
}

export default async function sitemap({
  id,
}: {
  id: ChunkId;
}): Promise<MetadataRoute.Sitemap> {
  if (id === "core") return coreSitemap();
  if (id === "compare") return compareSitemap();
  if (id === "blog") return blogSitemap();
  if (id === "glossary") return glossarySitemap();
  if (id === "cities") return citiesSitemap();
  if (id === "niches") return nichesSitemap();

  if (typeof id === "string" && id.startsWith("businesses-")) {
    const idx = Number(id.replace("businesses-", ""));
    return businessesSitemap(idx);
  }

  return [];
}

function coreSitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, changeFrequency: "weekly", priority: 1.0 },
    { url: `${BASE}/manifesto`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/pricing`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/demo`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/about`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/security`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/changelog`, changeFrequency: "weekly", priority: 0.5 },

    { url: `${BASE}/for`, changeFrequency: "monthly", priority: 0.7 },
    ...VERTICALS.map((v) => ({
      url: `${BASE}/for/${v.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),

    { url: `${BASE}/integrations`, changeFrequency: "monthly", priority: 0.6 },
    {
      url: `${BASE}/integrations/hubspot`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE}/integrations/smartlead`,
      changeFrequency: "monthly",
      priority: 0.6,
    },

    { url: `${BASE}/tools`, changeFrequency: "weekly", priority: 0.7 },
    ...TOOLS.map((t) => ({
      url: `${BASE}/tools/${t.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),

    { url: `${BASE}/resources`, changeFrequency: "weekly", priority: 0.7 },
    ...RESOURCES.map((r) => ({
      url: `${BASE}/resources/${r.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
      lastModified: new Date(r.publishedAt),
    })),

    {
      url: `${BASE}/legal/privacy`,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    { url: `${BASE}/legal/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];
}

function compareSitemap(): MetadataRoute.Sitemap {
  // Only the (site) routes that actually exist today.
  const vsSlugs = ["apollo-clay-gong", "apollo", "clay", "gong"];
  const altsSlugs = ["apollo", "clay"];

  return [
    { url: `${BASE}/vs`, changeFrequency: "weekly", priority: 0.8 },
    ...vsSlugs.map((s) => ({
      url: `${BASE}/vs/${s}`,
      changeFrequency: "monthly" as const,
      priority: s === "apollo-clay-gong" ? 0.9 : 0.8,
    })),
    {
      url: `${BASE}/alternatives`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...altsSlugs.map((s) => ({
      url: `${BASE}/alternatives/${s}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}

function blogSitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/blog`, changeFrequency: "weekly", priority: 0.8 },
    ...POSTS.map((p) => ({
      url: `${BASE}/blog/${p.slug}`,
      lastModified: new Date(p.updatedAt ?? p.publishedAt),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}

function glossarySitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/glossary`, changeFrequency: "weekly", priority: 0.7 },
    ...GLOSSARY.map((t) => ({
      url: `${BASE}/glossary/${t.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}

async function citiesSitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const cities = await getPublicCities();
    if (!cities?.length) return [];
    return [
      { url: `${BASE}/cities`, changeFrequency: "weekly", priority: 0.8 },
      ...cities.slice(0, 44_000).map((c) => ({
        url: `${BASE}/cities/${c.citySlug}`,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    ];
  } catch {
    return [];
  }
}

async function nichesSitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const niches = await getPublicNiches();
    const cities = await getPublicCities();
    if (!niches?.length) return [];

    const nicheUrls = niches.slice(0, 5_000).map((n) => ({
      url: `${BASE}/niches/${n.nicheSlug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

    const nicheCityUrls: MetadataRoute.Sitemap = [];
    outer: for (const n of niches) {
      for (const c of cities) {
        if (nicheCityUrls.length >= 35_000) break outer;
        nicheCityUrls.push({
          url: `${BASE}/niches/${n.nicheSlug}/${c.citySlug}`,
          changeFrequency: "weekly",
          priority: 0.8,
        });
      }
    }

    return [
      { url: `${BASE}/niches`, changeFrequency: "weekly", priority: 0.8 },
      ...nicheUrls,
      ...nicheCityUrls,
    ];
  } catch {
    return [];
  }
}

async function businessesSitemap(
  chunkIndex: number,
): Promise<MetadataRoute.Sitemap> {
  try {
    const businesses = await listAllPublicBusinesses({
      offset: chunkIndex * BUSINESSES_PER_CHUNK,
      limit: BUSINESSES_PER_CHUNK,
    });
    return businesses.map((b) => ({
      url: `${BASE}/b/${b.citySlug}/${b.businessSlug}`,
      lastModified: b.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    }));
  } catch {
    return [];
  }
}
