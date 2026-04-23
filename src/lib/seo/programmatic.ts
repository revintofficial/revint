import { prisma } from "@/lib/prisma";
import { slugify, slugWithSuffix } from "@/lib/slug";
import type { Lead, SalesOpportunity, WebsiteAudit } from "@/generated/prisma/client";

/**
 * Data access layer for programmatic directory pages.
 *
 * Every query in this file respects two invariants:
 *   1. Only leads inside workspaces with `publicProfilesEnabled = true`
 *      ever leak out to public pages.
 *   2. Only leads that pass the `passesEvidenceFloor` check are indexable;
 *      the rest get excluded from lists AND get robots:noindex on their
 *      own detail pages.
 *
 * The evidence floor prevents thin-directory penalties when we scale to
 * tens of thousands of URLs. A lead needs at least one verifiable fact
 * beyond its name + address before we claim it's worth a page.
 */

export type PublicLeadCard = Pick<
  Lead,
  | "id"
  | "businessName"
  | "formattedAddress"
  | "borough"
  | "rating"
  | "reviewCount"
  | "websiteUrl"
  | "phone"
  | "primaryType"
  | "updatedAt"
> & {
  citySlug: string;
  businessSlug: string;
  href: string;
  nicheSlug: string | null;
  oneLiner: string | null;
};

export type PublicLeadForFloor = Pick<
  Lead,
  "id" | "businessName" | "rating" | "reviewCount" | "hasWebsite"
> & {
  websiteAudit: WebsiteAudit | null;
  salesOpportunity: SalesOpportunity | null;
  _googleReviewCount?: number;
};

/**
 * Evidence floor. A lead qualifies for a public page when any of:
 *   - We have ≥3 Google reviews (social proof)
 *   - We ran and completed an audit (unique content)
 *   - The sales opportunity analyzer wrote a non-empty pitch
 *
 * The default is permissive; flip to strict by requiring BOTH an audit
 * and at least one review once we have volume.
 */
export function passesEvidenceFloor(
  lead: PublicLeadForFloor,
  mode: "permissive" | "strict" = "permissive",
): boolean {
  const hasReviews = (lead.reviewCount ?? 0) >= 3;
  const hasAudit = lead.websiteAudit !== null;
  const hasOpportunity =
    lead.salesOpportunity?.whyGoodTarget &&
    lead.salesOpportunity.whyGoodTarget.length >= 40;

  if (mode === "strict") {
    return Boolean(hasAudit && (hasReviews || hasOpportunity));
  }
  return Boolean(hasAudit || hasReviews || hasOpportunity);
}

function toCard(
  lead: Lead & {
    salesOpportunity: SalesOpportunity | null;
  },
): PublicLeadCard {
  const citySlug = slugify(lead.borough || "unknown");
  const businessSlug = slugWithSuffix(lead.businessName, lead.id);
  const nicheSlug = lead.primaryType ? slugify(lead.primaryType) : null;
  return {
    id: lead.id,
    businessName: lead.businessName,
    formattedAddress: lead.formattedAddress,
    borough: lead.borough,
    rating: lead.rating,
    reviewCount: lead.reviewCount,
    websiteUrl: lead.websiteUrl,
    phone: lead.phone,
    primaryType: lead.primaryType,
    updatedAt: lead.updatedAt,
    citySlug,
    businessSlug,
    nicheSlug,
    href: `/b/${citySlug}/${businessSlug}`,
    oneLiner: lead.salesOpportunity?.whyGoodTarget?.slice(0, 140) ?? null,
  };
}

async function queryPublicLeads(
  where: Record<string, unknown>,
  take = 100,
): Promise<PublicLeadCard[]> {
  try {
    const rows = await prisma.lead.findMany({
      where: {
        analyzeStatus: "ANALYZED",
        workspace: { publicProfilesEnabled: true },
        ...where,
      },
      include: {
        salesOpportunity: true,
        websiteAudit: true,
      },
      orderBy: [{ reviewCount: "desc" }, { rating: "desc" }],
      take,
    });
    return rows
      .filter((lead) =>
        passesEvidenceFloor({
          id: lead.id,
          businessName: lead.businessName,
          rating: lead.rating,
          reviewCount: lead.reviewCount,
          hasWebsite: lead.hasWebsite,
          websiteAudit: lead.websiteAudit,
          salesOpportunity: lead.salesOpportunity,
        }),
      )
      .map(toCard);
  } catch {
    return [];
  }
}

export async function getPublicCities(): Promise<
  Array<{ citySlug: string; cityName: string; leadCount: number }>
> {
  try {
    const rows = await prisma.lead.groupBy({
      by: ["borough"],
      where: {
        analyzeStatus: "ANALYZED",
        workspace: { publicProfilesEnabled: true },
        borough: { not: null },
      },
      _count: { _all: true },
      orderBy: { _count: { id: "desc" } },
      take: 500,
    });
    return rows
      .filter((r) => r.borough && r._count._all >= 3)
      .map((r) => ({
        citySlug: slugify(r.borough!),
        cityName: r.borough!,
        leadCount: r._count._all,
      }));
  } catch {
    return [];
  }
}

export async function getPublicNiches(): Promise<
  Array<{ nicheSlug: string; nicheName: string; leadCount: number }>
