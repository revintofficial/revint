/**
 * APIFY_SERP_RANK - Google SERP rank tracker.
 *
 * Runs 2-3 high-intent queries ("best {primaryType} in {borough}",
 * "{businessName}", "{primaryType} {borough}") through
 * `apify/google-search-scraper` and records where the lead shows up
 * in the top 10 organic results. Feeds the opener writer with the
 * "you rank #8, we'll get you to #3" pitch angle.
 *
 * Side effect: any social-media profile URLs surfaced in the organic
 * results (Instagram, Facebook, LinkedIn, TikTok, YouTube, Twitter/X)
 * are harvested and merged into `WebsiteAudit.socialProfiles`. That
 * makes SERP a first-class social-discovery source on the initial
 * `lead_created` chain - businesses without a crawlable website still
 * get their socials populated because Google indexes the profiles
 * directly.
 *
 * Execution mode: async-apify. Apify google-search-scraper regularly
 * exceeds Vercel's 60s function deadline (especially with cold
 * actor starts), so the worker exports `start(ctx)` to kick the
 * actor off with a webhook callback and `finalize(ctx, payload)` to
 * run the post-processing once Apify reports back via the
 * `/api/webhooks/apify` endpoint. A `run(ctx)` shim is also exported
 * as a sync fallback for environments without a public webhook
 * ingress (typical local dev without a tunnel).
 */
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { isConfigured, runAsync, runSync } from "@/lib/apify";
import { getAppBaseUrl } from "@/lib/email/from";
import type {
  AgentWorkerContext,
  AgentWorkerFinalize,
  AgentWorkerOutput,
  AgentWorkerRun,
  AgentWorkerStart,
  ApifyFinalizePayload,
  MemoryWrite,
} from "../types";

const ACTOR_ID = "apify/google-search-scraper";

interface SerpResult {
  searchQuery?: { term?: string };
  organicResults?: Array<{
    position?: number;
    url?: string;
    title?: string;
    description?: string;
    displayedUrl?: string;
  }>;
}

/**
 * Platform -> host-matcher mapping. Order matters: the first matcher
 * that hits for a given URL wins. Keep long TLDs (`facebook.com`)
 * before short aliases (`fb.com`) so we don't mis-categorise.
 *
 * We deliberately look at the hostname only (not the full URL) so we
 * catch regional subdomains like `m.facebook.com`, `uk.linkedin.com`
 * and mobile variants like `mobile.twitter.com`.
 */
const SOCIAL_HOSTS: Array<{
  key: "instagram" | "facebook" | "linkedin" | "tiktok" | "youtube" | "twitter";
  test: (host: string) => boolean;
}> = [
  { key: "instagram", test: (h) => h === "instagram.com" || h.endsWith(".instagram.com") },
  { key: "facebook", test: (h) => h === "facebook.com" || h.endsWith(".facebook.com") || h === "fb.com" },
  { key: "linkedin", test: (h) => h === "linkedin.com" || h.endsWith(".linkedin.com") },
  { key: "tiktok", test: (h) => h === "tiktok.com" || h.endsWith(".tiktok.com") },
  { key: "youtube", test: (h) => h === "youtube.com" || h.endsWith(".youtube.com") || h === "youtu.be" },
  { key: "twitter", test: (h) => h === "twitter.com" || h.endsWith(".twitter.com") || h === "x.com" || h.endsWith(".x.com") },
];

/**
 * Builds the Apify input shared between the sync and async paths.
 * Returns null when the lead has no usable queries (no business
 * name, no primary type) - the caller short-circuits with a
 * skipped result so we never charge Apify for an empty-query run.
 */
function buildActorInput(
  ctx: AgentWorkerContext,
): { queries: string[]; input: Record<string, unknown> } | null {
  if (!ctx.lead) return null;
  const queries = buildQueries(ctx.lead);
  if (queries.length === 0) return null;
  const input: Record<string, unknown> = {
    queries: queries.join("\n"),
    resultsPerPage: 10,
    maxPagesPerQuery: 1,
    languageCode: ctx.workspace.language ?? "en",
    countryCode: "gb",
  };
  return { queries, input };
}

/**
 * Async-apify kickoff. Schedules the actor with a webhook pointing at
 * `/api/webhooks/apify`; the webhook handler calls `finalize` below
 * once the actor finishes. Used by the executor whenever the
 * deployment has a public webhook ingress (i.e. NEXT_PUBLIC_APP_URL
 * or VERCEL_URL is set).
 */
