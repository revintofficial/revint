/**
 * WEBSITE_AUDITOR worker wrapper for AI Core.
 *
 * Thin adapter over `src/lib/crawler.ts`'s `crawlWebsite` and the DB
 * upsert logic that previously lived in `src/workers/crawl-worker.ts`.
 * Registered here so the orchestrator can invoke the auditor as part
 * of the `lead_created` and other chains.
 *
 * Legacy flow note: the `crawl` queue still exists and fires on lead
 * ingestion via the discovery pipeline. This wrapper is idempotent
 * with that path - both converge on `prisma.websiteAudit.upsert` so
 * running it twice is safe.
 */
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { crawlWebsite } from "@/lib/crawler";
import type {
  AgentWorkerOutput,
  AgentWorkerRun,
  MemoryWrite,
} from "./types";

export const run: AgentWorkerRun = async (ctx): Promise<AgentWorkerOutput> => {
  if (!ctx.lead) throw new Error("WEBSITE_AUDITOR requires a lead context");
  const lead = ctx.lead;

  if (!lead.websiteUrl) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { crawlStatus: "NO_WEBSITE" },
    });
    return {
      output: { skipped: true, reason: "no_website" },
      costTokens: 0,
    };
  }

  await prisma.lead.update({
    where: { id: lead.id },
    data: { crawlStatus: "CRAWLING" },
  });

  try {
    const features = await crawlWebsite(lead.websiteUrl, lead.primaryType ?? undefined);
    const featuresWithExtras = features as typeof features & {
      contactEmails?: string[];
      socialProfiles?: Record<string, string | null>;
      bookingProvider?: string | null;
    };

    const contactEmails = featuresWithExtras.contactEmails ?? [];
    const socialProfiles = featuresWithExtras.socialProfiles ?? {};

    await prisma.websiteAudit.upsert({
      where: { leadId: lead.id },
      create: {
        leadId: lead.id,
        url: lead.websiteUrl,
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
      where: { id: lead.id },
      data: { crawlStatus: "CRAWLED" },
    });

    logger.info("agent_workers.website_auditor.done", {
      leadId: lead.id,
      reachable: features.reachable,
    });

    return {
      output: {
        reachable: features.reachable,
        url: lead.websiteUrl,
        hasContactForm: features.hasContactForm,
        hasBookingSystem: features.hasBookingSystem,
        servicesDetected: features.servicesDetected,
        contactEmails,
        socialProfiles,
      },
      costTokens: 0,
    };
  } catch (error) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { crawlStatus: "FAILED" },
    });
    const msg = error instanceof Error ? error.message : String(error);
    // Crawl failures (DNS, SSL, 404, fetch timeout, robots block) are
    // operational realities, not chain-breaking bugs. Returning a
    // skipped output keeps `audit` SKIPPED-but-optional in the
    // orchestrator (see chains.ts: audit.optional = true) instead of
    // hardFailing the whole session — Bug #4 in
    // research/finedine/discovery-bugs.md. The lead still surfaces
    // crawlStatus=FAILED in the UI for the user to act on, but
    // downstream classifier/score/dossier proceed.
    //
    // The diagnostic in research/finedine/discovery-bugs.md (and the
    // beta workspace bucketing query) showed the dominant failure
    // bucket today is the post-worker embedding step
    // ("Failed to embed after 3 attempts"), not crawl errors — those
    // are handled at the executor layer (see persistMemoryWrites).
    // No bucket warrants RetryableError today; carve one out here if
    // a future diagnostic surfaces a transient bucket worth retrying.
    logger.warn("agent_workers.website_auditor.crawl_failed_skipping", {
      leadId: lead.id,
      url: lead.websiteUrl,
      err: msg,
    });
    return {
      output: { skipped: true, reason: "crawl_failed", errorMsg: msg },
      costTokens: 0,
    };
  }
};

/**
 * Memory writes for the website auditor: we don't embed the full
 * site, but we do stash a compact "site audit" paragraph that the
 * copilot and scorer can retrieve alongside lead profile hits.
 */
export const memoryWrites = (output: unknown, ctx: { leadId: string | null; workspaceId: string }): MemoryWrite[] => {
  if (!ctx.leadId) return [];
  const o = output as {
    skipped?: boolean;
    reachable?: boolean;
    url?: string;
    hasContactForm?: boolean;
    hasBookingSystem?: boolean;
    servicesDetected?: unknown;
  };
  // Skipped runs (no website / crawl failed) have nothing useful to
  // embed; returning an empty list keeps the executor from calling
  // upsertAndEmbed on an unreachable URL placeholder.
  if (o?.skipped || !o?.reachable) return [];

  const services = Array.isArray(o.servicesDetected)
    ? (o.servicesDetected as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const text = [
    `Website audit: ${o.url}`,
    `Reachable: ${o.reachable ? "yes" : "no"}`,
    `Contact form: ${o.hasContactForm ? "yes" : "no"}`,
    `Booking system: ${o.hasBookingSystem ? "yes" : "no"}`,
    services.length ? `Services: ${services.slice(0, 12).join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return [
    {
      kind: "LEAD_PROFILE",
      text,
      leadId: ctx.leadId,
      refType: "website_audit",
      refId: ctx.leadId,
      metadata: { source: "website_auditor" },
    },
  ];
};
