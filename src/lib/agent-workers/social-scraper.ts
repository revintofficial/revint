/**
 * SOCIAL_SCRAPER worker wrapper for AI Core.
 *
 * Light-weight social profile extraction from the website audit
 * already captured by WEBSITE_AUDITOR. This worker normalises the
 * links-from-site blob into a structured `socialProfiles` artifact
 * the UI can render.
 *
 * For deep profile data (follower counts, recent posts, engagement)
 * use `APIFY_INSTAGRAM_DEEP` / `APIFY_FACEBOOK_DEEP` / `APIFY_TIKTOK_DEEP`
 * which actually hit those platforms via Apify actors.
 */
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { AgentWorkerOutput, AgentWorkerRun } from "./types";

export const run: AgentWorkerRun = async (ctx): Promise<AgentWorkerOutput> => {
  if (!ctx.lead) throw new Error("SOCIAL_SCRAPER requires a lead context");

  const audit = await prisma.websiteAudit.findUnique({
    where: { leadId: ctx.lead.id },
    select: { socialProfiles: true },
  });

  const profiles = (audit?.socialProfiles as Record<string, string | null> | undefined) ?? {};
  const counts = Object.entries(profiles).filter(([, v]) => v).length;

  logger.info("agent_workers.social_scraper.done", {
    leadId: ctx.lead.id,
    profilesFound: counts,
  });

  return {
    output: { profiles, count: counts },
    costTokens: 0,
  };
};
