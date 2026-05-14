/**
 * Truth Layer v1 — T-E source 4: Instagram bio scrape.
 *
 * Many F&B / hospitality businesses run their entire web presence
 * through Instagram and use the bio's single external link as the
 * de-facto homepage. If we can find that link we can flip the
 * verification gate to `confirmed_present` for leads Google didn't
 * surface a homepage URL for.
 *
 * Pipeline:
 *   1. Apify `apify/instagram-scraper` is invoked in
 *      `searchType: "user"` mode with `{businessName} {city}` as
 *      the search term, asking for the top profile match.
 *   2. The `externalUrl` / `bioLink` field on the returned profile
 *      is treated as the canonical homepage URL — any non-empty
 *      value passes the gate. Empty / missing → `absent`.
 *   3. Anything goes wrong (no IG token, actor rate-limit, schema
 *      drift) → `error`. The contract deriver ignores these so a
 *      flaky third-party doesn't push uncertain leads into a
 *      `confirmed_absent` we can't defend.
 *
 * We deliberately do NOT use the Lead's existing
 * `WebsiteAudit.socialProfiles.instagram` URL: the orchestrator
 * fires before any audit row exists for fresh leads (`websiteUrl`
 * is null, the auditor short-circuited NO_WEBSITE pre-T-E and never
 * got to populate socials). Searching by name avoids a chicken-and-
 * egg dependency on the very audit row this gate is supposed to
 * inform.
 *
 * Apify actor ID: `apify/instagram-scraper` — same actor the
 * existing `APIFY_INSTAGRAM_DEEP` worker uses, which IS confirmed to
 * exist on the Apify Marketplace.
 */
import { logger } from "@/lib/logger";
import { isConfigured, runSync } from "@/lib/apify";
import type { WebsiteVerificationSourceCheck } from "@/lib/sdr-brain/contracts";
import type { WebsiteMultiVerifyInput } from "../website-multi-verify";

const ACTOR_ID = "apify/instagram-scraper";
const MAX_PROFILES = 3;

interface IgProfile {
  username?: string;
  fullName?: string;
  externalUrl?: string;
  bioLink?: string;
  bio?: string;
  // Apify's instagram-scraper sometimes nests the link list under
  // `biography_with_entities.entities[].url` — we do a shallow
  // walk over a few known shapes.
  biographyWithEntities?: {
    entities?: Array<{ url?: string }>;
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeCheck(
  result: WebsiteVerificationSourceCheck["result"],
  url: string | null,
): WebsiteVerificationSourceCheck {
  return {
    name: "instagram_bio",
    result,
    url,
    checkedAt: nowIso(),
  };
}

function cityFromAddress(formattedAddress: string): string {
  const parts = formattedAddress
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0];
  return parts[parts.length - 2].replace(/\s+[A-Z0-9]{2,4}\s*\d.*$/i, "").trim();
}

function pickBioLink(profile: IgProfile): string | null {
  const candidates: Array<string | undefined> = [
    profile.externalUrl,
    profile.bioLink,
    profile.biographyWithEntities?.entities?.find((e) => !!e.url)?.url,
  ];
  for (const raw of candidates) {
    const trimmed = (raw ?? "").trim();
    if (!trimmed) continue;
    // Bio links sometimes drop the scheme — Instagram users type
    // "example.com" into the link field.
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(trimmed)) {
      return `https://${trimmed}`;
    }
  }
  return null;
}

export async function verifyWebsiteViaInstagramBio(
  input: WebsiteMultiVerifyInput,
): Promise<WebsiteVerificationSourceCheck> {
  if (!isConfigured()) {
    logger.info("apify.instagram_bio.skipped", {
      reason: "apify_not_configured",
    });
    return makeCheck("error", null);
  }

  const city = cityFromAddress(input.formattedAddress);
  const search = city
    ? `${input.businessName} ${city}`
    : input.businessName;

  try {
    const result = await runSync<IgProfile>(
      ACTOR_ID,
      {
        search,
        searchType: "user",
        searchLimit: MAX_PROFILES,
        // The actor accepts `resultsType: "details"` to return the
        // full profile (bio + externalUrl) rather than just the
        // search-list shape. Without this the dataset only carries
        // the `username` and we'd never find the bio link.
        resultsType: "details",
        resultsLimit: MAX_PROFILES,
      },
      { timeoutSec: 60 },
    );

    for (const profile of result.items.slice(0, MAX_PROFILES)) {
      const url = pickBioLink(profile);
      if (url) {
        logger.info("apify.instagram_bio.present", {
          username: profile.username,
          url,
        });
        return makeCheck("present", url);
      }
    }

    logger.info("apify.instagram_bio.absent", {
      search,
      profiles: result.items.length,
    });
    return makeCheck("absent", null);
  } catch (err) {
    logger.warn("apify.instagram_bio.failed", {
      search,
      err: err instanceof Error ? err.message : String(err),
    });
    return makeCheck("error", null);
  }
}
