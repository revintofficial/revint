/**
 * Truth Layer v1 — T-E source 2: Bing brand search.
 *
 * Runs `"{businessName} {city}"` against an Apify Bing-search actor
 * and looks for an "obvious own-domain hit" in the top 5 organic
 * results. The verdict is folded into the multi-source orchestrator
 * (`src/lib/agent-workers/website-multi-verify.ts`) — this file
 * never writes to the DB.
 *
 * Why Bing and not Google:
 *   - Google SERP is heavily rate-limited by every scraper provider
 *     (Apify's `apify/google-search-scraper` already powers
 *     APIFY_SERP_RANK and that worker carries a real $0.05 / lead
 *     budget). Bing is the cheaper independent corroborator and
 *     spec'd by the master plan as the second leg of T-E.
 *   - Bing's organic results carry the homepage of a brand for a
 *     "{name} {city}" query in the overwhelming majority of cases —
 *     more than enough to flip the gate to `present` when the
 *     business has a real site Google didn't surface.
 *
 * Owned-domain detection (`looksOwned`):
 *   We normalise the business name (alphanumerics-only, lowercased)
 *   and compare against the second-level domain of every top-5
 *   result. Substring matches both ways count: "casapolanco" in
 *   "casapolanco" passes; the variant "casa-polanco" → "casapolanco"
 *   in domain "casapolancorestaurante" also passes. This is
 *   intentionally loose — false positives here cost the gate
 *   nothing because a positive only escalates `uncertain` to
 *   `confirmed_present`, which is conservative on the "no website"
 *   side (T-D's blocker is "do not claim no website unless
 *   confirmed_absent"; over-eager `confirmed_present` is safe).
 *
 * Cost-control: this runner is invoked only when Source 1 (Google
 * Business field) was `null`. The orchestrator never short-circuits
 * past it — every websiteUrl-less lead pays one Bing call's worth of
 * Apify cents (~$0.005 sync run, well under the master plan's R3
 * $0.04/lead ceiling).
 *
 * Apify actor ID: `tri_angle/bing-search-scraper` (PLACEHOLDER —
 * Master Coordinator should verify this exists on the Apify
 * Marketplace; if not, swap for `apify/bing-search-scraper` or any
 * equivalent low-cost Bing scraper). The actor is expected to
 * accept `{ queries: string[], maxResults: number }` and return a
 * dataset of `{ url, title, position }` rows.
 */
import { logger } from "@/lib/logger";
import { isConfigured, runSync } from "@/lib/apify";
import type { WebsiteVerificationSourceCheck } from "@/lib/sdr-brain/contracts";
import type { WebsiteMultiVerifyInput } from "../website-multi-verify";

const ACTOR_ID = "tri_angle/bing-search-scraper";
const MAX_RESULTS = 5;

interface BingResult {
  url?: string;
  title?: string;
  position?: number;
  organicResults?: Array<{ url?: string; title?: string; position?: number }>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeCheck(
  result: WebsiteVerificationSourceCheck["result"],
  url: string | null,
): WebsiteVerificationSourceCheck {
  return {
    name: "bing_brand_search",
    result,
    url,
    checkedAt: nowIso(),
  };
}

/**
 * Pulls the most "city-shaped" segment out of a Google-Places
 * formatted address. Splits on commas, picks the third-from-last
 * piece (typical Google shape "12 Street, Locality, City PostCode,
 * Country") and falls back to the second-from-last when the
 * address has only 2-3 segments. Returns `""` when nothing useful
 * survives — Bing tolerates a `{businessName}` only query.
 */
function cityFromAddress(formattedAddress: string): string {
  const parts = formattedAddress
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0];
  // The penultimate segment is usually "City PostCode" — strip the
  // postcode-ish trailing digits so the query doesn't carry "London
  // SE10 8JL" into Bing.
  const candidate = parts[parts.length - 2];
  return candidate.replace(/\s+[A-Z0-9]{2,4}\s*\d.*$/i, "").trim();
}

function normaliseName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function domainStem(url: string): string | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "");
    const parts = host.split(".");
    if (parts.length < 2) return host;
    // For "casapolanco.com" → "casapolanco"; for
    // "casapolanco.co.uk" → "casapolanco"; "shop.example.com" →
    // "example". The stem is what we substring-match on the
    // business name, so we want it to be the brand-bearing label.
    if (parts.length >= 3 && /^(co|com|org|net|gov|ac)$/i.test(parts[parts.length - 2])) {
      return parts[parts.length - 3];
    }
    return parts[parts.length - 2];
  } catch {
    return null;
  }
}

function looksOwned(businessName: string, url: string): boolean {
  const stem = domainStem(url);
  if (!stem) return false;
  const normalisedStem = normaliseName(stem);
  const normalisedName = normaliseName(businessName);
  if (!normalisedStem || !normalisedName) return false;
  return (
    normalisedStem.includes(normalisedName) ||
    normalisedName.includes(normalisedStem)
  );
}

/**
 * Flatten the actor response. Bing scrapers vary: some yield a flat
 * dataset of `{ url, title, position }` rows, some wrap the results
 * inside a per-query `{ organicResults: [...] }` envelope. We accept
 * both shapes and slice down to the top {@link MAX_RESULTS} URLs.
 */
function flattenResults(items: BingResult[]): Array<{ url: string }> {
  const flat: Array<{ url: string }> = [];
  for (const item of items) {
    if (Array.isArray(item.organicResults)) {
      for (const r of item.organicResults) {
        if (r.url && typeof r.url === "string") flat.push({ url: r.url });
        if (flat.length >= MAX_RESULTS) return flat;
      }
    } else if (item.url && typeof item.url === "string") {
      flat.push({ url: item.url });
    }
    if (flat.length >= MAX_RESULTS) return flat;
  }
  return flat;
}

export async function verifyWebsiteViaBing(
  input: WebsiteMultiVerifyInput,
): Promise<WebsiteVerificationSourceCheck> {
  if (!isConfigured()) {
    logger.info("apify.bing_brand_search.skipped", {
      reason: "apify_not_configured",
    });
    return makeCheck("error", null);
  }

  const city = cityFromAddress(input.formattedAddress);
  const query = city
    ? `${input.businessName} ${city}`
    : input.businessName;

  try {
    const result = await runSync<BingResult>(
      ACTOR_ID,
      {
        queries: [query],
        maxResults: MAX_RESULTS,
        // Some Apify Bing actors accept `resultsPerPage` instead;
        // we send both keys so the actor can ignore whichever it
        // doesn't understand.
        resultsPerPage: MAX_RESULTS,
      },
      { timeoutSec: 60 },
    );

    const flat = flattenResults(result.items);
    const owned = flat.find((r) => looksOwned(input.businessName, r.url));

    if (owned) {
      logger.info("apify.bing_brand_search.present", {
        query,
        matchedUrl: owned.url,
      });
      return makeCheck("present", owned.url);
    }

    logger.info("apify.bing_brand_search.absent", {
      query,
      candidateCount: flat.length,
    });
    return makeCheck("absent", null);
  } catch (err) {
    // Apify rate-limits, 5xx, timeouts, malformed JSON — all
    // surface as "error" so the orchestrator's source-tally never
    // double-counts a network blip as a negative. The contract
    // deriver intentionally ignores `error` results.
    logger.warn("apify.bing_brand_search.failed", {
      query,
      err: err instanceof Error ? err.message : String(err),
    });
    return makeCheck("error", null);
  }
}