export const start: AgentWorkerStart = async (ctx) => {
  if (!ctx.lead) throw new Error("APIFY_SERP_RANK requires a lead context");
  if (!isConfigured()) {
    return {
      skipped: true,
      reason: "apify_not_configured",
      output: { skipped: true, reason: "apify_not_configured" },
    };
  }
  const built = buildActorInput(ctx);
  if (!built) {
    return {
      skipped: true,
      reason: "no_queries",
      output: { skipped: true, reason: "no_queries" },
    };
  }

  const baseUrl = getAppBaseUrl();
  const webhookUrl = `${baseUrl}/api/webhooks/apify`;

  const { runId } = await runAsync(ACTOR_ID, built.input, {
    webhookUrl,
    webhookSecret: process.env.APIFY_WEBHOOK_SECRET,
    agentRunId: ctx.runId,
    timeoutSec: 180,
  });

  logger.info("apify.serp_rank.started", {
    leadId: ctx.lead.id,
    queries: built.queries.length,
    apifyRunId: runId,
  });

  return { apifyRunId: runId };
};

/**
 * Async-apify finalizer. Called by `/api/webhooks/apify` after Apify
 * reports the actor finished. Receives the dataset items and the
 * resolved cost; produces the same AgentWorkerOutput shape that the
 * sync `run()` path returns.
 */
export const finalize: AgentWorkerFinalize = async (ctx, payload) => {
  return processItems(ctx, payload.items as SerpResult[], payload.costUsdCents);
};

/**
 * Sync fallback. Used when the executor cannot reach a public
 * webhook URL (local dev without a tunnel, NEXT_PUBLIC_APP_URL
 * unset). Same blocking shape as before this worker switched to
 * async mode; the only behavioural difference is that here we
 * forward the timeout to runSync so Apify aborts the actor at 180s
 * even on long-running queries.
 */
export const run: AgentWorkerRun = async (ctx): Promise<AgentWorkerOutput> => {
  if (!ctx.lead) throw new Error("APIFY_SERP_RANK requires a lead context");
  if (!isConfigured()) {
    return { output: { skipped: true, reason: "apify_not_configured" }, costUsdCents: 0 };
  }
  const built = buildActorInput(ctx);
  if (!built) {
    return { output: { skipped: true, reason: "no_queries" }, costUsdCents: 0 };
  }

  const result = await runSync<SerpResult>(ACTOR_ID, built.input, { timeoutSec: 120 });
  return processItems(ctx, result.items, result.costUsdCents);
};

/**
 * Pure post-processing: turn Apify dataset items into the
 * AgentWorkerOutput shape (snapshots, harvested socials, audit-row
 * merge). Shared between the sync `run()` and the async `finalize()`
 * paths so the output stays bit-for-bit identical regardless of
 * which transport delivered the items.
 */
async function processItems(
  ctx: AgentWorkerContext,
  items: SerpResult[],
  costUsdCents: number,
): Promise<AgentWorkerOutput> {
  if (!ctx.lead) throw new Error("processItems requires a lead context");
  const lead = ctx.lead;
  const leadDomain = lead.websiteUrl ? domainOf(lead.websiteUrl) : null;

  const snapshots = items
    .filter((s) => s.searchQuery?.term && Array.isArray(s.organicResults))
    .map((s) => {
      const rankedPosition =
        leadDomain &&
        s.organicResults!.find((r) => r.url && domainOf(r.url) === leadDomain)?.position;
      return {
        query: s.searchQuery!.term!,
        rank: rankedPosition ?? null,
        topResults: s.organicResults!.slice(0, 5).map((r) => ({
          position: r.position,
          url: r.url,
          title: r.title,
        })),
      };
    });

  const harvestedSocials = harvestSocials(items);
  const mergedSocials = await mergeSocialProfiles(lead.id, lead.websiteUrl, harvestedSocials);

  logger.info("apify.serp_rank.done", {
    leadId: lead.id,
    queries: snapshots.length,
    socialsFound: Object.keys(harvestedSocials).length,
    socialsMerged: mergedSocials,
    costCents: costUsdCents,
  });

  return {
    output: {
      snapshots,
      socialProfilesFound: harvestedSocials,
      socialProfilesMerged: mergedSocials,
      costUsdCents,
    },
    costUsdCents,
  };
}

