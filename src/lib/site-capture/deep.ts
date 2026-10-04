// src/lib/site-capture/deep.ts
/**
 * Deep website audit: today's homepage audit, then a capture of the site's
 * relevant pages, then the facts read from that capture. `crawlWebsite`
 * (shallow) stays as it is for the legacy path and the capacity fallback.
 */
import { CRAWLER_USER_AGENT, crawlHomepage, getBrowser, type HomeSnapshot } from "@/lib/crawler";
import { extractFeatures } from "@/lib/extractor";
import { pickSubpages } from "@/lib/site-facts";
import type { WebsiteFeatures } from "@/types";
import { siteFactsFromCapture } from "./bridge";
import { captureSite, type CaptureLimits } from "./capture";
import { fetchPdfText } from "./documents";
import { createPlaywrightOpener, fetchTextSafe } from "./opener";
import type { LedgerReason, SiteCaptureResult } from "./types";

export interface DeepCrawlResult {
  features: WebsiteFeatures;
  /** `null` when there was nothing to capture (social profile, URL refused by the guard, aborted before start). */
  capture: SiteCaptureResult | null;
}

const HOME_FAILURE_REASON: Record<string, LedgerReason> = {
  TIMEOUT: "timeout",
  BOT_BLOCKED_4XX: "blocked",
  SERVER_5XX: "http_error",
};

function homeOnlyCapture(url: string, features: WebsiteFeatures, startedAt: number): SiteCaptureResult {
  const blocked = features.crawlError === "BOT_BLOCKED_4XX";
  return {
    rootUrl: url,
    status: blocked ? "blocked" : "failed",
    startedAt: new Date(startedAt).toISOString(),
    durationMs: Date.now() - startedAt,
    pages: [],
    ledger: [
      {
        url,
        finalUrl: null,
        type: "home",
        source: "home_link",
        outcome: "failed",
        reason: HOME_FAILURE_REASON[features.crawlError ?? ""] ?? "nav_error",
        httpStatus: features.httpStatus ?? null,
      },
    ],
    sitemapUrlCount: 0,
    candidateOverflow: 0,
  };
}

export async function crawlWebsiteDeep(
  url: string,
  businessType?: string | null,
  opts: { signal?: AbortSignal; limits?: Partial<CaptureLimits> } = {},
): Promise<DeepCrawlResult> {
  const startedAt = Date.now();
  const first = await crawlHomepage(url, businessType);
  let features = first.features;
  let home: HomeSnapshot | null = first.home;

  if (features.crawlError === "SOCIAL_MEDIA_ONLY" || features.crawlError === "BLOCKED_BY_GUARD") {
    return { features, capture: null };
  }
  if (opts.signal?.aborted) return { features, capture: null };

  const opener = await createPlaywrightOpener(await getBrowser(), url, opts.signal);
  try {
    if (!home && features.crawlError === "BOT_BLOCKED_4XX") {
      // Desktop Chromium was refused. The opener retries with a mobile identity, then plain HTTP.
      const retry = await opener.open(url, { timeoutMs: 20_000, signal: opts.signal });
      if (retry.html && !retry.error) {
        home = {
          finalUrl: retry.finalUrl,
          html: retry.html,
          thirdPartyRequests: retry.thirdPartyRequests,
          visibleText: retry.visibleText ?? null,
        };
        features = {
          ...extractFeatures(retry.html, url, businessType),
          loadTimeMs: features.loadTimeMs,
          securityHeaders: features.securityHeaders,
          consoleErrors: features.consoleErrors,
          mobileFriendlyGuess: /<meta[^>]+name=["']viewport["']/i.test(retry.html),
          httpStatus: retry.status ?? 200,
          reachable: true,
          crawlError: null,
        };
      }
    }
    if (!home) return { features, capture: homeOnlyCapture(url, features, startedAt) };

    const pick = pickSubpages(home.html, home.finalUrl);
    const capture = await captureSite({
      homeUrl: home.finalUrl,
      homeHtml: home.html,
      homeText: home.visibleText,
      homeRequests: home.thirdPartyRequests,
      pinned: pick.targets,
      opener,
      fetchText: fetchTextSafe,
      fetchPdf: (pdfUrl, timeoutMs) => fetchPdfText(pdfUrl, { timeoutMs, userAgent: CRAWLER_USER_AGENT, signal: opts.signal }),
      signal: opts.signal,
      limits: opts.limits,
    });
    features.siteFacts = siteFactsFromCapture({ url: home.finalUrl, html: home.html }, capture, pick);
    return { features, capture };
  } finally {
    await opener.close();
  }
}
