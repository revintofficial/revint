import { Worker, type Job } from "bullmq";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { discoverLeads, extractBoroughFromAddress } from "../lib/google-places";
import IORedis from "ioredis";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

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

  console.log(`[Discovery] Starting: "${searchQuery}" in ${borough.name}`);

  const places = await discoverLeads(searchQuery, borough, radiusMeters);

  console.log(`[Discovery] Found ${places.length} places for "${searchQuery}" in ${borough.name}`);

  let created = 0;
  let skipped = 0;

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

    const address = place.formattedAddress || "";
    const detectedBorough = extractBoroughFromAddress(address) || borough.name;
    const websiteUrl = place.websiteUri || null;

    await prisma.lead.create({
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
      },
    });
    created++;
  }

  console.log(`[Discovery] Done: ${created} created, ${skipped} duplicates`);
  return { created, skipped, total: places.length };
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
    console.log(`[Discovery] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Discovery] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