export const memoryWrites = (
  output: unknown,
  ctx: AgentWorkerContext,
): MemoryWrite[] => {
  if (!ctx.leadId) return [];
  const o = output as {
    snapshots?: Array<{
      query: string;
      rank: number | null;
      topResults: Array<{ position?: number; url?: string; title?: string }>;
    }>;
  };
  if (!Array.isArray(o.snapshots)) return [];

  return o.snapshots.map((snap, i) => {
    const top = snap.topResults
      .map((r) => `#${r.position}: ${r.title ?? ""} (${r.url ?? ""})`)
      .join("\n");
    const leadLine = snap.rank
      ? `Lead ranks #${snap.rank} for this query.`
      : "Lead not in top 10 for this query.";
    return {
      kind: "SERP_SNAPSHOT" as const,
      text: `Query: "${snap.query}"\n${leadLine}\nTop 5:\n${top}`,
      leadId: ctx.leadId,
      refType: "serp_snapshot",
      refId: `${ctx.leadId}:${i}`,
      metadata: {
        query: snap.query,
        rank: snap.rank,
        source: "APIFY_SERP_RANK",
      },
    };
  });
};

function buildQueries(lead: {
  businessName: string;
  primaryType: string | null;
  borough: string | null;
  formattedAddress: string;
}): string[] {
  const queries: string[] = [];
  queries.push(lead.businessName);
  if (lead.primaryType && lead.borough) {
    queries.push(`${lead.primaryType} ${lead.borough}`);
    queries.push(`best ${lead.primaryType} ${lead.borough}`);
  } else if (lead.primaryType) {
    queries.push(lead.primaryType);
  }
  return Array.from(new Set(queries)).slice(0, 3);
}

function domainOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Walks every organic result across every query and returns the
 * first URL seen for each social platform. We keep the *first*
 * occurrence because Google surfaces the canonical profile (the one
 * the business actually owns) above aggregator/reshare pages in
 * almost every case. Later matches tend to be unrelated accounts
 * that happen to share a name.
 */
function harvestSocials(items: SerpResult[]): Record<string, string> {
  const found: Record<string, string> = {};
  for (const item of items) {
    if (!Array.isArray(item.organicResults)) continue;
    for (const r of item.organicResults) {
      if (!r.url) continue;
      const host = domainOf(r.url);
      if (!host) continue;
      for (const { key, test } of SOCIAL_HOSTS) {
        if (found[key]) continue;
        if (test(host)) {
          found[key] = r.url;
          break;
        }
      }
      if (Object.keys(found).length === SOCIAL_HOSTS.length) return found;
    }
  }
  return found;
}

/**
 * Merges SERP-sourced socials into `WebsiteAudit.socialProfiles`. We
 * upsert the audit row (creating it with minimal columns when the
 * lead has no website yet) so SERP enrichment works even for
 * website-less leads - which is precisely the case where SERP is
 * most valuable because crawler-based social discovery has nothing
 * to scrape.
 *
 * Existing keys on the audit row win: if `WEBSITE_AUDITOR` already
 * scraped an Instagram URL from the site, we do NOT overwrite it
 * with whatever Google surfaced first. This preserves the "trust
 * the site > trust the SERP" ordering.
 *
 * Returns the count of new keys actually written (0 if everything
 * was already known).
 */
async function mergeSocialProfiles(
  leadId: string,
  websiteUrl: string | null,
  fromSerp: Record<string, string>,
): Promise<number> {
  if (Object.keys(fromSerp).length === 0) return 0;

  const existingRow = await prisma.websiteAudit.findUnique({
    where: { leadId },
    select: { socialProfiles: true },
  });
  const existing = (existingRow?.socialProfiles ?? {}) as Record<string, string | null>;

  let added = 0;
  const merged: Record<string, string | null> = { ...existing };
  for (const [k, v] of Object.entries(fromSerp)) {
    if (!merged[k]) {
      merged[k] = v;
      added++;
    }
  }
  if (added === 0) return 0;

  await prisma.websiteAudit.upsert({
    where: { leadId },
    create: {
      leadId,
      // url is required on WebsiteAudit; use the lead's website if
      // present, otherwise empty string which the schema allows.
      // Downstream readers already guard against empty URLs.
      url: websiteUrl ?? "",
      socialProfiles: merged as unknown as object,
    },
    update: {
      socialProfiles: merged as unknown as object,
    },
  });

  return added;
}
