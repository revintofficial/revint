/**
 * APIFY_INSTAGRAM_DEEP - Instagram profile + recent posts.
 *
 * Hits `apify/instagram-scraper` with the Instagram handle discovered
 * by WEBSITE_AUDITOR or APIFY_GMAPS_DEEP. Pulls profile info + up to
 * 20 recent posts with caption + engagement metrics.
 *
 * Writes SOCIAL_POST memory rows (platform=instagram) so the opener
 * writer can reference "your latest post about X" in cold outreach.
 */
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { isConfigured, runSync } from "@/lib/apify";
import type {
  AgentWorkerContext,
  AgentWorkerOutput,
  AgentWorkerRun,
  MemoryWrite,
} from "../types";

const ACTOR_ID = "apify/instagram-scraper";

interface IgPost {
  id?: string;
  url?: string;
  caption?: string;
  likesCount?: number;
  commentsCount?: number;
  timestamp?: string;
  ownerUsername?: string;
}

export const run: AgentWorkerRun = async (ctx): Promise<AgentWorkerOutput> => {
  if (!ctx.lead) throw new Error("APIFY_INSTAGRAM_DEEP requires a lead context");
  if (!isConfigured()) {
    return { output: { skipped: true, reason: "apify_not_configured" }, costUsdCents: 0 };
  }

  // Find the Instagram URL from the existing audit row.
  const audit = await prisma.websiteAudit.findUnique({
    where: { leadId: ctx.lead.id },
    select: { socialProfiles: true },
  });
  const profiles = (audit?.socialProfiles as Record<string, string | null> | undefined) ?? {};
  const igUrl = profiles.instagram;
  if (!igUrl) {
    return { output: { skipped: true, reason: "no_instagram_profile" }, costUsdCents: 0 };
  }

  const input = {
    directUrls: [igUrl],
    resultsType: "posts",
    resultsLimit: 20,
    searchType: "user",
  };

  const result = await runSync<IgPost>(ACTOR_ID, input, { timeoutSec: 180 });
  const posts = result.items.filter((p) => p && typeof p.caption === "string");

  logger.info("apify.instagram_deep.done", {
    leadId: ctx.lead.id,
    posts: posts.length,
    costCents: result.costUsdCents,
  });

  return {
    output: {
      posts: posts.map((p) => ({
        id: p.id,
        url: p.url,
        caption: p.caption,
        likes: p.likesCount ?? 0,
        comments: p.commentsCount ?? 0,
        timestamp: p.timestamp,
      })),
      count: posts.length,
      costUsdCents: result.costUsdCents,
    },
    costUsdCents: result.costUsdCents,
  };
};

/**
 * Derives a stable refId for a memory write even when the scraped
 * post lacks an explicit `id`. Returning undefined would make
 * memory.upsert treat the write as "always insert", so every run
 * would duplicate the row. Order of preference:
 *   1. Apify's post id (most stable).
 *   2. Post URL (stable per Instagram media permalink).
 *   3. Deterministic hash of the caption (last-resort, avoids dupes
 *      on retry of the same scrape).
 */
function igRefId(
  leadId: string,
  p: { id?: string; url?: string; caption?: string },
): string {
  if (p.id) return `${leadId}:ig:${p.id}`;
  if (p.url) return `${leadId}:ig:url:${p.url}`;
  const h = hashString(p.caption ?? "");
  return `${leadId}:ig:cap:${h}`;
}

function hashString(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  return (h >>> 0).toString(36);
}

export const memoryWrites = (
  output: unknown,
  ctx: AgentWorkerContext,
): MemoryWrite[] => {
  if (!ctx.leadId) return [];
  const o = output as { posts?: Array<IgPost & { caption?: string; likes?: number; comments?: number }> };
  if (!Array.isArray(o.posts)) return [];

  return o.posts
    .filter((p) => (p.caption ?? "").trim().length > 0)
    .map((p) => ({
      kind: "SOCIAL_POST" as const,
      text: p.caption ?? "",
      leadId: ctx.leadId,
      refType: "social_post:instagram",
      refId: igRefId(ctx.leadId!, p),
      metadata: {
        platform: "instagram",
        url: p.url,
        likes: p.likes ?? 0,
        comments: p.comments ?? 0,
        timestamp: p.timestamp,
        source: "APIFY_INSTAGRAM_DEEP",
      },
    }));
};
