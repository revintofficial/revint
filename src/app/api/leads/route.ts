import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { sortByDistance, filterWithinMiles } from "@/lib/geo";
import { internalError } from "@/lib/api-errors";
import { getChildrenOf } from "@/lib/niches";

export async function GET(request: Request) {
  try {
    const { workspaceId } = await requireUser();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const borough = searchParams.get("borough");
    const hasWebsite = searchParams.get("hasWebsite");
    const minScore = searchParams.get("minScore");
    const maxScore = searchParams.get("maxScore");
    const status = searchParams.get("status");
    const niche = searchParams.get("niche");
    const subNiche = searchParams.get("subNiche");
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";
    const search = searchParams.get("search");
    // P1.5 - GPS-based sorting + radius filter (ICP4 walk-in workflow).
    const userLat = parseFloat(searchParams.get("userLat") || "");
    const userLng = parseFloat(searchParams.get("userLng") || "");
    const withinMiles = parseFloat(searchParams.get("withinMiles") || "");
    const hasUserLoc = Number.isFinite(userLat) && Number.isFinite(userLng);
    const isNearestSort = sortBy === "nearest" && hasUserLoc;

    const where: Record<string, unknown> = { workspaceId };

    if (borough && borough !== "all") where.borough = borough;
    if (hasWebsite === "true") where.hasWebsite = true;
    if (hasWebsite === "false") where.hasWebsite = false;

    if (search) {
      const terms = search.trim().split(/\s+/).filter(Boolean);
      if (terms.length > 0) {
        where.AND = terms.map((term) => {
          const or: Array<Record<string, unknown>> = [
            { businessName: { contains: term, mode: "insensitive" } },
            { formattedAddress: { contains: term, mode: "insensitive" } },
          ];
          const digits = term.replace(/\D/g, "");
          if (digits.length >= 3) {
            or.push({ phone: { contains: digits } });
          }
          return { OR: or };
        });
      }
    }

    // Niche / sub-niche filters. When a parent slug is selected without
    // a sub-niche we also include the parent's children so legacy leads
    // tagged only with `nicheSlug = "fnb"` still surface alongside their
    // classified siblings.
    if (niche && niche !== "all") {
      const childSlugs = getChildrenOf(niche).map((c) => c.slug);
      if (subNiche && subNiche !== "all") {
        where.subNicheSlug = subNiche;
      } else if (childSlugs.length > 0) {
        where.OR = [
          { nicheSlug: niche },
          { subNicheSlug: { in: childSlugs } },
        ];
      } else {
        where.nicheSlug = niche;
      }
    } else if (subNiche && subNiche !== "all") {
      where.subNicheSlug = subNiche;
    }

    // Status filter — supports comma-joined multi-select. The special
    // value "unscored" matches leads without a SalesOpportunity row.
    let unscoredOnly = false;
    let salesOppFilter: Record<string, unknown> | undefined;
    if (status && status !== "all") {
      const list = status
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const includesUnscored = list.includes("unscored");
      const concrete = list
        .filter((s) => s !== "unscored")
        .map((s) => s.toUpperCase());

      if (concrete.length > 0 && includesUnscored) {
        // "Has any of these statuses, OR has no opportunity row at all".
        const existingOr = (where.OR as Array<Record<string, unknown>> | undefined) ?? [];
        where.OR = [
          ...existingOr,
          { salesOpportunity: { status: { in: concrete } } },
          { salesOpportunity: null },
        ];
      } else if (concrete.length > 0) {
        salesOppFilter = { status: { in: concrete } };
      } else if (includesUnscored) {
        unscoredOnly = true;
        where.salesOpportunity = null;
      }
    }

    if (minScore || maxScore) {
      salesOppFilter = {
        ...(salesOppFilter ?? {}),
        opportunityScore: {
          ...(minScore ? { gte: parseInt(minScore) } : {}),
          ...(maxScore ? { lte: parseInt(maxScore) } : {}),
        },
      };
    }

    if (salesOppFilter && !unscoredOnly) {
      where.salesOpportunity = {
        ...(where.salesOpportunity as Record<string, unknown> | undefined),
        ...salesOppFilter,
      };
    }

    type LeadOrderBy = Record<string, unknown>;
    let orderBy: LeadOrderBy | LeadOrderBy[];
    if (sortBy === "score") {
      orderBy = [
        {
          salesOpportunity: {
            opportunityScore: { sort: sortOrder, nulls: "last" },
          },
        },
        { createdAt: "desc" },
      ];
    } else if (sortBy === "nearest") {
      orderBy = { createdAt: sortOrder };
    } else {
      orderBy = { [sortBy]: sortOrder };
    }

    const isGeoMode = isNearestSort || Number.isFinite(withinMiles);
    const fetchLimit = isGeoMode ? Math.min(2000, limit * 10) : limit;
    const fetchSkip = isGeoMode ? 0 : (page - 1) * limit;

    const [allLeads, dbTotal] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          websiteAudit: true,
          salesOpportunity: true,
          watchlistItem: { select: { id: true, pipelineStage: true } },
        },
        orderBy,
        skip: fetchSkip,
        take: fetchLimit,
      }),
      prisma.lead.count({ where }),
    ]);

    // Resolve recommendedPackageId → name + priceLabel in a single query
    // per page so the row badge can render inline. Free-text id =>
    // missing rows render with packageName = null and the UI hides the
    // chip.
    const packageIds = Array.from(
      new Set(
        allLeads
          .map((l) => l.salesOpportunity?.recommendedPackageId)
          .filter((id): id is string => !!id),
      ),
    );
    const packages = packageIds.length
      ? await prisma.servicePackage.findMany({
          where: { workspaceId, id: { in: packageIds } },
          select: { id: true, name: true, priceLabel: true },
        })
      : [];
    const packageById = new Map(packages.map((p) => [p.id, p]));

    type DecoratedLead = (typeof allLeads)[number] & {
      salesOpportunity:
        | (NonNullable<(typeof allLeads)[number]["salesOpportunity"]> & {
            recommendedPackageName: string | null;
            recommendedPackagePriceLabel: string | null;
          })
        | null;
    };

    const decorated: DecoratedLead[] = allLeads.map((lead) => {
      if (!lead.salesOpportunity) return { ...lead, salesOpportunity: null };
      const pkg = lead.salesOpportunity.recommendedPackageId
        ? packageById.get(lead.salesOpportunity.recommendedPackageId) ?? null
        : null;
      return {
        ...lead,
        salesOpportunity: {
          ...lead.salesOpportunity,
          recommendedPackageName: pkg?.name ?? null,
          recommendedPackagePriceLabel: pkg?.priceLabel ?? null,
        },
      };
    });

    let leads:
      | DecoratedLead[]
      | Array<DecoratedLead & { distanceMiles: number | null }> = decorated;
    let filteredTotal = dbTotal;

    if (hasUserLoc && Number.isFinite(withinMiles)) {
      leads = filterWithinMiles(decorated, userLat, userLng, withinMiles);
      filteredTotal = leads.length;
    }

    if (isNearestSort) {
      leads = sortByDistance(leads as DecoratedLead[], userLat, userLng);
    }

    if (isGeoMode) {
      const start = (page - 1) * limit;
      leads = leads.slice(start, start + limit);
    }

    const total = isGeoMode ? filteredTotal : dbTotal;
    return NextResponse.json({
      leads,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.leads.fetch_error", error);
  }
}
