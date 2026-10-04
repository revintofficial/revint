// src/lib/site-capture/capture.ts
/**
 * The capture loop: opens the relevant pages of one site inside a page and
 * time budget and writes down what happened to every address it found.
 * The page opener is injected (Playwright in production, a fake in tests).
 */
import { menuPdf } from "@/lib/site-facts";
import { siteKey } from "@/lib/site-signals";
import { classifyUrl, isDrinksOnlyPdf, isKnownVendorUrl, isVenueListUrl } from "./classify";
import {
  EMPTY_ROBOTS,
  Frontier,
  isDisallowed,
  knownPathCandidates,
  parseRobots,
  parseSitemap,
  sitemapCandidates,
  type RobotsRules,
} from "./discover";
import type { PdfTextResult } from "./documents";
import { CoverageLedger } from "./ledger";
import { MAX_TEXT_CHARS, reducePage } from "./reduce";
import type { Candidate, CapturedPage, LedgerEntry, LedgerReason, PageOpener, SiteCaptureResult } from "./types";
import { urlKey } from "./url";

export interface CaptureLimits {
  /** Including the homepage. */
  maxPages: number;
  budgetMs: number;
  pageTimeoutMs: number;
  /** Pages open at once on the same site. */
  concurrency: number;
  maxPdfs: number;
  maxDepth: number;
  maxSitemapFiles: number;
  /** Navigations tried in total (failed pages do not use up a page slot). */
  maxAttempts: number;
}

export const DEFAULT_LIMITS: CaptureLimits = {
  maxPages: 40,
  budgetMs: 150_000,
  pageTimeoutMs: 15_000,
  concurrency: 3,
  maxPdfs: 5,
  maxDepth: 2,
  maxSitemapFiles: 3,
  maxAttempts: 80,
};

export interface CaptureInput {
  /** Where the homepage navigation ended. */
  homeUrl: string;
  homeHtml: string;
  /** Third-party requests the homepage made (recorded by the homepage audit). */
  homeRequests?: string[];
  /** Today's three subpages (pickSubpages targets). */
  pinned: Array<{ kind: "menu" | "reservation" | "order"; url: string }>;
  opener: PageOpener;
  /** SSRF-safe text fetch for robots.txt and sitemaps; `null` when unavailable. */
  fetchText(url: string): Promise<string | null>;
  fetchPdf(url: string, timeoutMs: number): Promise<PdfTextResult>;
  signal?: AbortSignal;
  now?: () => number;
  limits?: Partial<CaptureLimits>;
}

const MAX_KEPT_HTML = 8;
/** Sitemap addresses collected over all files of one capture. */
const MAX_SITEMAP_URLS = 10_000;
/** This many refused navigations in a row and the site is treated as blocking the crawler. */
const REFUSED_STREAK_LIMIT = 8;
/** Below this length two pages can share their text without being the same page. */
const MIN_DUPLICATE_TEXT = 200;

function textKey(text: string): string {
  return `${text.length}:${text.slice(0, 500)}`;
}

function withTimeout<T>(p: Promise<T>, ms: number, onTimeout: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(onTimeout), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      () => {
        clearTimeout(timer);
        resolve(onTimeout);
      },
    );
  });
}

