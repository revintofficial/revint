import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlaceReviews } from "@/lib/google-places";
import type { PlaceReview } from "@/types";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { emit } from "@/lib/ai-core/events";

async function fetchAndStoreReviews(
  leadId: string,
  workspaceId: string,
  placeId: string,
) {
  const apiReviews: PlaceReview[] = await getPlaceReviews(placeId);
  if (apiReviews.length === 0) return [];

  // Delete-then-insert must run in a single transaction. Without this,
  // a crash or rejected create after the deleteMany would leave the
  // lead with zero reviews (we already deleted the old set) - the user
  // would see "no reviews" until the next manual refresh, and any
  // workers that read from GoogleReview would get a stale empty
  // result. The transaction either commits both phases or neither.
  const rows = apiReviews.map((r) => ({
    leadId,
    authorName: r.authorAttribution?.displayName || "Anonymous",
    authorPhoto: r.authorAttribution?.photoUri || null,
    rating: r.rating,
    text: r.text?.text || null,
    relativeTime: r.relativePublishTimeDescription || "",
    publishTime: r.publishTime ? new Date(r.publishTime) : new Date(),
  }));
  await prisma.$transaction([
    prisma.googleReview.deleteMany({ where: { leadId } }),
    prisma.googleReview.createMany({ data: rows }),
  ]);
  const created = await prisma.googleReview.findMany({
    where: { leadId },
    orderBy: { publishTime: "desc" },
  });

  // Trigger downstream re-analysis (REVIEW_ANALYST + SCORER + DOSSIER
  // refresh) without blocking the response. Errors are swallowed
  // because the reviews themselves were already stored successfully —
  // a planner failure shouldn't surface as a "reviews fetch failed"
  // 500 to the user.
  emit("lead_reviews_updated", { workspaceId, leadId }).catch((err) => {
    logger.warn("api.reviews.emit_lead_reviews_updated_failed", {
      leadId,
      workspaceId,
      err: err instanceof Error ? err.message : String(err),
    });
  });

  return created;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { workspaceId } = await requireUser();
    const { leadId } = await params;
    const url = new URL(request.url);
    const refresh = url.searchParams.get("refresh") === "true";

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, workspaceId },
      select: { id: true, placeId: true },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // FineDine v1 update — CRM-only leads (no Google Place match yet)
    // have a null placeId, so there is no Places id to fetch reviews
    // against. Serve any stored reviews and short-circuit the remote
    // fetch instead of throwing.
    if (!lead.placeId) {
      const existing = await prisma.googleReview.findMany({
        where: { leadId },
        orderBy: { publishTime: "desc" },
      });
      return NextResponse.json({ reviews: existing });
    }

    if (refresh) {
      const reviews = await fetchAndStoreReviews(lead.id, workspaceId, lead.placeId);
      return NextResponse.json({ reviews });
    }

    const existing = await prisma.googleReview.findMany({
      where: { leadId },
      orderBy: { publishTime: "desc" },
    });
    if (existing.length > 0) {
      return NextResponse.json({ reviews: existing });
    }
    const reviews = await fetchAndStoreReviews(lead.id, workspaceId, lead.placeId);
    return NextResponse.json({ reviews });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.reviews.fetch_error", { err: error });
    return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 });
  }
}
