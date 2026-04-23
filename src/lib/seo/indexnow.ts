/**
 * IndexNow client.
 *
 * IndexNow is a lightweight push protocol supported by Bing, Yandex,
 * Seznam, Naver and a handful of smaller engines. Google does not
 * honour it (yet) but participating engines pick up new URLs within
 * minutes, which is exactly what a directory site needs.
 *
 * Flow:
 *   1. Publish a key file at /{key}.txt containing the key string.
 *   2. POST a JSON payload to https://api.indexnow.org/indexnow with
 *      {host, key, keyLocation, urlList}.
 *
 * Envs:
 *   INDEXNOW_KEY           — the random key string (32+ chars).
 *   INDEXNOW_KEY_LOCATION  — absolute URL to the key file. Optional; we
 *                            default to `${SITE.url}/${key}.txt`.
 *
 * Use cases:
 *   - New /b/* page published after a crawl completes.
 *   - New /niches/* / /cities/* page first indexed (evidence-floor flip).
 *   - Editorial post published / updated.
 *
 * Ad-hoc use: `await pingIndexNow([url1, url2, ...])`.
 * Batched use via BullMQ: enqueue a `{ kind: "indexnow-ping", urls }`
 * job on the `seo-ops` queue (see src/workers/seo-ops-worker.ts).
 */

import { SITE } from "./metadata";
import { prisma } from "@/lib/prisma";
import { slugify, slugWithSuffix } from "@/lib/slug";
import { passesEvidenceFloor } from "./programmatic";

const ENDPOINT = "https://api.indexnow.org/indexnow";
const MAX_BATCH = 10_000;

export function isIndexNowConfigured(): boolean {
  return Boolean(process.env.INDEXNOW_KEY);
}

/**
 * Low-level push. Returns true on 200/202 from the IndexNow endpoint.
 * Accepts up to 10,000 URLs; callers should batch above that limit.
 *
 * Fails silently — if IndexNow is down, the next sitemap cycle will
 * still pick things up; we never surface this error to the user.
 */
export async function pingIndexNow(urls: string[]): Promise<boolean> {
  const key = process.env.INDEXNOW_KEY;
  if (!key) return false;
  if (!urls.length) return true;

  const host = new URL(SITE.url).host;
  const keyLocation =
    process.env.INDEXNOW_KEY_LOCATION ?? `${SITE.url}/api/indexnow-key`;

  const deduped = Array.from(new Set(urls)).slice(0, MAX_BATCH);

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key,
        keyLocation,
        urlList: deduped,
      }),
    });
    if (!res.ok) {
      console.error(
        "[indexnow] ping failed",
        res.status,
        await res.text().catch(() => ""),
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error("[indexnow] fetch error", err);
    return false;
  }
}

/**
 * Fire IndexNow for a newly-analyzed public lead.
 *
 * Guards:
 *   - INDEXNOW_KEY must be set.
 *   - Lead workspace must have publicProfilesEnabled = true.
 *   - Lead must pass the evidence floor (no thin pages leak into the
 *     IndexNow stream).
 *
 * Also pings the parent /cities/:city and /niches/:niche/:city hubs, so
 * Bing reindexes the aggregation pages that now include the new business.
 *
 * Returns silently on any failure — IndexNow is an optimistic channel,
 * we never want to block the analyze pipeline on it.
 */
export async function pingIndexNowForLead(leadId: string): Promise<void> {
  if (!isIndexNowConfigured()) return;

  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        websiteAudit: true,
        salesOpportunity: true,
        workspace: { select: { publicProfilesEnabled: true } },
      },
    });
    if (!lead) return;
    if (!lead.workspace.publicProfilesEnabled) return;

    const ok = passesEvidenceFloor({
      id: lead.id,
      businessName: lead.businessName,
      rating: lead.rating,
      reviewCount: lead.reviewCount,
      hasWebsite: lead.hasWebsite,
      websiteAudit: lead.websiteAudit,
      salesOpportunity: lead.salesOpportunity,
    });
    if (!ok) return;

    const citySlug = slugify(lead.borough || "unknown");
    const businessSlug = slugWithSuffix(lead.businessName, lead.id);
    const nicheSlug = lead.primaryType ? slugify(lead.primaryType) : null;

    const urls = [`${SITE.url}/b/${citySlug}/${businessSlug}`];
    urls.push(`${SITE.url}/cities/${citySlug}`);
    if (nicheSlug) {
      urls.push(`${SITE.url}/niches/${nicheSlug}`);
      urls.push(`${SITE.url}/niches/${nicheSlug}/${citySlug}`);
    }

    await pingIndexNow(urls);
  } catch (err) {
    console.error("[indexnow] lead ping failed", err);
  }
}
