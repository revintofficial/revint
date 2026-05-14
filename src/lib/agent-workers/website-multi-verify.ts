/**
 * Truth Layer v1 — T-E Website Verification Orchestrator.
 *
 * Pure function. Takes a {@link WebsiteMultiVerifyInput} (the slice of
 * a `Lead` we need) plus a {@link WebsiteMultiVerifyRunners} bag (one
 * function per source) and returns a {@link WebsiteVerificationResult}
 * built per the canonical {@link deriveWebsiteVerificationStatus}
 * decision rule from `@/lib/sdr-brain/contracts`.
 *
 * Why this lives outside `website-auditor.ts`:
 *   - The auditor is the side-effect surface (DB writes, telemetry,
 *     feature-flag gating). The orchestrator is data-in / data-out so
 *     vitest can exercise every fan-out branch without mocking Prisma.
 *   - The 4 sources land in one of three buckets — Google Business
 *     field (already on the lead row), one of three Apify-backed
 *     network calls (cost ~ $0.01-0.02 each), or — for Companies
 *     House — a UK-only conditional. The runner injection makes that
 *     surface trivially testable.
 *
 * Source ordering + short-circuit (master plan §3 T-E):
 *   1. `google_business_field` — if `input.websiteUrl` is non-null we
 *      record a single `present` source check and return immediately
 *      with `confirmed_present`. This is the cheap fast-path the
 *      cost-control gate (R3) assumes: we only spend Apify cents when
 *      Google didn't surface a homepage URL. When `websiteUrl` is
 *      `null` we DO NOT add a `google_business_field` source check —
 *      a missing Places homepage is weak evidence the business has no
 *      site (Google often just doesn't know), so counting it as a
 *      negative would push uncertain leads into `confirmed_absent`
 *      after only two more confirmations. Excluding it preserves the
 *      "≥3 negatives" threshold from the contract decision rule.
 *
 *   2. `bing_brand_search` (Apify) — fires on every websiteUrl-less
 *      lead. Owned-domain match in top 5 → `present`, else `absent`,
 *      else `error` (rate-limit / actor failure).
 *
 *   3. `companies_house` (Apify) — UK-only. The runner is responsible
 *      for the `country !== "GB"` short-circuit and returns
 *      `result: "error"` with a "skipped" reason in that case so
 *      non-UK leads only have 3 candidate sources.
 *
 *   4. `instagram_bio` (Apify) — last because we walk an extra
 *      Apify call (find handle → scrape bio link). Often the only
 *      positive signal for restaurants / bars that drive their
 *      whole online presence through IG.
 *
 * After source 1 fires positive we never call 2/3/4. After 2/3/4
 * each: if positive, short-circuit `confirmed_present`; otherwise
 * append the source check and continue. The terminal result is
 * `deriveWebsiteVerificationStatus(sources)` so producers and
 * consumers (T-D Brief, IntelligenceBrief, WebsiteSignalStrip) see
 * the same status no matter which surface ran the orchestrator.
 *
 * Idempotency: this function performs zero I/O. Repeated calls with
 * the same input produce the same output (mod monotonic
 * `checkedAt` clocks); the caller (website-auditor) is responsible
 * for the at-most-once write of `Lead.websiteVerificationStatus`.
 */
import {
  deriveWebsiteVerificationStatus,
  type WebsiteVerificationResult,
  type WebsiteVerificationSourceCheck,
} from "@/lib/sdr-brain/contracts";

export interface WebsiteMultiVerifyInput {
  /** Display name; passed to Bing / IG / Companies House as the search term. */
  businessName: string;
  /** `Lead.formattedAddress`. Used by Bing as a city/locality disambiguator. */
  formattedAddress: string;
  /**
   * ISO-3166-1 alpha-2 country code (e.g. "GB", "US"). The Companies
   * House runner uses this to short-circuit on non-UK leads. `null`
   * means "we couldn't derive a country" — Companies House will skip.
   */
  country: string | null;
  /**
   * `Lead.websiteUrl` from Google Places (= source 1). When non-null
   * the orchestrator short-circuits with `confirmed_present` and
   * spends zero Apify cents.
   */
  websiteUrl: string | null;
}

/**
 * Per-source runner contract. Each runner returns a structured
 * `WebsiteVerificationSourceCheck` — never throws — so the
 * orchestrator stays a single straight-line walk over the 4 sources
 * with no try/catch fan-out.
 *
 * Runners are responsible for:
 *   - Their own `isConfigured()` short-circuit (returning
 *     `result: "error"` when APIFY_TOKEN is missing).
 *   - Country / handle gating (Companies House skips non-GB; IG
 *     bio skips when no handle could be discovered).
 *   - Catching upstream Apify errors and translating them into
 *     `result: "error"` so a flaky third-party doesn't break the
 *     gate.
 */
export interface WebsiteMultiVerifyRunners {
  bingBrandSearch: (
    input: WebsiteMultiVerifyInput,
  ) => Promise<WebsiteVerificationSourceCheck>;
  companiesHouse: (
    input: WebsiteMultiVerifyInput,
  ) => Promise<WebsiteVerificationSourceCheck>;
  instagramBio: (
    input: WebsiteMultiVerifyInput,
  ) => Promise<WebsiteVerificationSourceCheck>;
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Walk the 4 sources in cost order, short-circuit on the first
 * positive, and let the canonical contract deriver decide the
 * terminal status.
 *
 * Returns:
 *   - `status`: `"confirmed_present"` after any positive, or the
 *     deriver's verdict (`"confirmed_absent"` ≥3 negatives, else
 *     `"uncertain"`) once every source has been polled.
 *   - `sources`: the ordered list of every check that actually ran
 *     (skipped/short-circuited sources are NOT included — see the
 *     module docstring for why google_business_field is omitted on
 *     `websiteUrl == null`).
 *   - `resolvedUrl`: the best-known canonical URL across positives.
 *     `null` when no source returned `present`.
 */
export async function multiVerifyWebsite(
  input: WebsiteMultiVerifyInput,
  runners: WebsiteMultiVerifyRunners,
): Promise<WebsiteVerificationResult> {
  const sources: WebsiteVerificationSourceCheck[] = [];
  let resolvedUrl: string | null = null;

  if (input.websiteUrl) {
    sources.push({
      name: "google_business_field",
      result: "present",
      url: input.websiteUrl,
      checkedAt: nowIso(),
    });
    return {
      status: "confirmed_present",
      sources,
      resolvedUrl: input.websiteUrl,
    };
  }

  const bing = await runners.bingBrandSearch(input);
  sources.push(bing);
  if (bing.result === "present") {
    if (bing.url) resolvedUrl = bing.url;
    return {
      status: "confirmed_present",
      sources,
      resolvedUrl,
    };
  }

  const ch = await runners.companiesHouse(input);
  sources.push(ch);
  if (ch.result === "present") {
    if (ch.url) resolvedUrl = ch.url;
    return {
      status: "confirmed_present",
      sources,
      resolvedUrl,
    };
  }

  const ig = await runners.instagramBio(input);
  sources.push(ig);
  if (ig.result === "present") {
    if (ig.url) resolvedUrl = ig.url;
    return {
      status: "confirmed_present",
      sources,
      resolvedUrl,
    };
  }

  return {
    status: deriveWebsiteVerificationStatus(sources),
    sources,
    resolvedUrl,
  };
}
