import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { discoverLeads, extractBoroughFromAddress } from "@/lib/google-places";
import { LONDON_BOROUGHS, SEARCH_QUERIES } from "@/types";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import {
  assertCanCreateLeads,
  recordLeadsCreated,
  QuotaExceededError,
} from "@/lib/quotas";
import { checkRateLimit, LIMITS, rateLimitResponse } from "@/lib/ratelimit";
import { getDiscoveryQueue } from "@/lib/queues";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    const { workspaceId } = await requireUser();

    // Rate limit on expensive Google Places spend. Quota (leads/cycle) still
    // caps absolute usage via src/lib/quotas.ts.
    const rl = await checkRateLimit(workspaceId, LIMITS.discovery);
    if (!rl.ok) return rateLimitResponse(rl);

    const body = await request.json();
    const {
      searchQuery,
      boroughName,
      radiusMeters = 5000,
      runAll = false,
    } = body;

    // Bulk path moved to the worker queue. Previously this ran 5 boroughs x
    // 3 queries sequentially inside the HTTP handler, with 1s sleeps and
    // per-place DB writes - guaranteed Vercel timeout at any real scale.
    if (runAll) {
      const queue = getDiscoveryQueue();
      const jobs: { borough: string; query: string }[] = [];
      for (const borough of LONDON_BOROUGHS.slice(0, 5)) {
        for (const query of SEARCH_QUERIES.slice(0, 3)) {
          await queue.add(
            "discover",
            { workspaceId, searchQuery: query, borough, radiusMeters },
            { removeOnComplete: 100, removeOnFail: 50 },
          );
          jobs.push({ borough: borough.name, query });
        }
      }
      return NextResponse.json(
        {
          success: true,
          enqueued: jobs.length,
          jobs,
          message:
            "Bulk discovery enqueued. Worker will populate leads in the background; poll /api/leads for new rows.",
        },
        { status: 202 },
      );
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
      : { name: boroughName, lat: 0, lng: 0 };

    const t0 = Date.now();
    logger.info("api.discovery.places_start", {
      workspaceId,
      searchQuery,
      boroughName: borough.name,
    });
    const places = await discoverLeads(searchQuery, borough, radiusMeters);
    logger.info("api.discovery.places_done", {
      workspaceId,
      count: places.length,
      ms: Date.now() - t0,
    });

    let created = 0;
    let skipped = 0;
    let quotaHit: string | null = null;
    const tDb = Date.now();

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

    logger.info("api.discovery.db_done", {
      workspaceId,
      created,
      skipped,
      total: places.length,
      ms: Date.now() - tDb,
    });

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
    logger.error("api.discovery.error", { err: error });
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
