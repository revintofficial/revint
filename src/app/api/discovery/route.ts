import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { discoverLeads, extractBoroughFromAddress } from "@/lib/google-places";
import { LONDON_BOROUGHS, SEARCH_QUERIES } from "@/types";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { assertCanCreateLeads, recordLeadsCreated, QuotaExceededError } from "@/lib/quotas";

export async function POST(request: Request) {
  try {
    const { workspaceId } = await requireUser();
    const body = await request.json();
    const {
      searchQuery,
      boroughName,
      radiusMeters = 5000,
      runAll = false,
    } = body;

    if (runAll) {
      const results: { borough: string; query: string; created: number; skipped: number }[] = [];

      for (const borough of LONDON_BOROUGHS.slice(0, 5)) {
        for (const query of SEARCH_QUERIES.slice(0, 3)) {
          try {
            const places = await discoverLeads(query, borough, radiusMeters);
            let created = 0;
            let skipped = 0;

            for (const place of places) {
              if (!place.id) continue;
              const existing = await prisma.lead.findUnique({
                where: { workspaceId_placeId: { workspaceId, placeId: place.id } },
              });
              if (existing) {
                skipped++;
                continue;
              }

              try {
                await assertCanCreateLeads(workspaceId, 1);
              } catch (e) {
                if (e instanceof QuotaExceededError) {
                  results.push({ borough: borough.name, query, created, skipped });
                  return NextResponse.json({ success: true, results, partial: true, quota: e.message });
                }
                throw e;
              }

              const address = place.formattedAddress || "";
              const websiteUrl = place.websiteUri || null;
              await prisma.lead.create({
                data: {
                  workspaceId,
                  placeId: place.id,
                  businessName: place.displayName?.text || "Unknown",
                  formattedAddress: address,
                  borough: extractBoroughFromAddress(address) || borough.name,
                  phone: place.nationalPhoneNumber || null,
                  websiteUrl,
                  hasWebsite: !!websiteUrl,
                  googleMapsUri: place.googleMapsUri || null,
                  rating: place.rating || null,
                  reviewCount: place.userRatingCount || null,
                  businessStatus: place.businessStatus || null,
                  primaryType: place.primaryType || null,
                  sourceQuery: `${query} in ${borough.name} London`,
                  sourceLat: borough.lat,
                  sourceLng: borough.lng,
                  crawlStatus: websiteUrl ? "PENDING" : "NO_WEBSITE",
                  analyzeStatus: "PENDING",
                },
              });
              await recordLeadsCreated(workspaceId, 1);
              created++;
            }

            results.push({ borough: borough.name, query, created, skipped });
            await new Promise((r) => setTimeout(r, 1000));
          } catch (err) {
            console.error(`Discovery error for ${query} in ${borough.name}:`, err);
          }
        }
      }

      return NextResponse.json({ success: true, results });
    }

    if (!searchQuery || !boroughName) {
      return NextResponse.json(
        { error: "searchQuery and boroughName are required" },
        { status: 400 }
      );
    }

    const matched = LONDON_BOROUGHS.find(
      (b) => b.name.toLowerCase() === boroughName.toLowerCase()
    );
    const borough: { name: string; lat: number; lng: number } = matched
      ? { name: matched.name, lat: matched.lat, lng: matched.lng }
      // Allow free-text locations: synthesize a "borough" with placeholder coords.
      : { name: boroughName, lat: 0, lng: 0 };

    const places = await discoverLeads(searchQuery, borough, radiusMeters);

    let created = 0;
    let skipped = 0;
    let quotaHit: string | null = null;

    for (const place of places) {
      if (!place.id) continue;
      const existing = await prisma.lead.findUnique({
        where: { workspaceId_placeId: { workspaceId, placeId: place.id } },
      });
      if (existing) {
        skipped++;
        continue;
      }

      try {
        await assertCanCreateLeads(workspaceId, 1);
      } catch (e) {
        if (e instanceof QuotaExceededError) {
          quotaHit = e.message;
          break;
        }
        throw e;
      }

      const address = place.formattedAddress || "";
      const websiteUrl = place.websiteUri || null;
      await prisma.lead.create({
        data: {
          workspaceId,
          placeId: place.id,
          businessName: place.displayName?.text || "Unknown",
          formattedAddress: address,
          borough: extractBoroughFromAddress(address) || borough.name,
          phone: place.nationalPhoneNumber || null,
          websiteUrl,
          hasWebsite: !!websiteUrl,
          googleMapsUri: place.googleMapsUri || null,
          rating: place.rating || null,
          reviewCount: place.userRatingCount || null,
          businessStatus: place.businessStatus || null,
          primaryType: place.primaryType || null,
          sourceQuery: `${searchQuery} in ${borough.name}`,
          sourceLat: borough.lat,
          sourceLng: borough.lng,
          crawlStatus: websiteUrl ? "PENDING" : "NO_WEBSITE",
          analyzeStatus: "PENDING",
        },
      });
      await recordLeadsCreated(workspaceId, 1);
      created++;
    }

    return NextResponse.json({
      success: true,
      created,
      skipped,
      total: places.length,
      ...(quotaHit ? { quota: quotaHit } : {}),
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof QuotaExceededError) {
      return error.toResponse();
    }
    console.error("Discovery error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
