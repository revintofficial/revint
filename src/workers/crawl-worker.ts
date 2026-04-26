import { Worker, type Job } from "bullmq";
import { crawlWebsite, closeBrowser } from "../lib/crawler";
import { getEmailVerificationQueue } from "../lib/queues";
import { isVerificationConfigured } from "../lib/email-verification";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { notifyBookingDetected } from "../lib/email/notifications";
import IORedis from "ioredis";

interface CrawlJobData {
  leadId: string;
  websiteUrl: string;
}

interface CrawlFeaturesWithExtras {
  bookingProvider?: string | null;
}

async function processCrawl(job: Job<CrawlJobData>) {
  const { leadId, websiteUrl } = job.data;

  logger.info("worker.crawl.starting", { leadId, websiteUrl });

  await prisma.lead.update({
    where: { id: leadId },
    data: { crawlStatus: "CRAWLING" },
  });

  try {
    const leadForType = await prisma.lead.findUnique({ where: { id: leadId }, select: { primaryType: true } });
    const features = await crawlWebsite(websiteUrl, leadForType?.primaryType ?? undefined);

    const featuresWithExtras = features as typeof features & {
      contactEmails?: string[];
      socialProfiles?: Record<string, string | null>;
    };

    const contactEmails = featuresWithExtras.contactEmails ?? [];
    const socialProfiles = featuresWithExtras.socialProfiles ?? {};

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
        contactEmails,
        socialProfiles,
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
        contactEmails,
        socialProfiles,
      },
    });

    await prisma.lead.update({
      where: { id: leadId },
      data: { crawlStatus: "CRAWLED" },
    });

    // Fire booking-detected alert when we find an embedded booking system.
    // This is *negative* signal for the "modernize" pitch segment, so the
    // email prompts the owner to pursue a different angle. Cooldown is
    // enforced in the notifier.
    const bookingProvider =
      (featuresWithExtras as CrawlFeaturesWithExtras).bookingProvider ?? null;
    if (features.hasBookingSystem && bookingProvider) {
      try {
        const lead = await prisma.lead.findUnique({
          where: { id: leadId },
          select: { workspaceId: true, businessName: true },
        });
        if (lead) {
          await notifyBookingDetected({
            workspaceId: lead.workspaceId,
            leadId,
            businessName: lead.businessName,
            provider: bookingProvider,
          });
        }
      } catch (notifyErr) {
        logger.warn("worker.crawl.notify_booking_failed", { leadId, err: notifyErr });
      }
    }

    // P0.4 - auto-enqueue email verification when ZeroBounce is configured.
    if (contactEmails.length > 0 && isVerificationConfigured()) {
      try {
        await getEmailVerificationQueue().add(
          "verify",
          { leadId },
          { removeOnComplete: 100, removeOnFail: 50 },
        );
      } catch (verifyErr) {
        logger.warn("worker.crawl.email_verification_enqueue_failed", {
          leadId,
          err: verifyErr,
        });
      }
    }

    logger.info("worker.crawl.done", {
      leadId,
      websiteUrl,
      reachable: features.reachable,
    });
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
    logger.info("worker.crawl.job_completed", { jobId: job.id });
  });

  worker.on("failed", (job, err) => {
    logger.error("worker.crawl.job_failed", { jobId: job?.id, err });
  });

  process.on("SIGTERM", async () => {
    await closeBrowser();
    await worker.close();
  });

  return worker;
}
