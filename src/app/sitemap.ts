import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo/metadata";
import {
  getPublicCities,
  getPublicNiches,
  listAllPublicBusinesses,
  countPublicBusinesses,
} from "@/lib/seo/programmatic";
import { COMPETITORS } from "@/content/competitors";
import { POSTS } from "@/content/blog";
import { GLOSSARY_TERMS } from "@/content/glossary/terms";

/**
 * Chunked sitemap index via Next.js generateSitemaps().
 *
 * Next.js expects:
 *   - `generateSitemaps()` returning `{ id: string | number }[]`.
 *   - A default `sitemap({ id })` that returns the URLs for that chunk.
 *
 * Next auto-generates the sitemap-index.xml that points to each
 * sitemap/{n}.xml. robots.ts advertises the index URL; crawlers do the rest.
 *
 * Chunks we emit:
 *   - core       : marketing + (public) entry points + legal
 *   - cities     : /cities/* index leaves
 *   - niches     : /niches/* + /niches/{v}/{c}
 *   - competitors: /alternatives/* + /vs/* + /vs/{a}-vs-{b}
 *   - blog       : /blog + /blog/[slug] + authors
 *   - glossary   : /glossary + /glossary/[term]
 *   - businesses-N : chunks of BUSINESSES_PER_CHUNK, where N = 0..M
 *
 * Hard cap per chunk is 45_000 URLs (below Google's 50k limit) so we never
 * need to worry about truncation.
 */

const BUSINESSES_PER_CHUNK = 45_000;
const BASE = SITE.url;

type ChunkId =
  | "core"
  | "cities"
  | "niches"
  | "competitors"
  | "blog"
  | "glossary"
  | `businesses-${number}`;

export async function generateSitemaps(): Promise<{ id: ChunkId }[]> {
  const fixed: { id: ChunkId }[] = [
    { id: "core" },
    { id: "cities" },
    { id: "niches" },
    { id: "competitors" },
    { id: "blog" },
    { id: "glossary" },
  ];

  let total = 0;
  try {
    total = await countPublicBusinesses();
  } catch {
    total = 0;
  }
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
  if (id === "cities") return citiesSitemap();
  if (id === "niches") return nichesSitemap();
  if (id === "competitors") return competitorsSitemap();
  if (id === "blog") return blogSitemap();
  if (id === "glossary") return glossarySitemap();

  if (typeof id === "string" && id.startsWith("businesses-")) {
    const idx = Number(id.replace("businesses-", ""));
    return businessesSitemap(idx);
  }

  return [];
}

// ---- per-chunk implementations ------------------------------------------

function coreSitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, changeFrequency: "weekly", priority: 1.0 },
    {
      url: `${BASE}/for/restaurant-agencies`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    { url: `${BASE}/partners`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/tools`, changeFrequency: "monthly", priority: 0.7 },
    {
      url: `${BASE}/tools/cold-email-reply-rate-calculator`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE}/tools/icp-match-scorer`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    { url: `${BASE}/about`, changeFrequency: "monthly", priority: 0.4 },
    {
      url: `${BASE}/legal/privacy`,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    { url: `${BASE}/legal/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];
}

async function citiesSitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const cities = await getPublicCities();
    return [
      { url: `${BASE}/cities`, changeFrequency: "weekly", priority: 0.8 },
      ...cities.slice(0, 44_000).map((c) => ({
        url: `${BASE}/cities/${c.citySlug}`,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    ];
  } catch {
    return [{ url: `${BASE}/cities` }];
  }
}

async function nichesSitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const niches = await getPublicNiches();
    const cities = await getPublicCities();

    const nicheUrls = niches.slice(0, 5_000).map((n) => ({
      url: `${BASE}/niches/${n.nicheSlug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

    // Niche × city pages (money pages). Capped to avoid exceeding the
    // 45k limit; if we run out of room we let the ISR fallback pick up
    // long-tail combos on first-visit render.
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
    return [{ url: `${BASE}/niches` }];
  }
}

function competitorsSitemap(): MetadataRoute.Sitemap {
  const vs = COMPETITORS.map((c) => ({
    url: `${BASE}/vs/${c.slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const pair: MetadataRoute.Sitemap = [];
  for (const a of COMPETITORS) {
    for (const b of COMPETITORS) {
      if (a.slug < b.slug) {
        pair.push({
          url: `${BASE}/vs/${a.slug}-vs-${b.slug}`,
          changeFrequency: "monthly",
          priority: 0.6,
        });
      }
    }
  }

  const alts = COMPETITORS.map((c) => ({
    url: `${BASE}/alternatives/${c.slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [
    { url: `${BASE}/compare`, changeFrequency: "weekly", priority: 0.8 },
    {
      url: `${BASE}/alternatives`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...vs,
    ...pair,
    ...alts,
  ];
}

function blogSitemap(): MetadataRoute.Sitemap {
  const authors = Array.from(new Set(POSTS.map((p) => p.author.slug)));

  return [
    { url: `${BASE}/blog`, changeFrequency: "weekly", priority: 0.8 },
    ...POSTS.map((p) => ({
      url: `${BASE}/blog/${p.slug}`,
      lastModified: new Date(p.updatedAt ?? p.publishedAt),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...authors.map((a) => ({
      url: `${BASE}/about/${a}`,
      changeFrequency: "monthly" as const,
      priority: 0.3,
    })),
  ];
}

function glossarySitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/glossary`, changeFrequency: "weekly", priority: 0.7 },
    ...GLOSSARY_TERMS.map((t) => ({
      url: `${BASE}/glossary/${t.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
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
