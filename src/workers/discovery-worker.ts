import { Worker, type Job } from "bullmq";
import { discoverLeads, extractBoroughFromAddress } from "../lib/google-places";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { emit } from "../lib/ai-core/events";
import {
  assertCanCreateLeads,
  recordLeadsCreated,
  QuotaExceededError,
  getUsage,
} from "../lib/quotas";
import IORedis from "ioredis";

interface DiscoveryJobData {
  workspaceId: string;
  searchQuery: string;
  borough: { name: string; lat: number; lng: number };
  radiusMeters?: number;
}

async function processDiscovery(job: Job<DiscoveryJobData>) {
  const { workspaceId, searchQuery, borough, radiusMeters } = job.data;
  if (!workspaceId) {
    throw new Error("Discovery job missing workspaceId");
  }

  logger.info("worker.discovery.starting", { searchQuery, borough: borough.name });

  const places = await discoverLeads(searchQuery, borough, radiusMeters);

  logger.info("worker.discovery.found_places", {
    searchQuery,
    borough: borough.name,
    count: places.length,
  });

  let created = 0;
  let skipped = 0;
  let quotaBlocked = 0;

  for (const place of places) {
    const placeId = place.id;
    if (!placeId) continue;

    const existing = await prisma.lead.findUnique({
      where: { workspaceId_placeId: { workspaceId, placeId } },
    });

    if (existing) {
      skipped++;
      continue;
    }

    // Per-lead quota gate. Bulk discovery enqueues many jobs at once; the API
    // layer cannot pre-reserve quota across them, so we re-check here per
    // creation. When the workspace is over its plan we stop early - the user
    // sees the cap respected, and the rest of the queue exits cleanly.
    try {
      await assertCanCreateLeads(workspaceId, 1);
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        quotaBlocked = places.length - created - skipped;
        logger.warn("worker.discovery.quota_reached", {
          workspaceId,
          created,
          skipped,
          remaining: quotaBlocked,
          plan: err.planName,
          limit: err.limit,
          used: err.used,
        });
        break;
      }
      throw err;
    }

    const address = place.formattedAddress || "";
    const detectedBorough = extractBoroughFromAddress(address) || borough.name;
    const websiteUrl = place.websiteUri || null;

    const lead = await prisma.lead.create({
      data: {
        workspaceId,
        placeId,
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
        sourceQuery: `${searchQuery} in ${borough.name} London`,
        sourceLat: borough.lat,
        sourceLng: borough.lng,
        crawlStatus: websiteUrl ? "PENDING" : "NO_WEBSITE",
        analyzeStatus: "PENDING",
        // KVKK / GDPR: stamp the lead with where its data came from so we
        // have a defensible answer when a regulator asks "why did you
        // contact this business?". Public Google Places listings are a
        // legitimate-interest source for B2B outreach in TR / EU.
        consentSource: "PUBLIC_LISTING",
        consentRecordedAt: new Date(),
      },
      select: { id: true },
    });

    // Increment plan usage immediately after each successful create so
    // concurrent jobs (and the assertCanCreateLeads above) see the most
    // recent counter. Cheaper than a full transaction; small drift is OK.
    try {
      await recordLeadsCreated(workspaceId, 1);
    } catch (err) {
      logger.warn("worker.discovery.record_lead_failed", {
        leadId: lead.id,
        err: err instanceof Error ? err.message : String(err),
      });
    }

    // Kick off the AI Core `lead_created` chain (auditor + review +
    // scorer + sentinel embed). Failure to start the chain must not
    // roll back the lead row, so we swallow but log loudly.
    try {
      await emit("lead_created", { workspaceId, leadId: lead.id });
    } catch (err) {
      logger.error("worker.discovery.emit_lead_created_failed", {
        leadId: lead.id,
        err: err instanceof Error ? err.message : String(err),
      });
    }
    created++;
  }

  logger.info("worker.discovery.done", {
    created,
    skipped,
    quotaBlocked,
    total: places.length,
  });
  // Surface the latest counters so the UI / planner can observe usage.
  const usage = await getUsage(workspaceId).catch(() => null);
  return {
    created,
    skipped,
    quotaBlocked,
    total: places.length,
    leadsUsed: usage?.leadsUsed ?? null,
    leadsRemaining: usage?.leadsRemaining ?? null,
  };
}

export function startDiscoveryWorker() {
  const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });

  const worker = new Worker<DiscoveryJobData>("discovery", processDiscovery, {
    connection,
    concurrency: 2,
    limiter: { max: 5, duration: 60000 },
  });

  worker.on("completed", (job) => {
    logger.info("worker.discovery.job_completed", { jobId: job.id });
  });

  worker.on("failed", (job, err) => {
    logger.error("worker.discovery.job_failed", { jobId: job?.id, err });
  });

  return worker;
}
