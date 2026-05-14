/**
 * Truth Layer contract — `WebsiteVerificationStatus` + `WebsiteVerificationResult`.
 *
 * Producer: T-E Website Verification (multi-source orchestrator).
 * Consumers: T-D Brief Grounding, IntelligenceBrief, WebsiteSignalStrip.
 *
 * The whole reason this contract exists: the v1 brief writer would
 * hallucinate "no website" claims based on a single missing
 * `Lead.websiteUrl` (which often just means Google Places didn't return
 * the homepage URL — the business has a website, it's just elsewhere).
 * The new rule is: a "no website" claim cannot ship unless at least 3
 * independent sources return `absent`. T-E orchestrates Google Business
 * field, Bing brand search, Companies House (UK), and Instagram bio.
 */

export const __contractVersion = 1;

export type WebsiteVerificationStatus =
  | "confirmed_present"
  | "confirmed_absent"
  | "uncertain";

export type WebsiteVerificationSource =
  | "google_business_field"
  | "bing_brand_search"
  | "companies_house"
  | "instagram_bio";

export type WebsiteVerificationSourceResult = "present" | "absent" | "error";

export interface WebsiteVerificationSourceCheck {
  name: WebsiteVerificationSource;
  result: WebsiteVerificationSourceResult;
  url: string | null;
  /** ISO-8601 string. Stored verbatim so analytics can age out stale checks. */
  checkedAt: string;
}

export interface WebsiteVerificationResult {
  status: WebsiteVerificationStatus;
  sources: WebsiteVerificationSourceCheck[];
  /** Best-known canonical URL across all positive sources. */
  resolvedUrl: string | null;
}

/**
 * Decision rule for `status`, kept here so producers + consumers stay
 * in lockstep. T-E uses this; T-D imports it for its block-decision
 * test in `lead-intelligence-brief.ts`.
 */
export function deriveWebsiteVerificationStatus(
  sources: ReadonlyArray<Pick<WebsiteVerificationSourceCheck, "result">>,
): WebsiteVerificationStatus {
  const positives = sources.filter((s) => s.result === "present").length;
  const negatives = sources.filter((s) => s.result === "absent").length;
  if (positives >= 1) return "confirmed_present";
  if (negatives >= 3) return "confirmed_absent";
  return "uncertain";
}