> {
  try {
    const rows = await prisma.lead.groupBy({
      by: ["primaryType"],
      where: {
        analyzeStatus: "ANALYZED",
        workspace: { publicProfilesEnabled: true },
        primaryType: { not: null },
      },
      _count: { _all: true },
      orderBy: { _count: { id: "desc" } },
      take: 500,
    });
    return rows
      .filter((r) => r.primaryType && r._count._all >= 3)
      .map((r) => ({
        nicheSlug: slugify(r.primaryType!),
        nicheName: r.primaryType!,
        leadCount: r._count._all,
      }));
  } catch {
    return [];
  }
}

export async function getPublicBusinessesByCity(
  citySlug: string,
  limit = 100,
): Promise<PublicLeadCard[]> {
  const cities = await getPublicCities();
  const match = cities.find((c) => c.citySlug === citySlug);
  if (!match) return [];
  return queryPublicLeads({ borough: match.cityName }, limit);
}

export async function getPublicBusinessesByNiche(
  nicheSlug: string,
  limit = 100,
): Promise<PublicLeadCard[]> {
  const niches = await getPublicNiches();
  const match = niches.find((n) => n.nicheSlug === nicheSlug);
  if (!match) return [];
  return queryPublicLeads({ primaryType: match.nicheName }, limit);
}

export async function getPublicBusinessesByNicheCity(
  nicheSlug: string,
  citySlug: string,
  limit = 100,
): Promise<PublicLeadCard[]> {
  const [cities, niches] = await Promise.all([
    getPublicCities(),
    getPublicNiches(),
  ]);
  const city = cities.find((c) => c.citySlug === citySlug);
  const niche = niches.find((n) => n.nicheSlug === nicheSlug);
  if (!city || !niche) return [];
  return queryPublicLeads(
    { borough: city.cityName, primaryType: niche.nicheName },
    limit,
  );
}

export async function getRelatedCitiesForNiche(
  nicheSlug: string,
  excludeCitySlug?: string,
): Promise<
  Array<{ citySlug: string; cityName: string; leadCount: number }>
> {
  try {
    const niches = await getPublicNiches();
    const niche = niches.find((n) => n.nicheSlug === nicheSlug);
    if (!niche) return [];
    const rows = await prisma.lead.groupBy({
      by: ["borough"],
      where: {
        analyzeStatus: "ANALYZED",
        workspace: { publicProfilesEnabled: true },
        primaryType: niche.nicheName,
        borough: { not: null },
      },
      _count: { _all: true },
      orderBy: { _count: { id: "desc" } },
      take: 20,
    });
    return rows
      .filter((r) => r.borough && r._count._all >= 2)
      .filter((r) => slugify(r.borough!) !== excludeCitySlug)
      .map((r) => ({
        citySlug: slugify(r.borough!),
        cityName: r.borough!,
        leadCount: r._count._all,
      }));
  } catch {
    return [];
  }
}

export async function getRelatedNichesForCity(
  citySlug: string,
  excludeNicheSlug?: string,
): Promise<
  Array<{ nicheSlug: string; nicheName: string; leadCount: number }>
> {
  try {
    const cities = await getPublicCities();
    const city = cities.find((c) => c.citySlug === citySlug);
    if (!city) return [];
    const rows = await prisma.lead.groupBy({
      by: ["primaryType"],
      where: {
        analyzeStatus: "ANALYZED",
        workspace: { publicProfilesEnabled: true },
        borough: city.cityName,
        primaryType: { not: null },
      },
      _count: { _all: true },
      orderBy: { _count: { id: "desc" } },
      take: 20,
    });
    return rows
      .filter((r) => r.primaryType && r._count._all >= 2)
      .filter((r) => slugify(r.primaryType!) !== excludeNicheSlug)
      .map((r) => ({
        nicheSlug: slugify(r.primaryType!),
        nicheName: r.primaryType!,
        leadCount: r._count._all,
      }));
  } catch {
    return [];
  }
}

export type AllPublicBusinessRow = {
  id: string;
  citySlug: string;
  businessSlug: string;
  updatedAt: Date;
};

/**
 * Iterate every indexable public business. Used by the sitemap chunker in
 * `src/app/sitemap.ts`. Returns raw rows (no JSON-LD), suitable for
 * large-scale iteration.
 */
export async function listAllPublicBusinesses(
  opts: { offset?: number; limit?: number } = {},
): Promise<AllPublicBusinessRow[]> {
  const { offset = 0, limit = 45_000 } = opts;
  try {
    const rows = await prisma.lead.findMany({
      where: {
        analyzeStatus: "ANALYZED",
        workspace: { publicProfilesEnabled: true },
      },
      include: {
        websiteAudit: true,
        salesOpportunity: true,
      },
      orderBy: { id: "asc" },
      skip: offset,
      take: limit,
    });
    return rows
      .filter((lead) =>
        passesEvidenceFloor({
          id: lead.id,
          businessName: lead.businessName,
          rating: lead.rating,
          reviewCount: lead.reviewCount,
          hasWebsite: lead.hasWebsite,
          websiteAudit: lead.websiteAudit,
          salesOpportunity: lead.salesOpportunity,
        }),
      )
      .map((lead) => ({
        id: lead.id,
        citySlug: slugify(lead.borough || "unknown"),
        businessSlug: slugWithSuffix(lead.businessName, lead.id),
        updatedAt: lead.updatedAt,
      }));
  } catch {
    return [];
  }
}

export async function countPublicBusinesses(): Promise<number> {
  try {
    return await prisma.lead.count({
      where: {
        analyzeStatus: "ANALYZED",
        workspace: { publicProfilesEnabled: true },
      },
    });
  } catch {
    return 0;
  }
}
