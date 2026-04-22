/**
 * APIFY_FACEBOOK_DEEP - Facebook page posts scraper.
 *
 * Hits `apify/facebook-posts-scraper` to pull recent posts +
 * engagement from a Facebook page discovered by upstream workers.
 * Output lands as SOCIAL_POST memory (platform=facebook).
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

const ACTOR_ID = "apify/facebook-posts-scraper";

interface FbPost {
  postId?: string;
  url?: string;
  text?: string;
  likesCount?: number;
  commentsCount?: number;
  sharesCount?: number;
  time?: string;
}

export const run: AgentWorkerRun = async (ctx): Promise<AgentWorkerOutput> => {
  if (!ctx.lead) throw new Error("APIFY_FACEBOOK_DEEP requires a lead context");
  if (!isConfigured()) {
    return { output: { skipped: true, reason: "apify_not_configured" }, costUsdCents: 0 };
  }

  const audit = await prisma.websiteAudit.findUnique({
    where: { leadId: ctx.lead.id },
    select: { socialProfiles: true },
  });
  const fbUrl = (audit?.socialProfiles as Record<string, string | null> | undefined)?.facebook;
  if (!fbUrl) {
    return { output: { skipped: true, reason: "no_facebook_profile" }, costUsdCents: 0 };
  }

  const input = { startUrls: [{ url: fbUrl }], resultsLimit: 20 };
  const result = await runSync<FbPost>(ACTOR_ID, input, { timeoutSec: 180 });
  const posts = result.items.filter((p) => p && typeof p.text === "string");

  logger.info("apify.facebook_deep.done", {
    leadId: ctx.lead.id,
    posts: posts.length,
    costCents: result.costUsdCents,
  });

  return {
    output: {
      posts: posts.map((p) => ({
        id: p.postId,
        url: p.url,
        text: p.text,
        likes: p.likesCount ?? 0,
        comments: p.commentsCount ?? 0,
        shares: p.sharesCount ?? 0,
        time: p.time,
      })),
      count: posts.length,
      costUsdCents: result.costUsdCents,
    },
    costUsdCents: result.costUsdCents,
  };
};

/**
 * Stable refId for FB posts (see instagram-deep for rationale). When
 * Apify omits postId we fall back to the post URL, then to a hash of
 * the caption, so retries upsert rather than insert.
 */
function fbRefId(
  leadId: string,
  p: { id?: string; url?: string; text?: string },
): string {
  if (p.id) return `${leadId}:fb:${p.id}`;
  if (p.url) return `${leadId}:fb:url:${p.url}`;
  let h = 0;
  for (let i = 0; i < (p.text?.length ?? 0); i++) h = Math.imul(31, h) + p.text!.charCodeAt(i) | 0;
  return `${leadId}:fb:txt:${(h >>> 0).toString(36)}`;
}

export const memoryWrites = (
  output: unknown,
  ctx: AgentWorkerContext,
): MemoryWrite[] => {
  if (!ctx.leadId) return [];
  const o = output as { posts?: Array<{ id?: string; url?: string; text: string; likes?: number; comments?: number; time?: string }> };
  if (!Array.isArray(o.posts)) return [];

  return o.posts
    .filter((p) => (p.text ?? "").trim().length > 0)
    .map((p) => ({
      kind: "SOCIAL_POST" as const,
      text: p.text,
      leadId: ctx.leadId,
      refType: "social_post:facebook",
      refId: fbRefId(ctx.leadId!, p),
      metadata: {
        platform: "facebook",
        url: p.url,
        likes: p.likes ?? 0,
        comments: p.comments ?? 0,
        time: p.time,
        source: "APIFY_FACEBOOK_DEEP",
      },
    }));
};
