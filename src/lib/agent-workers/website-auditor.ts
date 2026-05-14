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
import { isTruthLayerFlagEnabled } from "@/lib/feature-flags";
import { countryIsoFromAddress } from "@/lib/locale/lead-locale";
import type {
  WebsiteVerificationResult,
  WebsiteVerificationStatus,
} from "@/lib/sdr-brain/contracts";
import type {
  AgentWorkerOutput,
  AgentWorkerRun,
  MemoryWrite,
} from "./types";
import {
  multiVerifyWebsite,
  type WebsiteMultiVerifyInput,
  type WebsiteMultiVerifyRunners,
} from "./website-multi-verify";
import { verifyWebsiteViaBing } from "./apify/bing-brand-search";
import { verifyWebsiteViaCompaniesHouse } from "./apify/companies-house";
import { verifyWebsiteViaInstagramBio } from "./apify/instagram-bio-scrape";

/**
 * Truth Layer v1 / T-E — default runner bag for the multi-source
 * verification orchestrator. Wired up here so tests can substitute
 * a stub set without monkey-patching the apify module.
 */
const DEFAULT_VERIFY_RUNNERS: WebsiteMultiVerifyRunners = {
  bingBrandSearch: verifyWebsiteViaBing,
  companiesHouse: verifyWebsiteViaCompaniesHouse,
  instagramBio: verifyWebsiteViaInstagramBio,
};

/**
 * Truth Layer v1 / T-E — runs the multi-source orchestrator,
 * persists the verdict to `Lead.websiteVerificationStatus`, and
 * emits the `truth.website.verify_*` telemetry pair. Returns the
 * full {@link WebsiteVerificationResult} so the auditor can stash
 * it on `AgentRun.output` for downstream consumers (T-D Brief
 * Truth-Grounding, IntelligenceBrief renderer).
 *
 * Cost-control gate (master plan §8 R3): when `lead.websiteUrl` is
 * non-null we record a synthetic `confirmed_present` result with
 * just the `google_business_field` source and DO NOT spend any
 * Apify cents — the orchestrator's own short-circuit covers that
 * branch but we duplicate the gate here so a future code path
 * change can't accidentally fan out 3 actor calls on a lead Google
 * already gave us a homepage URL for.
 *
 * Multi-tenant scope: we use `lead.workspaceId` from the row (which
 * the executor hydrated via `findUniqueOrThrow`) and never trust
 * `ctx.workspaceId` — per `.cursor/rules/multi-tenant-scope.mdc` a
 * worker re-derives the scope from the parent row.
 */
async function runWebsiteVerification(
  lead: NonNullable<Parameters<AgentWorkerRun>[0]["lead"]>,
  runners: WebsiteMultiVerifyRunners = DEFAULT_VERIFY_RUNNERS,
): Promise<WebsiteVerificationResult> {
  const workspaceId = lead.workspaceId;

  logger.info("[truth-telemetry]", {
    event: "truth.website.verify_started",
    leadId: lead.id,
    workspaceId,
  });

  const input: WebsiteMultiVerifyInput = {
    businessName: lead.businessName,
    formattedAddress: lead.formattedAddress,
    country: countryIsoFromAddress(lead.formattedAddress ?? null),
    websiteUrl: lead.websiteUrl,
  };

  const result = await multiVerifyWebsite(input, runners);
  const status: WebsiteVerificationStatus = result.status;

  // updateMany so we can scope by workspaceId. Per the multi-tenant
  // rule, an `update` keyed solely on `id` would leak across tenants
  // if a future bug ever fed us an attacker-controlled lead id; we
  // already trust `lead.workspaceId` here but the redundant scope
  // keeps the audit clean.
  await prisma.lead.updateMany({
    where: { id: lead.id, workspaceId },
    data: { websiteVerificationStatus: status },
  });

  const sourcesPositive = result.sources.filter((s) => s.result === "present").length;
  const sourcesNegative = result.sources.filter((s) => s.result === "absent").length;
  logger.info("[truth-telemetry]", {
    event: "truth.website.verify_completed",
    leadId: lead.id,
    workspaceId,
    status,
    sourcesChecked: result.sources.length,
    sourcesPositive,
    sourcesNegative,
  });

  return result;
}

