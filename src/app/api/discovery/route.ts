import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { discoverLeads } from "@/lib/google-places";
import { SEARCH_QUERIES } from "@/types";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import {
  assertCanCreateLeads,
  recordLeadsCreated,
  QuotaExceededError,
} from "@/lib/quotas";
import { checkRateLimit, LIMITS, rateLimitResponse } from "@/lib/ratelimit";
import { getDiscoveryQueue } from "@/lib/queues";
import { logger } from "@/lib/logger";
import { emit } from "@/lib/ai-core/events";

// Vercel serverless function config.
// - nodejs runtime: Prisma + BullMQ need a full Node runtime (no Edge).
// - maxDuration 60s: single-borough discovery does up to 3 pages of Google
//   Places (2s sleep between pages) + ~60 sequential DB writes. Default
//   Hobby cap is 10s which the real flow blew past silently.
// - force-dynamic: never cache. This route always mutates DB state.
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

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
      // Fetch the workspace country to pass along to the bulk worker.
      const ws = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { country: true },
      });
      const workspaceCountry = ws?.country ?? undefined;

      const queue = getDiscoveryQueue();
      const jobs: { city: string; query: string }[] = [];
      const defaultCities = ["London", "Manchester", "Birmingham", "Leeds", "Glasgow"];
      for (const city of defaultCities.slice(0, 5)) {
        for (const query of SEARCH_QUERIES.slice(0, 3)) {
          await queue.add(
            "discover",
            { workspaceId, searchQuery: query, city, country: workspaceCountry, radiusMeters },
            { removeOnComplete: 100, removeOnFail: 50 },
          );
          jobs.push({ city, query });
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

    // Resolve workspace country for the query context when not passed explicitly.
    const countryFromBody: string | undefined = body.country;
    let country = countryFromBody;
    if (!country) {
      const ws = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { country: true },
      });
      country = ws?.country ?? undefined;
    }

    const location = { name: boroughName, country };

    const t0 = Date.now();
    logger.info("api.discovery.places_start", {
      workspaceId,
      searchQuery,
      location: boroughName,
      country,
    });
    const places = await discoverLeads(searchQuery, location, radiusMeters);
    logger.info("api.discovery.places_done", {
      workspaceId,
      count: places.length,
      location: boroughName,
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
      const lead = await prisma.lead.create({
        data: {
          workspaceId,
          placeId: place.id,
          businessName: place.displayName?.text || "Unknown",
          formattedAddress: address,
          borough: boroughName,
          phone: place.nationalPhoneNumber || null,
          websiteUrl,
          hasWebsite: !!websiteUrl,
          googleMapsUri: place.googleMapsUri || null,
          rating: place.rating || null,
          reviewCount: place.userRatingCount || null,
          businessStatus: place.businessStatus || null,
          primaryType: place.primaryType || null,
          sourceQuery: `${searchQuery} in ${boroughName}`,
          sourceLat: undefined,
          sourceLng: undefined,
          crawlStatus: websiteUrl ? "PENDING" : "NO_WEBSITE",
          analyzeStatus: "PENDING",
        },
        select: { id: true },
      });
      await recordLeadsCreated(workspaceId, 1);

      // Fire the AI Core `lead_created` chain. Emit failure should
      // never surface to the HTTP caller (the row is already committed);
      // loud log + swallow so one bad emit does not kill the batch.
      try {
        await emit("lead_created", { workspaceId, leadId: lead.id });
      } catch (err) {
        logger.error("api.discovery.emit_lead_created_failed", {
          leadId: lead.id,
          err: err instanceof Error ? err.message : String(err),
        });
      }
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
