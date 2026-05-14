/**
 * Truth Layer v1 — T-E source 3: Companies House (UK only).
 *
 * Looks up a registered UK company by name on Companies House (the
 * UK government corporate registry) and reports whatever website
 * URL the registrant filed. Strong positive when present — the
 * companies registry only carries URLs that the legal entity itself
 * declared.
 *
 * UK-only by construction: the orchestrator passes
 * `input.country` (ISO-3166-1 alpha-2 derived from
 * `lead.formattedAddress`). Anything other than `"GB"` short-circuits
 * to `result: "error"` with reason `"non_gb"` so non-UK leads only
 * have 3 candidate sources (the contract decision rule then needs
 * 3 negatives across Bing + Companies-House-error + Instagram to
 * reach `confirmed_absent`; the error result doesn't count, which is
 * exactly the design — Companies House isn't evidence outside the
 * UK).
 *
 * Apify actor ID: `vdrmota/companies-house-scraper` (PLACEHOLDER —
 * Master Coordinator should verify on the Apify Marketplace; the
 * Companies House public REST API is also a viable replacement and
 * doesn't need Apify, but going through `runSync` keeps the
 * cost-tracking + retry semantics consistent with the other two
 * sources). The actor is expected to accept `{ companyName: string,
 * country: "GB" }` and return `{ companyNumber, registeredOfficeAddress,
 * companyName, websiteUrl? }` rows.
 */
import { logger } from "@/lib/logger";
import { isConfigured, runSync } from "@/lib/apify";
import type { WebsiteVerificationSourceCheck } from "@/lib/sdr-brain/contracts";
import type { WebsiteMultiVerifyInput } from "../website-multi-verify";

const ACTOR_ID = "vdrmota/companies-house-scraper";
const MAX_MATCHES = 3;

interface CompaniesHouseRecord {
  companyName?: string;
  companyNumber?: string;
  websiteUrl?: string;
  website?: string;
  registeredOfficeAddress?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeCheck(
  result: WebsiteVerificationSourceCheck["result"],
  url: string | null,
): WebsiteVerificationSourceCheck {
  return {
    name: "companies_house",
    result,
    url,
    checkedAt: nowIso(),
  };
}

function pickWebsite(record: CompaniesHouseRecord): string | null {
  const raw = (record.websiteUrl ?? record.website ?? "").trim();
  if (!raw) return null;
  // Companies House submitters file URLs in every conceivable
  // shape ("www.example.com", "example.co.uk", "https://example").
  // Normalise to a syntactically-valid absolute URL so downstream
  // consumers can `new URL()` it without exploding.
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

export async function verifyWebsiteViaCompaniesHouse(
  input: WebsiteMultiVerifyInput,
): Promise<WebsiteVerificationSourceCheck> {
  // UK-only gate. Anything non-GB returns "error" rather than
  // "absent" so the orchestrator's negative-count threshold
  // (≥3 negatives → confirmed_absent) doesn't get padded by a
  // jurisdictional miss for, say, a Mexico City lead.
  if ((input.country ?? "").toUpperCase() !== "GB") {
    logger.info("apify.companies_house.skipped", {
      reason: "non_gb",
      country: input.country ?? null,
    });
    return makeCheck("error", null);
  }

  if (!isConfigured()) {
    logger.info("apify.companies_house.skipped", {
      reason: "apify_not_configured",
    });
    return makeCheck("error", null);
  }

  try {
    const result = await runSync<CompaniesHouseRecord>(
      ACTOR_ID,
      {
        companyName: input.businessName,
        country: "GB",
        maxItems: MAX_MATCHES,
      },
      { timeoutSec: 60 },
    );

    // Walk the matches and accept the first record that surfaced
    // a website. Companies House's "active" / "dissolved" status
    // is irrelevant for the website check — even a dissolved entity
    // with a filed URL is evidence the business existed online.
    for (const record of result.items.slice(0, MAX_MATCHES)) {
      const url = pickWebsite(record);
      if (url) {
        logger.info("apify.companies_house.present", {
          companyNumber: record.companyNumber,
          url,
        });
        return makeCheck("present", url);
      }
    }

    logger.info("apify.companies_house.absent", {
      companyName: input.businessName,
      matches: result.items.length,
    });
    return makeCheck("absent", null);
  } catch (err) {
    logger.warn("apify.companies_house.failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    return makeCheck("error", null);
  }
}
