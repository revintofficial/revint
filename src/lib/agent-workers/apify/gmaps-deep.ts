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
import type {
  AgentWorkerContext,
  AgentWorkerOutput,
  AgentWorkerRun,
  MemoryWrite,
} from "../types";

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

  logger.info("apify.gmaps_deep.done", {
    leadId: lead.id,
    reviews: reviews.length,
    costCents: result.costUsdCents,
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
