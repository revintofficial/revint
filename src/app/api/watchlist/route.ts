import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { internalError } from "@/lib/api-errors";

export async function GET() {
  try {
    const { workspaceId } = await requireUser();
    const items = await prisma.watchlistItem.findMany({
      where: { lead: { workspaceId } },
      include: {
        lead: {
          include: {
            salesOpportunity: {
              select: {
                opportunityScore: true,
                // Legacy STARTER/GROWTH/SALES enum (deprecated P0.4) —
                // selected so historic rows still render in the export
                // PDF/Excel; new rows leave this at the schema default
                // and surface their package via recommendedPackageId.
                suggestedOffer: true,
                status: true,
                whyGoodTarget: true,
                likelyPainPoints: true,
                bestSalesAngle: true,
                personalizedFirstMessage: true,
                expectedPriceBand: true,
                reasonCodes: true,
                recommendedPackageId: true,
                recommendedPackageReason: true,
              },
            },
            googleReviews: { orderBy: { publishTime: "desc" } },
          },
        },
      },
      orderBy: [
        { stageOrder: "asc" },
        { createdAt: "desc" },
      ],
    });

    // Resolve recommendedPackageId → name + priceLabel in a single
    // workspace-scoped query so the watchlist export renders the
    // package the dossier picked, not the legacy STARTER/GROWTH/SALES
    // enum. Free-text id => unresolved rows fall back to the legacy
    // suggestedOffer column (export side handles the OR).
    const packageIds = Array.from(
      new Set(
        items
          .map((it) => it.lead.salesOpportunity?.recommendedPackageId)
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

    const decorated = items.map((it) => {
      const opp = it.lead.salesOpportunity;
      if (!opp) return it;
      const pkg = opp.recommendedPackageId
        ? packageById.get(opp.recommendedPackageId) ?? null
        : null;
      return {
        ...it,
        lead: {
          ...it.lead,
          salesOpportunity: {
            ...opp,
            recommendedPackageName: pkg?.name ?? null,
            recommendedPackagePriceLabel: pkg?.priceLabel ?? null,
          },
        },
      };
    });

    return NextResponse.json({ items: decorated });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.watchlist.fetch_error", error);
  }
}

async function triggerAnalysis(leadId: string, origin: string, cookie: string) {
  try {
    await fetch(`${origin}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ leadId }),
    });
  } catch (err) {
    logger.error("api.watchlist.auto_analyze_trigger_failed", { err });
  }
}

export async function POST(request: Request) {
  try {
    const { workspaceId } = await requireUser();
    const body = await request.json();
    const { leadId, siteUrl, notes } = body;

    if (!leadId) {
      return NextResponse.json({ error: "leadId is required" }, { status: 400 });
    }

    // Make sure the lead belongs to this workspace.
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, workspaceId },
      include: { salesOpportunity: true, watchlistItem: true },
    });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    if (lead.watchlistItem) {
      return NextResponse.json({ error: "Lead is already in watchlist" }, { status: 409 });
    }

    const item = await prisma.watchlistItem.create({
      data: {
        leadId,
        siteUrl: siteUrl || null,
        notes: notes || null,
      },
      include: { lead: { include: { salesOpportunity: true } } },
    });

    if (!lead.salesOpportunity) {
      const origin = new URL(request.url).origin;
      const cookie = request.headers.get("cookie") || "";
      triggerAnalysis(leadId, origin, cookie);
    }

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.watchlist.create_error", { err: error });
    return NextResponse.json({ error: "Failed to add to watchlist" }, { status: 500 });
  }
}
