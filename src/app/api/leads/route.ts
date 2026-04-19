import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { sortByDistance, filterWithinMiles } from "@/lib/geo";

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
      where.OR = [
        { businessName: { contains: search, mode: "insensitive" } },
        { formattedAddress: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
      ];
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

    const orderBy: Record<string, string> = {};
    if (sortBy === "score" || sortBy === "nearest") {
      // For nearest we re-sort below by Haversine; here just order by recency.
      orderBy.createdAt = sortOrder;
    } else {
      orderBy[sortBy] = sortOrder;
    }

    // For nearest mode we have to fetch a wider result then sort/filter in app
    // (Postgres earthdistance is overkill for a few hundred leads).
    const fetchLimit = isNearestSort || Number.isFinite(withinMiles)
      ? Math.min(2000, limit * 10)
      : limit;
    const fetchSkip = isNearestSort || Number.isFinite(withinMiles)
      ? 0
      : (page - 1) * limit;

    const [allLeads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: { websiteAudit: true, salesOpportunity: true },
        orderBy,
        skip: fetchSkip,
        take: fetchLimit,
      }),
      prisma.lead.count({ where }),
    ]);

    let leads: typeof allLeads | Array<typeof allLeads[number] & { distanceMiles: number | null }> = allLeads;

    if (hasUserLoc && Number.isFinite(withinMiles)) {
      leads = filterWithinMiles(allLeads, userLat, userLng, withinMiles);
    }

    if (isNearestSort) {
      leads = sortByDistance(leads as typeof allLeads, userLat, userLng);
    }

    if (isNearestSort || Number.isFinite(withinMiles)) {
      const start = (page - 1) * limit;
      leads = leads.slice(start, start + limit);
    }

    return NextResponse.json({
      leads,
      pagination: {
        page,
        limit,
        total: isNearestSort || Number.isFinite(withinMiles) ? leads.length : total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error("Leads fetch error:", message);
    return NextResponse.json({ error: "Failed to fetch leads", detail: message }, { status: 500 });
  }
}
