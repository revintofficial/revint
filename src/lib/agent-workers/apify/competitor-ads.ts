/**
 * APIFY_COMPETITOR_ADS - Facebook/Instagram ad library scanner.
 *
 * Given the lead's primary type + borough, finds competitors running
 * Meta ads. Ad copy is gold for the opener writer: "your competitor
 * on 2nd Avenue spends on 4 ads saying X, here's how to beat it".
 */
import { logger } from "@/lib/logger";
import { isConfigured, runSync } from "@/lib/apify";
import type {
  AgentWorkerContext,
  AgentWorkerOutput,
  AgentWorkerRun,
  MemoryWrite,
} from "../types";

const ACTOR_ID = "curious_coder/facebook-ads-library-scraper";
const MAX_ADS = 25;

interface AdItem {
  ad_archive_id?: string;
  page_name?: string;
  page_id?: string;
  body_text?: string | null;
  title?: string | null;
  cta_text?: string | null;
  start_date?: string;
  ad_snapshot_url?: string;
}

/**
 * Resolves a 2-letter ISO country code for the Meta Ad Library query.
 *
 * Priority:
 *   1. Last comma-separated token of `formattedAddress` if it maps to
 *      a known country name or code.
 *   2. Explicit hint in the lead's `primaryType`/borough (e.g. an
 *      obviously London borough implies GB).
 *   3. Workspace language mapping (en -> GB, tr -> TR, etc.).
 *   4. `ALL` as the final fallback (Ad Library accepts "ALL").
 */
function resolveAdLibraryCountry(
  address: string | null,
  borough: string | null,
  workspaceLanguage: string | null,
): string {
  const addr = (address ?? "").trim();
  if (addr) {
    const last = addr
      .split(",")
      .map((s) => s.trim())
      .pop();
    if (last) {
      const up = last.toUpperCase();
      const KNOWN: Record<string, string> = {
        "UNITED KINGDOM": "GB",
        "UNITED KINGDOM OF GREAT BRITAIN AND NORTHERN IRELAND": "GB",
        UK: "GB",
        GB: "GB",
        ENGLAND: "GB",
        SCOTLAND: "GB",
        WALES: "GB",
        "NORTHERN IRELAND": "GB",
        "UNITED STATES": "US",
        USA: "US",
        US: "US",
        TURKEY: "TR",
        TURKIYE: "TR",
        TR: "TR",
        CANADA: "CA",
        CA: "CA",
        AUSTRALIA: "AU",
        AU: "AU",
        GERMANY: "DE",
        DE: "DE",
        FRANCE: "FR",
        FR: "FR",
        SPAIN: "ES",
        ES: "ES",
        ITALY: "IT",
        IT: "IT",
        NETHERLANDS: "NL",
        NL: "NL",
      };
      if (KNOWN[up]) return KNOWN[up];
    }
  }
  if (borough) return "GB";
  if (workspaceLanguage === "tr") return "TR";
  return "ALL";
}

export const run: AgentWorkerRun = async (ctx): Promise<AgentWorkerOutput> => {
  if (!ctx.lead) throw new Error("APIFY_COMPETITOR_ADS requires a lead context");
  if (!isConfigured()) {
    return { output: { skipped: true, reason: "apify_not_configured" }, costUsdCents: 0 };
  }
  const lead = ctx.lead;
  if (!lead.primaryType) {
    return { output: { skipped: true, reason: "no_primary_type" }, costUsdCents: 0 };
  }

  const searchText = lead.borough
    ? `${lead.primaryType} ${lead.borough}`
    : lead.primaryType;

  const country = resolveAdLibraryCountry(
    lead.formattedAddress,
    lead.borough,
    ctx.workspace.language ?? null,
  );

  const input = {
    urls: [
      {
        url: `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=${country}&q=${encodeURIComponent(searchText)}&sort_data[direction]=desc&sort_data[mode]=relevancy_monthly_grouped`,
      },
    ],
    maxAds: MAX_ADS,
  };

  const result = await runSync<AdItem>(ACTOR_ID, input, { timeoutSec: 180 });
  const ads = result.items
    .filter((a) => a && (a.body_text || a.title))
    .slice(0, MAX_ADS);

  logger.info("apify.competitor_ads.done", {
    leadId: lead.id,
    country,
    ads: ads.length,
    costCents: result.costUsdCents,
  });

  return {
    output: {
      searchText,
      country,
      ads: ads.map((a) => ({
        id: a.ad_archive_id,
        pageName: a.page_name,
        body: a.body_text,
        title: a.title,
        cta: a.cta_text,
        startDate: a.start_date,
        snapshotUrl: a.ad_snapshot_url,
      })),
      count: ads.length,
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
  const o = output as {
    ads?: Array<{ id?: string; pageName?: string; body?: string | null; title?: string | null; cta?: string | null }>;
  };
  if (!Array.isArray(o.ads)) return [];

  return o.ads
    .filter((a) => (a.body ?? "") || (a.title ?? ""))
    .map((a) => ({
      kind: "COMPETITOR_AD" as const,
      text: [a.title, a.body, a.cta ? `CTA: ${a.cta}` : null]
        .filter(Boolean)
        .join("\n"),
      leadId: ctx.leadId,
      refType: "competitor_ad",
      refId: a.id ? `${ctx.leadId}:ad:${a.id}` : undefined,
      metadata: {
        pageName: a.pageName,
        source: "APIFY_COMPETITOR_ADS",
      },
    }));
};
