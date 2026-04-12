import { Worker, type Job } from "bullmq";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { crawlWebsite, closeBrowser } from "../lib/crawler";
import IORedis from "ioredis";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

interface CrawlJobData {
  leadId: string;
  websiteUrl: string;
}

async function processCrawl(job: Job<CrawlJobData>) {
  const { leadId, websiteUrl } = job.data;

  console.log(`[Crawl] Starting: ${websiteUrl} (lead: ${leadId})`);

  await prisma.lead.update({
    where: { id: leadId },
    data: { crawlStatus: "CRAWLING" },
  });

  try {
    const features = await crawlWebsite(websiteUrl);

    await prisma.websiteAudit.upsert({
      where: { leadId },
      create: {
        leadId,
        url: websiteUrl,
        reachable: features.reachable,
        loadTimeMs: features.loadTimeMs,
        https: features.https,
        mobileFriendlyGuess: features.mobileFriendlyGuess,
        title: features.title,
        metaDescription: features.metaDescription,
        h1: features.h1,
        hasContactForm: features.hasContactForm,
        hasWhatsappLink: features.hasWhatsappLink,
        hasBookingSystem: features.hasBookingSystem,
        hasEcommerce: features.hasEcommerce,
        servicesDetected: features.servicesDetected,
        navItems: features.navItems,
        ctaLinks: features.ctaLinks,
        brokenLinksCount: features.brokenLinksCount,
        structuredDataPresent: features.structuredDataPresent,
        rawFeaturesJson: JSON.parse(JSON.stringify(features)),
      },
      update: {
        reachable: features.reachable,
        loadTimeMs: features.loadTimeMs,
        https: features.https,
        mobileFriendlyGuess: features.mobileFriendlyGuess,
        title: features.title,
        metaDescription: features.metaDescription,
        h1: features.h1,
        hasContactForm: features.hasContactForm,
        hasWhatsappLink: features.hasWhatsappLink,
        hasBookingSystem: features.hasBookingSystem,
        hasEcommerce: features.hasEcommerce,
        servicesDetected: features.servicesDetected,
        navItems: features.navItems,
        ctaLinks: features.ctaLinks,
        brokenLinksCount: features.brokenLinksCount,
        structuredDataPresent: features.structuredDataPresent,
        rawFeaturesJson: JSON.parse(JSON.stringify(features)),
      },
    });

    await prisma.lead.update({
      where: { id: leadId },
      data: { crawlStatus: "CRAWLED" },
    });

    console.log(`[Crawl] Done: ${websiteUrl} (reachable: ${features.reachable})`);
    return { reachable: features.reachable, url: websiteUrl };
  } catch (error) {
    await prisma.lead.update({
      where: { id: leadId },
      data: { crawlStatus: "FAILED" },
    });
    throw error;
  }
}

export function startCrawlWorker() {
  const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });

  const worker = new Worker<CrawlJobData>("crawl", processCrawl, {
    connection,
    concurrency: 3,
    limiter: { max: 10, duration: 60000 },
  });

  worker.on("completed", (job) => {
    console.log(`[Crawl] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Crawl] Job ${job?.id} failed:`, err.message);
  });

  process.on("SIGTERM", async () => {
    await closeBrowser();
    await worker.close();
  });

  return worker;
}
