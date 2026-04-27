import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { sortByDistance, filterWithinMiles } from "@/lib/geo";
import { internalError } from "@/lib/api-errors";

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
      // Split the query into whitespace-separated terms and AND them together.
      // Each term must match at least one of businessName / formattedAddress
      // (or phone if the term looks like digits). This lets "main brooklyn"
      // find "123 Main St, Brooklyn, NY" even though the literal substring
      // "main brooklyn" never appears.
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

    if (status && status !== "all") {
      where.salesOpportunity = { status: status.toUpperCase() };
    }

    if (minScore || maxScore) {
      where.salesOpportunity = {
        ...(where.salesOpportunity as Record<string, unknown> || {}),
        opportunityScore: {
          ...(minScore ? { gte: parseInt(minScore) } : {}),
          ...(maxScore ? { lte: parseInt(maxScore) } : {}),
        },
      };
    }

    // Build orderBy. For score we sort by SalesOpportunity.opportunityScore
    // (nulls last), falling back to createdAt for ties / leads without an
    // opportunity row. For nearest we re-sort in app by Haversine.
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

    // For geo modes we fetch a wider result then sort/filter/slice in app.
    // Postgres earthdistance is overkill for a few thousand leads.
    const fetchLimit = isGeoMode ? Math.min(2000, limit * 10) : limit;
    const fetchSkip = isGeoMode ? 0 : (page - 1) * limit;

    const [allLeads, dbTotal] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          websiteAudit: true,
          salesOpportunity: true,
          // Surface watchlist membership so the command palette can deep-link
          // into Shortlist / Pipeline views for leads that live there.
          watchlistItem: { select: { id: true } },
        },
        orderBy,
        skip: fetchSkip,
        take: fetchLimit,
      }),
      prisma.lead.count({ where }),
    ]);

    let leads: typeof allLeads | Array<typeof allLeads[number] & { distanceMiles: number | null }> = allLeads;
    let filteredTotal = dbTotal;

    if (hasUserLoc && Number.isFinite(withinMiles)) {
      leads = filterWithinMiles(allLeads, userLat, userLng, withinMiles);
      // Once we filter by radius the DB count no longer reflects what the
      // user actually sees. Use the post-filter length (capped by fetchLimit
      // - we accept this approximation since fetchLimit is generous).
      filteredTotal = leads.length;
    }

    if (isNearestSort) {
      leads = sortByDistance(leads as typeof allLeads, userLat, userLng);
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
