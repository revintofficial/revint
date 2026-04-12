import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlaceReviews } from "@/lib/google-places";
import type { PlaceReview } from "@/types";

async function fetchAndStoreReviews(leadId: string, placeId: string) {
  const apiReviews: PlaceReview[] = await getPlaceReviews(placeId);

  if (apiReviews.length === 0) return [];

  await prisma.googleReview.deleteMany({ where: { leadId } });

  const created = await Promise.all(
    apiReviews.map((r) =>
      prisma.googleReview.create({
        data: {
          leadId,
          authorName: r.authorAttribution?.displayName || "Anonymous",
          authorPhoto: r.authorAttribution?.photoUri || null,
          rating: r.rating,
          text: r.text?.text || null,
          relativeTime: r.relativePublishTimeDescription || "",
          publishTime: r.publishTime
            ? new Date(r.publishTime)
            : new Date(),
        },
      })
    )
  );

  return created;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params;
    const url = new URL(request.url);
    const refresh = url.searchParams.get("refresh") === "true";

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, placeId: true },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (refresh) {
      const reviews = await fetchAndStoreReviews(lead.id, lead.placeId);
      return NextResponse.json({ reviews });
    }

    const existing = await prisma.googleReview.findMany({
      where: { leadId },
      orderBy: { publishTime: "desc" },
    });

    if (existing.length > 0) {
      return NextResponse.json({ reviews: existing });
    }

    const reviews = await fetchAndStoreReviews(lead.id, lead.placeId);
    return NextResponse.json({ reviews });
  } catch (error) {
    console.error("Reviews fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch reviews" },
      { status: 500 }
    );
  }
}
