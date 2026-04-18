import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";

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
    if (sortBy === "score") {
      orderBy.createdAt = sortOrder;
    } else {
      orderBy[sortBy] = sortOrder;
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: { websiteAudit: true, salesOpportunity: true },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.lead.count({ where }),
    ]);

    return NextResponse.json({
      leads,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
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