export async function captureSite(input: CaptureInput): Promise<SiteCaptureResult> {
  const limits: CaptureLimits = { ...DEFAULT_LIMITS, ...input.limits };
  const now = input.now ?? Date.now;
  const startedAt = now();
  const deadline = startedAt + limits.budgetMs;
  const home = new URL(input.homeUrl);

  const ledger = new CoverageLedger();
  const frontier = new Frontier(limits.maxPages - 1);
  const pages: CapturedPage[] = [];
  const seenFinal = new Set<string>();
  const seenText = new Set<string>();
  const pdfUrls: string[] = [];
  // A fragment or a tracking parameter does not make a different PDF.
  const pdfKeys = new Set<string>();
  // An object, not `let`s: the values are assigned inside closures.
  // `stop` ends everything (time, abort); `halt` only ends page opening (attempt cap, a site refusing the crawler).
  const state = {
    stop: null as "budget" | "aborted" | null,
    halt: null as "limit_total" | "blocked" | null,
    refusedStreak: 0,
    keptHtml: 0,
    attempts: 0,
    inFlight: 0,
  };

  /** Consecutive navigations ending in `blocked` or `timeout` trip the breaker; anything else resets it. */
  const noteNavigation = (reason: LedgerReason | null): void => {
    state.refusedStreak = reason === "blocked" || reason === "timeout" ? state.refusedStreak + 1 : 0;
    if (state.refusedStreak >= REFUSED_STREAK_LIMIT) state.halt ??= "blocked";
  };

  const stopped = (): boolean => {
    if (state.stop) return true;
    if (input.signal?.aborted) state.stop = "aborted";
    else if (now() >= deadline) state.stop = "budget";
    return state.stop !== null;
  };

  const record = (
    c: Pick<LedgerEntry, "url" | "type" | "source">,
    e: Pick<LedgerEntry, "outcome" | "reason"> & Partial<Pick<LedgerEntry, "finalUrl" | "httpStatus">>,
  ): void => {
    ledger.record({
      url: c.url,
      type: c.type,
      source: c.source,
      finalUrl: e.finalUrl ?? null,
      httpStatus: e.httpStatus ?? null,
      outcome: e.outcome,
      reason: e.reason,
    });
  };

  const admitLinks = (page: CapturedPage, depth: number): void => {
    const found: Candidate[] = [];
    for (const l of page.links) {
      let u: URL;
      try {
        u = new URL(l.href);
      } catch {
        continue;
      }
      if (/\.pdf$/i.test(u.pathname)) {
        const isMenu =
          (page.type === "home" || page.type === "menu") && menuPdf({ text: l.text, url: u }) && !isDrinksOnlyPdf(l.text, u);
        const key = urlKey(u.href) ?? u.href;
        if (isMenu && !pdfKeys.has(key)) {
          pdfKeys.add(key);
          u.hash = "";
          pdfUrls.push(u.href);
        }
        continue;
      }
      const type = classifyUrl(u, l.text, home);
      if (!type || type === "home") continue;
      u.hash = "";
      found.push({ url: u.href, type, source: depth === 1 ? "home_link" : "page_link", depth, linkText: l.text || null });
    }
    frontier.add(found);
  };

  // The homepage was already opened by the homepage audit.
  const homePage: CapturedPage = {
    ...reducePage(input.homeHtml, input.homeUrl),
    url: input.homeUrl,
    finalUrl: input.homeUrl,
    type: "home",
    httpStatus: 200,
    thirdPartyRequests: input.homeRequests ?? [],
    source: "browser",
    needsOcr: false,
    html: input.homeHtml,
  };
  pages.push(homePage);
  frontier.markSeen(input.homeUrl);
  seenFinal.add(urlKey(input.homeUrl) ?? input.homeUrl);
  seenText.add(textKey(homePage.text));
  record({ url: input.homeUrl, type: "home", source: "home_link" }, { outcome: "opened", reason: null, finalUrl: input.homeUrl, httpStatus: 200 });

  // Pinned pages go in first so they win the de-duplication against plain links.
  frontier.add(
    input.pinned.map((t) => ({ url: t.url, type: t.kind, source: "home_link" as const, depth: 1, linkText: null, pinned: true })),
  );
  admitLinks(homePage, 1);

  let robots: RobotsRules = EMPTY_ROBOTS;
  let sitemapUrlCount = 0;
  if (!stopped()) {
    const robotsTxt = await input.fetchText(new URL("/robots.txt", home).href).catch(() => null);
    if (robotsTxt) robots = parseRobots(robotsTxt);
    const files = robots.sitemaps.length > 0 ? [...robots.sitemaps] : [new URL("/sitemap.xml", home).href];
    const urls: string[] = [];
    for (let i = 0; i < files.length && i < limits.maxSitemapFiles && !stopped(); i++) {
      const xml = await input.fetchText(files[i]).catch(() => null);
      if (!xml) continue;
      const parsed = parseSitemap(xml);
      // A loop, not `push(...)`: spreading a huge array overflows the call stack.
      for (const u of parsed.urls) {
        if (urls.length >= MAX_SITEMAP_URLS) break;
        urls.push(u);
      }
      for (const s of parsed.sitemaps) {
        if (files.length >= limits.maxSitemapFiles) break;
        files.push(s);
      }
    }
    sitemapUrlCount = urls.length;
    frontier.add(sitemapCandidates(urls, home));
    frontier.add(knownPathCandidates(home, (t) => frontier.hasType(t)));
  }

  const visit = async (c: Candidate): Promise<void> => {
    const requested = new URL(c.url);
    if (!c.pinned && c.type !== "external" && isDisallowed(requested.pathname + requested.search, robots)) {
      record(c, { outcome: "skipped", reason: "robots_disallow" });
      frontier.refund(c);
      return;
    }
    state.attempts++;
    const timeoutMs = Math.max(1_000, Math.min(limits.pageTimeoutMs, deadline - now()));
    const opened = await input.opener.open(c.url, { timeoutMs, signal: input.signal });
    if (opened.error || opened.html === null || (opened.status !== null && opened.status >= 400)) {
      const blocked = opened.status === 401 || opened.status === 403 || opened.status === 429;
      const reason = opened.error ?? (blocked ? "blocked" : "http_error");
      noteNavigation(reason);
      record(c, { outcome: "failed", reason, finalUrl: opened.finalUrl, httpStatus: opened.status });
      frontier.refund(c);
      return;
    }
    noteNavigation(null);

    let landed: URL;
    try {
      landed = new URL(opened.finalUrl);
    } catch {
      record(c, { outcome: "failed", reason: "nav_error", httpStatus: opened.status });
      frontier.refund(c);
      return;
    }
    if (c.type !== "external" && siteKey(landed.hostname) !== siteKey(home.hostname)) {
      // The link left the venue's site. A known vendor page is the one hop we keep.
      if (!isKnownVendorUrl(landed)) {
        record(c, { outcome: "failed", reason: "offsite", finalUrl: opened.finalUrl, httpStatus: opened.status });
        frontier.refund(c);
        return;
      }
      // It counts against the external cap, not the type it was linked as.
      // On success `c.type` becomes "external", so later refunds give back that slot.
      if (!frontier.retype(c, "external")) {
        record(c, { outcome: "skipped", reason: "limit_type", finalUrl: opened.finalUrl, httpStatus: opened.status });
        frontier.refund(c);
        return;
      }
    }
    const type = c.type;

    const reduced = reducePage(opened.html, opened.finalUrl);
    const finalKey = urlKey(opened.finalUrl) ?? opened.finalUrl;
    const sameText = reduced.text.length >= MIN_DUPLICATE_TEXT && seenText.has(textKey(reduced.text));
    if (!c.pinned && (seenFinal.has(finalKey) || sameText)) {
      record(c, { outcome: "skipped", reason: "duplicate", finalUrl: opened.finalUrl, httpStatus: opened.status });
      frontier.refund(c);
      return;
    }
    seenFinal.add(finalKey);
    seenText.add(textKey(reduced.text));

    // Raw HTML is kept for the pinned pages (mergeSiteFacts) and the venue lists (location and hotel signals).
    const keepHtml = c.pinned === true || (type === "locations" && isVenueListUrl(opened.finalUrl));
    const keep = keepHtml && state.keptHtml < MAX_KEPT_HTML;
    if (keep) state.keptHtml++;
    const page: CapturedPage = {
      ...reduced,
      url: c.url,
      finalUrl: opened.finalUrl,
      type,
      httpStatus: opened.status,
      thirdPartyRequests: opened.thirdPartyRequests,
      source: opened.source,
      needsOcr: false,
      html: keep ? opened.html : null,
    };
    pages.push(page);
    record({ url: c.url, type, source: c.source }, { outcome: "opened", reason: null, finalUrl: opened.finalUrl, httpStatus: opened.status });
    if (type !== "external" && c.depth < limits.maxDepth) admitLinks(page, c.depth + 1);
  };

  const worker = async (): Promise<void> => {
    for (;;) {
      if (stopped() || state.halt) return;
      if (state.attempts >= limits.maxAttempts) {
        state.halt = "limit_total";
        return;
      }
      const c = frontier.next();
      if (!c) {
        // Another worker may still be reading a page whose links refill the queue.
        if (state.inFlight === 0) return;
        await new Promise((r) => setTimeout(r, 25));
        continue;
      }
      state.inFlight++;
      try {
        await visit(c);
      } catch {
        noteNavigation("nav_error");
        record(c, { outcome: "failed", reason: "nav_error" });
        frontier.refund(c);
      } finally {
        state.inFlight--;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, limits.concurrency) }, () => worker()));

  for (let i = 0; i < pdfUrls.length; i++) {
    const pdf = { url: pdfUrls[i], type: "menu" as const, source: "pdf_link" as const };
    if (i >= limits.maxPdfs) {
      record(pdf, { outcome: "skipped", reason: "limit_type" });
      continue;
    }
    if (stopped()) {
      record(pdf, { outcome: "skipped", reason: state.stop ?? "budget" });
      continue;
    }
    const timeoutMs = Math.max(1_000, Math.min(20_000, deadline - now()));
    const timedOut: PdfTextResult = { ok: false, reason: "timeout", httpStatus: null };
    const r = await withTimeout(input.fetchPdf(pdf.url, timeoutMs), timeoutMs + 1_000, timedOut);
    if (!r.ok) {
      record(pdf, { outcome: "failed", reason: r.reason, httpStatus: r.httpStatus });
      continue;
    }
    pages.push({
      title: null,
      text: r.text.slice(0, MAX_TEXT_CHARS),
      links: [],
      embeds: [],
      jsonLd: [],
      url: pdf.url,
      finalUrl: pdf.url,
      type: "menu",
      httpStatus: 200,
      thirdPartyRequests: [],
      source: "pdf",
      needsOcr: r.needsOcr,
      html: null,
    });
    record(pdf, { outcome: "opened", reason: null, finalUrl: pdf.url, httpStatus: 200 });
  }

  stopped();
  const leftovers = frontier.rest();
  // A leftover over a type or total cap keeps that reason; only "not reached in time" takes the stop reason.
  const stopReason = state.halt ?? state.stop ?? "budget";
  for (const { candidate, reason } of leftovers) {
    record(candidate, { outcome: "skipped", reason: reason === "budget" ? stopReason : reason });
  }
  // The attempt cap alone is not "cut short": only if it left pages that were never tried.
  const cutShort = state.stop !== null || state.halt === "blocked" || leftovers.some((l) => l.reason === "budget");

  return {
    rootUrl: input.homeUrl,
    status: cutShort ? "partial" : "complete",
    startedAt: new Date(startedAt).toISOString(),
    durationMs: now() - startedAt,
    pages,
    ledger: ledger.entries(),
    sitemapUrlCount,
    candidateOverflow: frontier.overflow,
  };
}
