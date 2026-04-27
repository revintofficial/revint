/**
 * GOOGLE_PLACES_REVIEWS worker.
 *
 * Pre-loads up to 5 Google Places reviews for a lead so REVIEW_ANALYST
 * has a corpus to analyze when it runs. This is the FREE-tier substitute
 * for APIFY_GMAPS_DEEP (which can pull 500+ reviews but costs $1-2 per
 * lead). One Places API call per lead; no Gemini, no Apify.
 *
 * Idempotent: deletes existing GoogleReview rows before re-inserting so
 * a re-run after fresh ingestion replaces stale data without
 * accumulating duplicates. The companion route at
 * `/api/reviews/[leadId]` does the same delete+createMany dance for the
 * "refresh reviews from UI" button.
 */
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getPlaceReviews } from "@/lib/google-places";
import type { PlaceReview } from "@/types";
import type {
  AgentWorkerContext,
  AgentWorkerOutput,
  AgentWorkerRun,
  MemoryWrite,
} from "./types";

export const run: AgentWorkerRun = async (ctx): Promise<AgentWorkerOutput> => {
  if (!ctx.lead) throw new Error("GOOGLE_PLACES_REVIEWS requires a lead context");
  const lead = ctx.lead;

  if (!lead.placeId) {
    return {
      output: { skipped: true, reason: "no_place_id", count: 0 },
      costTokens: 0,
    };
  }

  let apiReviews: PlaceReview[] = [];
  try {
    apiReviews = await getPlaceReviews(lead.placeId);
  } catch (err) {
    // Soft-fail when Places API rejects this specific place (deleted,
    // permission denied for this listing, transient 5xx). REVIEW_ANALYST
    // will still run and degrade to NO_REVIEWS gracefully; we don't
    // want one place failure to FAIL the whole lead_created chain.
    logger.warn("agent_workers.google_places_reviews.api_error", {
      leadId: lead.id,
      placeId: lead.placeId,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      output: { skipped: true, reason: "places_api_error", count: 0 },
      costTokens: 0,
    };
  }

  if (apiReviews.length === 0) {
    logger.info("agent_workers.google_places_reviews.empty", {
      leadId: lead.id,
      placeId: lead.placeId,
    });
    return {
      output: { skipped: true, reason: "no_reviews_in_places", count: 0 },
      costTokens: 0,
    };
  }

  // Delete + createMany inside a transaction so a partial failure
  // can't leave the lead with a half-replaced review set.
  const sampledAt = new Date();
  const created = await prisma.$transaction(async (tx) => {
    await tx.googleReview.deleteMany({ where: { leadId: lead.id } });
    const data = apiReviews.map((r) => ({
      leadId: lead.id,
      authorName: r.authorAttribution?.displayName || "Anonymous",
      authorPhoto: r.authorAttribution?.photoUri ?? null,
      rating: r.rating,
      text: r.text?.text ?? null,
      relativeTime: r.relativePublishTimeDescription || "",
      publishTime: r.publishTime ? new Date(r.publishTime) : new Date(),
    }));
    await tx.googleReview.createMany({ data });
    return data.length;
  });

  logger.info("agent_workers.google_places_reviews.done", {
    leadId: lead.id,
    count: created,
  });

  return {
    output: {
      count: created,
      sampledAt: sampledAt.toISOString(),
      source: "google_places_api",
    },
    costTokens: 0,
  };
};

/**
 * No semantic memory writes here — REVIEW_ANALYST is the worker
 * that converts these raw rows into pain/strength phrases and
 * writes REVIEW_CHUNK memory after grounding them.
 */
export const memoryWrites = (
  _output: unknown,
  _ctx: AgentWorkerContext,
): MemoryWrite[] => [];
