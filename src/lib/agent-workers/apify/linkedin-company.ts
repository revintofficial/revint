/**
 * APIFY_LINKEDIN_COMPANY - LinkedIn company hiring signals.
 *
 * Gated to PRO_TEAM+ because LinkedIn scraping is in a legal grey
 * area. Pulls open job posts + employee count trend, which is a
 * strong "is this business growing / has budget" signal.
 *
 * Uses HarvestAPI's no-cookie actors which are explicitly marketed
 * as "login not required" - this is the safest Apify actor family
 * for LinkedIn data.
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

const JOBS_ACTOR = "curious_coder/linkedin-jobs-scraper";
const MAX_JOBS = 15;

interface JobItem {
  jobTitle?: string;
  companyName?: string;
  location?: string;
  description?: string;
  postedAgoText?: string;
  link?: string;
  employmentType?: string;
}

export const run: AgentWorkerRun = async (ctx): Promise<AgentWorkerOutput> => {
  if (!ctx.lead) throw new Error("APIFY_LINKEDIN_COMPANY requires a lead context");
  if (!isConfigured()) {
    return { output: { skipped: true, reason: "apify_not_configured" }, costUsdCents: 0 };
  }

  const audit = await prisma.websiteAudit.findUnique({
    where: { leadId: ctx.lead.id },
    select: { socialProfiles: true },
  });
  const liUrl = (audit?.socialProfiles as Record<string, string | null> | undefined)?.linkedin;
  if (!liUrl) {
    return { output: { skipped: true, reason: "no_linkedin_profile" }, costUsdCents: 0 };
  }

  // Extract company slug from URL
  const slug = extractCompanySlug(liUrl);
  if (!slug) {
    return { output: { skipped: true, reason: "unparseable_linkedin_url" }, costUsdCents: 0 };
  }

  const input = {
    queries: [ctx.lead.businessName],
    locations: ctx.lead.borough ? [ctx.lead.borough] : ["Turkey"],
    rows: MAX_JOBS,
  };

  try {
    const result = await runSync<JobItem>(JOBS_ACTOR, input, { timeoutSec: 180 });
    const jobs = result.items.filter((j) => j && typeof j.jobTitle === "string");

    logger.info("apify.linkedin_company.done", {
      leadId: ctx.lead.id,
      jobs: jobs.length,
      costCents: result.costUsdCents,
    });

    return {
      output: {
        companySlug: slug,
        jobs: jobs.map((j) => ({
          title: j.jobTitle,
          location: j.location,
          description: j.description?.slice(0, 500),
          postedAgo: j.postedAgoText,
          link: j.link,
          type: j.employmentType,
        })),
        count: jobs.length,
        costUsdCents: result.costUsdCents,
      },
      costUsdCents: result.costUsdCents,
    };
  } catch (err) {
    logger.warn("apify.linkedin_company.failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    return {
      output: { skipped: true, reason: "actor_failed" },
      costUsdCents: 0,
    };
  }
};

export const memoryWrites = (
  output: unknown,
  ctx: AgentWorkerContext,
): MemoryWrite[] => {
  if (!ctx.leadId) return [];
  const o = output as {
    jobs?: Array<{ title: string; location?: string; description?: string; postedAgo?: string; type?: string }>;
  };
  if (!Array.isArray(o.jobs)) return [];

  return o.jobs
    .filter((j) => j.title)
    .map((j, i) => ({
      kind: "HIRING_SIGNAL" as const,
      text: `Hiring: ${j.title}${j.type ? ` (${j.type})` : ""}${
        j.location ? ` · ${j.location}` : ""
      }${j.postedAgo ? ` · ${j.postedAgo}` : ""}${
        j.description ? `\n${j.description}` : ""
      }`,
      leadId: ctx.leadId,
      refType: "hiring_signal",
      refId: `${ctx.leadId}:job:${i}`,
      metadata: {
        title: j.title,
        location: j.location,
        postedAgo: j.postedAgo,
        source: "APIFY_LINKEDIN_COMPANY",
      },
    }));
};

function extractCompanySlug(url: string): string | null {
  const m = url.match(/linkedin\.com\/company\/([^/?#]+)/i);
  return m ? m[1] : null;
}
