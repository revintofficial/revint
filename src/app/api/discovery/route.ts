import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  discoverLeads,
  extractBoroughFromAddress,
} from "@/lib/google-places";
import { LONDON_BOROUGHS, SEARCH_QUERIES } from "@/types";

export async function POST(request: Request) {
  try {
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
                where: { placeId: place.id },
              });
              if (existing) {
                skipped++;
                continue;
              }

              const address = place.formattedAddress || "";
              const websiteUrl = place.websiteUri || null;
              await prisma.lead.create({
                data: {
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

    const borough = LONDON_BOROUGHS.find(
      (b) => b.name.toLowerCase() === boroughName.toLowerCase()
    );
    if (!borough) {
      return NextResponse.json(
        { error: `Borough "${boroughName}" not found` },
        { status: 400 }
      );
    }

    const places = await discoverLeads(searchQuery, borough, radiusMeters);

    let created = 0;
    let skipped = 0;

    for (const place of places) {
      if (!place.id) continue;
      const existing = await prisma.lead.findUnique({
        where: { placeId: place.id },
      });
      if (existing) {
        skipped++;
        continue;
      }

      const address = place.formattedAddress || "";
      const websiteUrl = place.websiteUri || null;
      await prisma.lead.create({
        data: {
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
          sourceQuery: `${searchQuery} in ${borough.name} London`,
          sourceLat: borough.lat,
          sourceLng: borough.lng,
          crawlStatus: websiteUrl ? "PENDING" : "NO_WEBSITE",
          analyzeStatus: "PENDING",
        },
      });
      created++;
    }

    return NextResponse.json({
      success: true,
      created,
      skipped,
      total: places.length,
    });
  } catch (error) {
    console.error("Discovery error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
