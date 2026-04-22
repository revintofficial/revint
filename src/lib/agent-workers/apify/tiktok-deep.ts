/**
 * APIFY_TIKTOK_DEEP - TikTok profile + recent videos scraper.
 *
 * Hits `clockworks/tiktok-scraper`. For consumer-facing niches
 * (restaurants, salons, clinics targeting Gen Z) TikTok content is
 * a strong opener hook.
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

const ACTOR_ID = "clockworks/tiktok-scraper";

interface TtVideo {
  id?: string;
  webVideoUrl?: string;
  text?: string;
  diggCount?: number;
  commentCount?: number;
  shareCount?: number;
  createTimeISO?: string;
}

export const run: AgentWorkerRun = async (ctx): Promise<AgentWorkerOutput> => {
  if (!ctx.lead) throw new Error("APIFY_TIKTOK_DEEP requires a lead context");
  if (!isConfigured()) {
    return { output: { skipped: true, reason: "apify_not_configured" }, costUsdCents: 0 };
  }

  const audit = await prisma.websiteAudit.findUnique({
    where: { leadId: ctx.lead.id },
    select: { socialProfiles: true },
  });
  const ttUrl = (audit?.socialProfiles as Record<string, string | null> | undefined)?.tiktok;
  if (!ttUrl) {
    return { output: { skipped: true, reason: "no_tiktok_profile" }, costUsdCents: 0 };
  }

  const input = {
    profiles: [ttUrl.replace(/.*@/, "@").replace(/[/?].*/, "")],
    resultsPerPage: 20,
    shouldDownloadVideos: false,
  };

  const result = await runSync<TtVideo>(ACTOR_ID, input, { timeoutSec: 180 });
  const videos = result.items.filter((v) => v && typeof v.text === "string");

  logger.info("apify.tiktok_deep.done", {
    leadId: ctx.lead.id,
    videos: videos.length,
    costCents: result.costUsdCents,
  });

  return {
    output: {
      videos: videos.map((v) => ({
        id: v.id,
        url: v.webVideoUrl,
        text: v.text,
        likes: v.diggCount ?? 0,
        comments: v.commentCount ?? 0,
        shares: v.shareCount ?? 0,
        time: v.createTimeISO,
      })),
      count: videos.length,
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
  const o = output as { videos?: Array<{ id?: string; url?: string; text: string; likes?: number; comments?: number; shares?: number; time?: string }> };
  if (!Array.isArray(o.videos)) return [];

  return o.videos
    .filter((v) => (v.text ?? "").trim().length > 0)
    .map((v) => ({
      kind: "SOCIAL_POST" as const,
      text: v.text,
      leadId: ctx.leadId,
      refType: "social_post:tiktok",
      refId: v.id ? `${ctx.leadId}:tt:${v.id}` : undefined,
      metadata: {
        platform: "tiktok",
        url: v.url,
        likes: v.likes ?? 0,
        comments: v.comments ?? 0,
        shares: v.shares ?? 0,
        time: v.time,
        source: "APIFY_TIKTOK_DEEP",
      },
    }));
};