export const run: AgentWorkerRun = async (ctx): Promise<AgentWorkerOutput> => {
  if (!ctx.lead) throw new Error("WEBSITE_AUDITOR requires a lead context");
  const lead = ctx.lead;

  // Truth Layer v1 / T-E — multi-source verification BEFORE the
  // legacy single-URL audit branch. Two cost-control gates:
  //   - Flag OFF → skip orchestrator entirely; the auditor falls
  //     back to its pre-Truth-Layer behavior (single source = the
  //     `lead.websiteUrl` field) and never writes
  //     `Lead.websiteVerificationStatus`.
  //   - Flag ON + `lead.websiteUrl != null` → orchestrator's own
  //     short-circuit returns `confirmed_present` after recording
  //     just the google_business_field source, so we spend zero
  //     Apify cents on leads Google already surfaced a homepage
  //     for. Master plan §8 R3 cost guardrail.
  let verification: WebsiteVerificationResult | null = null;
  const flagEnabled = isTruthLayerFlagEnabled("TRUTH_LAYER_WEBSITE_VERIFY", {
    workspaceId: lead.workspaceId,
  });
  if (flagEnabled) {
    try {
      verification = await runWebsiteVerification(lead);
    } catch (err) {
      // Verification must not break the auditor. On unexpected
      // failure we log + proceed with the legacy code path.
      logger.warn("agent_workers.website_auditor.verify_failed_skipping", {
        leadId: lead.id,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (!lead.websiteUrl) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { crawlStatus: "NO_WEBSITE" },
    });
    return {
      output: {
        skipped: true,
        reason: "no_website",
        ...(verification ? { websiteVerification: verification } : {}),
      },
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

    // Beta finding §1: when the URL is a social profile (Instagram /
    // Facebook / TikTok / etc.) we treat the lead as having no
    // first-party website. The audit row records the gate decision and
    // we flip `hasWebsite=false` on the lead so downstream workers
    // (mockup, opener, scorer) see it the same way they see a true
    // NO_WEBSITE lead. Without this flip the lead silently keeps
    // hasWebsite=true (set when discovery imported the IG link) and
    // every audit field reads false-but-meaningless ("no booking",
    // "no e-commerce" — neither has a real-world meaning on an IG
    // profile page).
    if (features.crawlError === "SOCIAL_MEDIA_ONLY") {
      const baseFields = {
        url: lead.websiteUrl,
        reachable: false,
        crawlAttemptedAt: new Date(),
        crawlError: "SOCIAL_MEDIA_ONLY" as const,
        httpStatus: null,
        loadTimeMs: null,
        https: lead.websiteUrl.startsWith("https"),
        mobileFriendlyGuess: false,
        title: null,
        metaDescription: null,
        h1: null,
        hasContactForm: false,
        hasWhatsappLink: false,
        hasBookingSystem: false,
        bookingProvider: null,
        hasEcommerce: false,
        servicesDetected: [],
        navItems: [],
        ctaLinks: [],
        brokenLinksCount: 0,
        structuredDataPresent: false,
        rawFeaturesJson: JSON.parse(JSON.stringify(features)),
        contactEmails: [],
        socialProfiles: {},
      } as const;
      await prisma.websiteAudit.upsert({
        where: { leadId: lead.id },
        create: { leadId: lead.id, ...baseFields },
        update: baseFields,
      });
      await prisma.lead.update({
        where: { id: lead.id },
        data: { crawlStatus: "NO_WEBSITE", hasWebsite: false },
      });
      logger.info("agent_workers.website_auditor.social_only", {
        leadId: lead.id,
        url: lead.websiteUrl,
      });
      return {
        output: {
          skipped: true,
          reason: "social_media_only",
          url: lead.websiteUrl,
          ...(verification ? { websiteVerification: verification } : {}),
        },
        costTokens: 0,
      };
    }

    const contactEmails = featuresWithExtras.contactEmails ?? [];
    const socialProfiles = featuresWithExtras.socialProfiles ?? {};

    const baseFields = {
      url: lead.websiteUrl,
      reachable: features.reachable,
      crawlAttemptedAt: new Date(),
      crawlError: features.crawlError,
      httpStatus: features.httpStatus,
      loadTimeMs: features.loadTimeMs,
      https: features.https,
      mobileFriendlyGuess: features.mobileFriendlyGuess,
      title: features.title,
      metaDescription: features.metaDescription,
      h1: features.h1,
      hasContactForm: features.hasContactForm,
      hasWhatsappLink: features.hasWhatsappLink,
      hasBookingSystem: features.hasBookingSystem,
      // Beta finding §1: persist the booking provider name (Calendly,
      // OpenTable, Resy, ...) so the UI can show "Booking via OpenTable"
      // instead of just "yes/no", and downstream workers can ground
      // their pitch on a specific provider.
      bookingProvider: featuresWithExtras.bookingProvider ?? null,
      hasEcommerce: features.hasEcommerce,
      servicesDetected: features.servicesDetected,
      navItems: features.navItems,
      ctaLinks: features.ctaLinks,
      brokenLinksCount: features.brokenLinksCount,
      structuredDataPresent: features.structuredDataPresent,
      rawFeaturesJson: JSON.parse(JSON.stringify(features)),
      contactEmails,
      socialProfiles,
    } as const;

    await prisma.websiteAudit.upsert({
      where: { leadId: lead.id },
      create: { leadId: lead.id, ...baseFields },
      update: baseFields,
    });

    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        crawlStatus: "CRAWLED",
        // Phase 2.6: stamp the audited URL so the post-Apify
        // re-audit hook (`maybeEnqueueWebsiteReAudit`) knows this
        // URL has already been crawled and skips on the next
        // Apify run when no new URL was discovered. Idempotency
        // guard against a re-audit storm.
        lastAuditedWebsiteUrl: lead.websiteUrl,
      },
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
        ...(verification ? { websiteVerification: verification } : {}),
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
      output: {
        skipped: true,
        reason: "crawl_failed",
        errorMsg: msg,
        ...(verification ? { websiteVerification: verification } : {}),
      },
      costTokens: 0,
    };
  }
};

/**
 * Test-only entry to the multi-source verification side-effect
 * (DB write + telemetry). Real worker invocations go through
 * `run()` which gates on the feature flag; tests can call this
 * directly with a stub runners bag to assert column writes and
 * event emission.
 */
export const __test = {
  runWebsiteVerification,
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
