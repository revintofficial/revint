import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { discoverLeads, extractBoroughFromAddress } from "@/lib/google-places";
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
import { getNicheBySlug, getChildrenOf, isParentNiche } from "@/lib/niches";
import { geocodeBorough } from "@/lib/geocoding";

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
      // Niche pack slug. When this is a parent slug for a hybrid pack
      // (e.g. "fnb"), the route fans out to every child's primary search
      // query in parallel and dedups the results by Place ID. The
      // child's search query is recorded on each lead as
      // `discoverySourceQuery` so the rule-based classifier can use it
      // as a strong prior. When this is a child or flat pack slug, the
      // route degenerates to a single-query search using `searchQuery`
      // (the picker's selected query, defaulted from the pack).
      nichePackSlug,
    }: {
      searchQuery?: string;
      boroughName?: string;
      radiusMeters?: number;
      runAll?: boolean;
      country?: string;
      nichePackSlug?: string;
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

    if (!boroughName) {
      return NextResponse.json(
        { error: "boroughName is required" },
        { status: 400 },
      );
    }

    // Resolve niche pack (if any). Two routes diverge here:
    //   - parent pack with children → fan-out: run every child's primary
    //     query in parallel, dedup by placeId, attribute each lead to
    //     the query that surfaced it. The classifier later assigns
    //     subNicheSlug; we set nicheSlug = parent up-front.
    //   - leaf pack OR no pack → single-query search using `searchQuery`.
    const pack = nichePackSlug ? getNicheBySlug(nichePackSlug) ?? null : null;
    const fanOut = pack && isParentNiche(pack.slug);

    // Resolve workspace country for the query context when not passed explicitly.
    // Also pull the target sub-niche focus list so we can narrow fan-out fan-out
    // queries to only the child packs the team actually pitches.
    const countryFromBody: string | undefined = body.country;
    let country = countryFromBody;
    let targetSubNiches: string[] = [];
    const wsCtx = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { country: true, targetSubNiches: true },
    });
    if (!country) country = wsCtx?.country ?? undefined;
    targetSubNiches = wsCtx?.targetSubNiches ?? [];

    // Geocode the free-typed borough into { lat, lng } so discoverLeads
    // can attach a hard locationRestriction circle. Without this, Google
    // Places treats the borough name as a soft hint and returns matches
    // in the wrong city / country (see Bug #1, Istanbul → Basel,
    // Maltepe, Pendik). geocodeBorough returns null on any failure
    // (key missing, API disabled, ZERO_RESULTS) — fall back to the
    // pre-existing name-only behaviour rather than blocking the
    // search.
    const tGeo = Date.now();
    const coords = await geocodeBorough(boroughName, country).catch(() => null);
    const location: {
      name: string;
      country?: string;
      lat?: number;
      lng?: number;
    } = {
      name: boroughName,
      country,
      ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
    };
    logger.info("api.discovery.geocode_resolved", {
      workspaceId,
      borough: boroughName,
      country,
      hasCoords: !!coords,
      ms: Date.now() - tGeo,
    });

    type SourcedPlace = {
      place: Awaited<ReturnType<typeof discoverLeads>>[number];
      sourceQuery: string;
    };

    let sourced: SourcedPlace[] = [];

    if (fanOut && pack) {
      const allChildren = getChildrenOf(pack.slug);
      // Narrow to the workspace's `targetSubNiches` if set; otherwise fan
      // out across every child. Empty list = "target all", matching the
      // form's empty-default semantics.
      const focusSet = new Set(targetSubNiches);
      const children =
        focusSet.size > 0
          ? allChildren.filter((c) => focusSet.has(c.slug))
          : allChildren;

      // Build the (child, query, includedTypes) leg list. We iterate
      // the FIRST TWO searchQueries per child so a single fan-out
      // surfaces multiple intent variations (e.g. fnb-bar-club hits
      // both "cocktail bar" and "wine bar") while keeping per-Discovery
      // Places API calls bounded. Each leg also forwards the child's
      // discoveryPlaceTypes as includedType, which Google enforces
      // server-side so "food truck" cannot return a building-materials
      // store (Bug #2).
      type FanLeg = {
        childSlug: string;
        query: string;
        includedTypes: string[] | undefined;
      };
      const legs: FanLeg[] = [];
      for (const c of children) {
        const queriesForChild = c.searchQueries.slice(0, 2);
        for (const q of queriesForChild) {
          if (!q) continue;
          legs.push({
            childSlug: c.slug,
            query: q,
            includedTypes: c.discoveryPlaceTypes,
          });
        }
      }

      const t0 = Date.now();
      logger.info("api.discovery.fanout_start", {
        workspaceId,
        parent: pack.slug,
        legCount: legs.length,
        childCount: children.length,
        focusedTo: focusSet.size > 0 ? Array.from(focusSet) : "all",
        location: boroughName,
        country,
        hasCoords: !!coords,
      });

      // Parallel fan-out. Failures are isolated per leg so one bad
      // query (or rate limit) doesn't blow the whole batch.
      const settled = await Promise.allSettled(
        legs.map(async (leg) => {
          const places = await discoverLeads(leg.query, location, radiusMeters, {
            includedTypes: leg.includedTypes,
          });
          return places.map((p) => ({ place: p, sourceQuery: leg.query }));
        }),
      );

      const allSourced: SourcedPlace[] = [];
      const failedQueries: string[] = [];
      settled.forEach((r, i) => {
        if (r.status === "fulfilled") {
          allSourced.push(...r.value);
        } else {
          failedQueries.push(legs[i].query);
          logger.error("api.discovery.fanout_query_failed", {
            query: legs[i].query,
            childSlug: legs[i].childSlug,
            err: r.reason instanceof Error ? r.reason.message : String(r.reason),
          });
        }
      });

      // Dedup by Place ID; keep the FIRST source query that found it
      // because earlier queries in the children array are the more
      // specific (highest-confidence prior) ones.
      const seen = new Set<string>();
      sourced = [];
      for (const item of allSourced) {
        if (!item.place.id || seen.has(item.place.id)) continue;
        seen.add(item.place.id);
        sourced.push(item);
      }

      logger.info("api.discovery.fanout_done", {
        workspaceId,
        parent: pack.slug,
        totalRaw: allSourced.length,
        deduped: sourced.length,
        failedCount: failedQueries.length,
        ms: Date.now() - t0,
      });
    } else {
      // Single-query path. searchQuery is required when not fanning out.
      if (!searchQuery) {
        return NextResponse.json(
          { error: "searchQuery is required when no parent niche pack is selected" },
          { status: 400 },
        );
      }

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
      sourced = places.map((p) => ({ place: p, sourceQuery: searchQuery }));
    }

    // Niche slug stamping: parent fan-out → parent slug; leaf pack → its
    // own slug; no pack → null. The classifier later writes subNicheSlug
    // for hybrid parent leads; leaf packs are already at the rollup level
    // so no classification is needed.
    const nicheSlugForLeads = pack
      ? fanOut
        ? pack.slug
        : pack.parentSlug ?? pack.slug
      : null;

    let created = 0;
    let skipped = 0;
    let quotaHit: string | null = null;
    const tDb = Date.now();

    for (const { place, sourceQuery: srcQ } of sourced) {
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
      // Bug #7: prefer the structured Google address component (works
      // for any country) over the user-typed borough string. We fall
      // back to the user input only when Google didn't return a
      // recognisable component — e.g. coastal / industrial addresses
      // where there is no admin_area_level_2 anywhere in the chain.
      const detectedBorough =
        extractBoroughFromAddress(address, place.addressComponents) ??
        boroughName;
      const lead = await prisma.lead.create({
        data: {
          workspaceId,
          placeId: place.id,
          businessName: place.displayName?.text || "Unknown",
          formattedAddress: address,
          borough: detectedBorough,
          phone: place.nationalPhoneNumber || null,
          websiteUrl,
          hasWebsite: !!websiteUrl,
          googleMapsUri: place.googleMapsUri || null,
          rating: place.rating || null,
          reviewCount: place.userRatingCount || null,
          businessStatus: place.businessStatus || null,
          primaryType: place.primaryType || null,
          sourceQuery: `${srcQ} in ${boroughName}`,
          sourceLat: undefined,
          sourceLng: undefined,
          crawlStatus: websiteUrl ? "PENDING" : "NO_WEBSITE",
          analyzeStatus: "PENDING",
          // Hybrid-niche stamping. Setting nicheSlug here means the
          // classifier worker has the parent in hand at run time, and
          // discoverySourceQuery becomes a high-quality prior for the
          // rule-based classifier (e.g. lead surfaced by "cocktail bar"
          // → fnb-bar-club is almost certain).
          nicheSlug: nicheSlugForLeads,
          discoverySourceQuery: srcQ,
        },
        select: { id: true },
      });
      await recordLeadsCreated(workspaceId, 1);

      // Fire the AI Core `lead_created` chain. INTENTIONALLY NOT awaited:
      // a fan-out can produce 50-100 leads, and emit() does a
      // plannerSession.create + enqueueAdvance per call. With Redis
      // hiccups the enqueue path falls through to inline orchestration
      // (see orchestrator.enqueueAdvance), which compounded with the
      // serial DB write loop pushes total wall time past the 90s
      // client-side abort. The lead row is already committed by this
      // point, the AI Core chain processes asynchronously, and any
      // emit failure is logged-but-non-fatal — exactly what
      // fire-and-forget is for.
      void emit("lead_created", { workspaceId, leadId: lead.id }).catch(
        (err) => {
          logger.error("api.discovery.emit_lead_created_failed", {
            leadId: lead.id,
            err: err instanceof Error ? err.message : String(err),
          });
        },
      );
      created++;
    }

    logger.info("api.discovery.db_done", {
      workspaceId,
      created,
      skipped,
      total: sourced.length,
      fanOut: !!fanOut,
      ms: Date.now() - tDb,
    });

    return NextResponse.json({
      success: true,
      created,
      skipped,
      total: sourced.length,
      fanOut: !!fanOut,
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
