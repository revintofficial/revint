/**
 * APIFY_GMAPS_DEEP - Google Maps deep scraper.
 *
 * Hits `compass/crawler-google-places` with the lead's
 * `businessName + formattedAddress` (or `placeId` when present) and
 * pulls up to 500 reviews (default; overridable via `runInputs.maxReviews`
 * when triggered from the UI) + emails + social links + photos + Q&A.
 *
 * Writes:
 *   - REVIEW_CHUNK rows (one per review, text = review body)
 *   - Upserts extracted emails + social profiles into WebsiteAudit
 *     so downstream workers (opener-writer, email-verifier) see them
 *   - Replaces the top-50 GoogleReview rows with the deeper set
 */
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { isConfigured, runSync } from "@/lib/apify";
import { getAgentRunsQueue } from "@/lib/queues";
import type {
  AgentWorkerContext,
  AgentWorkerOutput,
  AgentWorkerRun,
  MemoryWrite,
} from "../types";

/**
 * Phase 2.6 — Normalize a raw website URL so the idempotency
 * comparison (`lastAuditedWebsiteUrl === newUrl`) is robust to
 * trivial differences (trailing slash, http/https, www vs no-www,
 * uppercase scheme, mixed-case host). Returns `null` when the input
 * is not parseable as a URL — in that case we skip the re-audit
 * trigger entirely rather than persist garbage.
 *
 * Kept intentionally conservative: we DO preserve the path so two
 * pages on the same site (e.g. /menu vs /reservations) are treated
 * as distinct — the auditor's behavior depends on the exact path
 * the discovery flow surfaced.
 */
function normalizeWebsiteUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    url.hash = "";
    // Strip a single trailing slash from the pathname for "/" only;
    // leave deep paths intact ("/menu/" vs "/menu" are usually the
    // same page so we drop trailing "/" everywhere).
    if (url.pathname.endsWith("/") && url.pathname.length > 1) {
      url.pathname = url.pathname.slice(0, -1);
    }
    // Lower-case host (already does so via WHATWG URL) and drop the
    // common "www." prefix to dedupe www / non-www variants of the
    // same site.
    const host = url.host.replace(/^www\./i, "");
    return `${url.protocol}//${host}${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

/**
 * Phase 2.6 — When Apify Gmaps Deep returns a `website` for a lead
 * that previously had none (or a different one), update the lead row
 * and enqueue a `WEBSITE_AUDITOR` re-run so downstream workers see
 * the freshly-crawled site without waiting for the next manual
 * trigger.
 *
 * Idempotency: the re-audit only fires when the normalized new URL
 * differs from `lead.lastAuditedWebsiteUrl`. The auditor itself
 * stamps `lastAuditedWebsiteUrl` on every successful crawl, so a
 * second Apify run that returns the same site is a no-op here.
 *
 * Failure modes (all silent — the parent Apify run still succeeds):
 *   - new URL is unparseable: skip.
 *   - new URL matches the audited URL: skip.
 *   - the AgentRun row insert races (another concurrent audit just
 *     enqueued): swallow the error and log it; the racing audit
 *     will land the data we needed anyway.
 *   - Redis enqueue fails: log and continue. The PENDING AgentRun
 *     row is still in the DB and the next executor poll picks it up
 *     (the orchestrator's `enqueueAdvance` style path), or the rep
 *     can hit "Run again" manually.
 */
async function maybeEnqueueWebsiteReAudit(args: {
  workspaceId: string;
  lead: AgentWorkerContext["lead"];
  discoveredWebsite: string | null | undefined;
}): Promise<{ enqueued: boolean; reason: string; newUrl: string | null }> {
  const { workspaceId, lead, discoveredWebsite } = args;
  if (!lead) return { enqueued: false, reason: "no_lead", newUrl: null };

  const newUrl = normalizeWebsiteUrl(discoveredWebsite);
  if (!newUrl) {
    return { enqueued: false, reason: "no_or_invalid_url", newUrl: null };
  }

  const currentNormalized = normalizeWebsiteUrl(lead.websiteUrl);
  const lastAuditedNormalized = normalizeWebsiteUrl(lead.lastAuditedWebsiteUrl);

  // Already audited the exact same URL — nothing to do.
  if (lastAuditedNormalized === newUrl) {
    return { enqueued: false, reason: "url_already_audited", newUrl };
  }

  // Persist the discovered URL onto the lead so the next auditor
  // run picks it up. We always update lead.websiteUrl + hasWebsite
  // when the URL is new (regardless of whether enqueue succeeds)
  // so the row reflects reality even if the BullMQ side dies.
  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      websiteUrl: discoveredWebsite ?? null,
      hasWebsite: true,
      // Reset crawl status to PENDING so any UI surface that
      // distinguishes "audited" from "queued" reflects the truth.
      crawlStatus: currentNormalized === newUrl ? lead.crawlStatus : "PENDING",
    },
  });

  // Don't trigger if the lead URL hasn't actually changed AND we've
  // already audited it — handled above. Trigger when (a) URL changed
  // OR (b) URL same but lastAudited is stale (older crawler couldn't
  // reach, now Apify confirmed the URL exists, worth retry).
  let runId: string | null = null;
  try {
    const created = await prisma.agentRun.create({
      data: {
        workspaceId,
        leadId: lead.id,
        userId: null,
        workerKind: "WEBSITE_AUDITOR",
        status: "PENDING",
        inputsJson: { triggeredBy: "apify_gmaps_deep_website_discovery" } as never,
      },
      select: { id: true },
    });
    runId = created.id;
  } catch (err) {
    logger.warn("apify.gmaps_deep.reaudit_create_failed", {
      leadId: lead.id,
      err: err instanceof Error ? err.message : String(err),
    });
    return { enqueued: false, reason: "agent_run_create_failed", newUrl };
  }

  try {
    const queue = getAgentRunsQueue();
    await queue.add(
      `agent-run-${runId}`,
      { runId },
      {
        attempts: 2,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 500,
        removeOnFail: 500,
      },
    );
  } catch (err) {
    // Redis down — leave the AgentRun row PENDING; the next
    // executor poll / manual retry picks it up. Logged loudly
    // because a missed re-audit means stale audit data downstream.
    logger.warn("apify.gmaps_deep.reaudit_enqueue_failed", {
      leadId: lead.id,
      runId,
      err: err instanceof Error ? err.message : String(err),
    });
    return { enqueued: false, reason: "queue_unavailable", newUrl };
  }

  logger.info("apify.gmaps_deep.reaudit_enqueued", {
    leadId: lead.id,
    runId,
    newUrl,
    previousAuditedUrl: lastAuditedNormalized,
  });
  return { enqueued: true, reason: "url_changed_or_first_audit", newUrl };
}

const ACTOR_ID = "compass/crawler-google-places";
const DEFAULT_MAX_REVIEWS = 500;

function resolveMaxReviews(ctx: AgentWorkerContext): number {
  const raw = ctx.runInputs?.maxReviews;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(1, Math.min(DEFAULT_MAX_REVIEWS, Math.floor(raw)));
  }
  return DEFAULT_MAX_REVIEWS;
}

interface PlaceItem {
  placeId?: string;
  title?: string;
  address?: string;
  phone?: string;
  website?: string;
  emails?: string[];
  reviewsCount?: number;
  totalScore?: number;
  reviews?: Array<{
    reviewId?: string;
    name?: string;
    stars?: number;
    text?: string | null;
    publishedAtDate?: string;
    reviewerPhotoUrl?: string;
  }>;
  url?: string;
  socials?: string[];
  facebooks?: string[];
  instagrams?: string[];
  linkedIns?: string[];
  youtubes?: string[];
  tiktoks?: string[];
  twitters?: string[];
}

export const run: AgentWorkerRun = async (ctx): Promise<AgentWorkerOutput> => {
  if (!ctx.lead) throw new Error("APIFY_GMAPS_DEEP requires a lead context");
  if (!isConfigured()) {
    return { output: { skipped: true, reason: "apify_not_configured" }, costTokens: 0, costUsdCents: 0 };
  }

  const lead = ctx.lead;

  const maxReviews = resolveMaxReviews(ctx);

  // Actor input - prefer placeId if we have it, otherwise search by
  // name + address. `maxReviews` caps spend.
  const input = {
    startUrls: lead.googleMapsUri
      ? [{ url: lead.googleMapsUri }]
      : undefined,
    searchStringsArray: lead.googleMapsUri
      ? undefined
      : [`${lead.businessName} ${lead.formattedAddress}`],
    maxCrawledPlacesPerSearch: 1,
    maxReviews,
    language: ctx.workspace.language ?? "en",
    countryCode: "gb",
    scrapeReviewerName: true,
    scrapeReviewerId: false,
    scrapeReviewUrl: false,
    scrapeReviewerUrl: false,
    scrapeResponseFromOwnerText: false,
    includeWebResults: true,
    scrapeImages: false,
    scrapeContacts: true,
  };

  const result = await runSync<PlaceItem>(ACTOR_ID, input, { timeoutSec: 300 });

  const place = result.items[0];
  if (!place) {
    logger.warn("apify.gmaps_deep.no_place", { leadId: lead.id });
    return {
      output: { skipped: true, reason: "no_place_found", durationMs: result.durationMs },
      costUsdCents: result.costUsdCents,
    };
  }

  // Upsert the deeper review set into the GoogleReview table. We
  // delete-then-insert the lead's reviews rather than per-row upsert
  // because Apify review IDs are unstable across runs.
  //
  // Rating-only reviews (stars without a text body) were previously
  // filtered out, which silently dropped a significant fraction of
  // Google Maps data the workspace was billed for. Retained now; the
  // downstream REVIEW_ANALYST grounding check is what should care
  // about text presence, not the ingestion step.
  const reviews = Array.isArray(place.reviews) ? place.reviews : [];
  if (reviews.length > 0) {
    const rows = reviews
      .filter((r) => typeof r.stars === "number" || typeof r.text === "string")
      .map((r) => ({
        leadId: lead.id,
        authorName: r.name ?? "Anonymous",
        authorPhoto: r.reviewerPhotoUrl ?? null,
        rating: Math.max(1, Math.min(5, Math.round(r.stars ?? 5))),
        text: typeof r.text === "string" ? r.text : null,
        relativeTime: "",
        publishTime: r.publishedAtDate ? new Date(r.publishedAtDate) : new Date(),
      }));
    if (rows.length > 0) {
      // Atomic swap: delete old reviews + insert new in one transaction
      // so a crash between phases never leaves the lead with zero
      // reviews. See src/app/api/reviews/[leadId]/route.ts for the
      // same pattern in the manual-refresh path.
      await prisma.$transaction([
        prisma.googleReview.deleteMany({ where: { leadId: lead.id } }),
        prisma.googleReview.createMany({ data: rows }),
      ]);
    }
  }

  // Merge extracted contacts into WebsiteAudit for downstream workers.
  const socials: Record<string, string | null> = {};
  if (place.facebooks?.[0]) socials.facebook = place.facebooks[0];
  if (place.instagrams?.[0]) socials.instagram = place.instagrams[0];
  if (place.linkedIns?.[0]) socials.linkedin = place.linkedIns[0];
  if (place.youtubes?.[0]) socials.youtube = place.youtubes[0];
  if (place.tiktoks?.[0]) socials.tiktok = place.tiktoks[0];
  if (place.twitters?.[0]) socials.twitter = place.twitters[0];

  if (place.emails || Object.keys(socials).length > 0) {
    const audit = await prisma.websiteAudit.findUnique({
      where: { leadId: lead.id },
      select: { id: true, contactEmails: true, socialProfiles: true },
    });
    if (audit) {
      const existingEmails = Array.isArray(audit.contactEmails)
        ? (audit.contactEmails as unknown[]).filter((x): x is string => typeof x === "string")
        : [];
      const mergedEmails = Array.from(new Set([...existingEmails, ...(place.emails ?? [])]));
      const existingSocials = (audit.socialProfiles ?? {}) as Record<string, string | null>;
      await prisma.websiteAudit.update({
        where: { id: audit.id },
        data: {
          contactEmails: mergedEmails as unknown as object,
          socialProfiles: { ...existingSocials, ...socials } as unknown as object,
        },
      });
    }
  }

  // Phase 2.6 — Apify often surfaces a website URL the discovery
  // worker missed (e.g. lead was imported as NO_WEBSITE because
  // Google Places had no `websiteUri`, but Apify's deeper scrape
  // pulled it from the listing). When that happens we update the
  // lead row + enqueue a WEBSITE_AUDITOR re-run so downstream
  // workers (auditor, mockup, scorer, dossier) see the freshly-
  // crawled site without the rep needing to refresh manually. The
  // helper guarantees idempotency via `lead.lastAuditedWebsiteUrl`.
  const reAuditResult = await maybeEnqueueWebsiteReAudit({
    workspaceId: ctx.workspaceId,
    lead,
    discoveredWebsite: place.website ?? null,
  });

  logger.info("apify.gmaps_deep.done", {
    leadId: lead.id,
    reviews: reviews.length,
    costCents: result.costUsdCents,
    reAuditEnqueued: reAuditResult.enqueued,
    reAuditReason: reAuditResult.reason,
  });

  // When running standalone (no planner session), the DAG has no
  // review_refresh step to cascade. Emit lead_reviews_updated so
  // REVIEW_ANALYST + SCORER + DOSSIER automatically re-run against
  // the deeper corpus — same behaviour as the manual "Refresh reviews"
  // button in the Places-API path.
  if (!ctx.plannerSessionId && reviews.length > 0) {
    await ctx.emit("lead_reviews_updated");
  }

  return {
    output: {
      placeId: place.placeId,
      reviewsCount: reviews.length,
      emailsFound: place.emails?.length ?? 0,
      socialsFound: Object.keys(socials).length,
      costUsdCents: result.costUsdCents,
      websiteReAuditEnqueued: reAuditResult.enqueued,
      websiteReAuditReason: reAuditResult.reason,
      discoveredWebsiteUrl: reAuditResult.newUrl,
    },
    costUsdCents: result.costUsdCents,
  };
};

export const memoryWrites = (
  output: unknown,
  ctx: AgentWorkerContext,
): MemoryWrite[] => {
  if (!ctx.leadId) return [];
  const o = output as { reviewsCount?: number; placeId?: string };
  if (!o?.reviewsCount) return [];

  // We don't re-read all reviews here (that'd double the DB traffic).
  // Instead we flag that deep reviews are available; the subsequent
  // REVIEW_ANALYST re-run in the user_deep_research chain will embed
  // the pain/strength chunks into memory naturally.
  return [
    {
      kind: "LEAD_PROFILE",
      text: `Deep Google Maps scan: ${o.reviewsCount} reviews ingested, placeId=${o.placeId ?? "?"}`,
      leadId: ctx.leadId,
      refType: "apify_gmaps_deep",
      refId: ctx.leadId,
      metadata: { reviewsCount: o.reviewsCount, source: "APIFY_GMAPS_DEEP" },
      skipEmbed: true,
    },
  ];
};
