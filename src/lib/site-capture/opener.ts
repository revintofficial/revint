// src/lib/site-capture/opener.ts
/**
 * Opens pages for the capture in one browser context per site. Navigations
 * are checked against the SSRF guard as described below. A page that
 * answers 401 / 403 / 429 is retried with a mobile identity, then with a plain HTTP fetch;
 * after that it is "blocked" (no proxy).
 *
 * Contract the capture loop relies on (it does not wrap these itself):
 * - `open(url, { timeoutMs })` returns within roughly `timeoutMs`: the
 *   navigation gets the bulk of it and every later step is skipped or cut
 *   to what is left; the HTTP fallback runs under the same deadline.
 * - After the abort signal fires, in-flight and later `open` calls end
 *   promptly: closing the contexts rejects every pending Playwright call.
 * - `close()` returns within about two `BROWSER_STEP_TIMEOUT_MS` even when
 *   the browser hangs; a `newPage()` that hangs fails the page as "nav_error".
 * - SSRF: the context's route handler runs `assertSafeFetchUrl` on the
 *   first URL of each navigation request it is called for (top frame and
 *   sub-frames). Playwright does not call route handlers for redirect hops,
 *   so the page's URL is also checked twice more against the guard:
 *   1. right after `page.goto`, with every hop of its redirect chain, so the
 *      capture does not settle on an unsafe page;
 *   2. after the settle steps, with every main-frame navigation request the
 *      page made in its whole life (redirect hops included; meta refresh,
 *      script or click navigations included). Too many distinct navigation
 *      URLs count as unsafe.
 *   The HTML is read only after check 2. If the page's URL changed or a new
 *   main-frame navigation request was made while it was being read, the
 *   page is refused. Every refusal returns "unsafe_url" with no HTML and no
 *   third-party requests. The browser may already have sent a request to an
 *   internal address by then: that response is discarded, never read.
 *   Sub-frame redirect hops are not re-checked; sub-frame content is not
 *   read (`page.content()` is the main frame only). HTTP fetches go through
 *   `safeFetchFollow`, which checks every hop before requesting it.
 */
import type { Browser, BrowserContext, Page, Response } from "playwright";
import { CRAWLER_USER_AGENT } from "@/lib/crawler";
import { safeFetchFollow } from "@/lib/safe-fetch";
import { assertSafeFetchUrl } from "@/lib/url-guard";
import { readCappedText } from "./body";
import { recordThirdPartyRequests } from "./requests";
import type { OpenedPage, PageOpener } from "./types";

const MOBILE_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const MAX_HTML_CHARS = 1_500_000;
/** Byte caps of the HTTP fallbacks: reading stops there, the rest is never buffered. */
const MAX_HTML_BYTES = 1_500_000;
const MAX_TEXT_FILE_BYTES = 2_000_000;
const TEXT_FILE_TIMEOUT_MS = 8_000;
const BLOCKED_STATUS = new Set([401, 403, 429]);
const COOKIE_BUTTON =
  /^(accept( all)?( cookies)?|allow all( cookies)?|i agree|agree|got it|ok(ay)?|kabul et|tümünü kabul et|tamam)$/i;
/** Scrolls down in steps so lazy sections and widgets load, then back to the top. Capped at ~2 s. */
const SCROLL_SCRIPT = `(async () => {
  const step = 800;
  const max = Math.min(document.body ? document.body.scrollHeight : 0, 12800);
  for (let y = 0; y < max; y += step) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 120));
  }
  window.scrollTo(0, 0);
})()`;

const DEADLINE = Symbol("deadline");

/** Resolves to `DEADLINE` when `ms` passes or `signal` aborts first; `p`'s rejection passes through. */
function race<T>(p: Promise<T>, ms: number, signal?: AbortSignal): Promise<T | typeof DEADLINE> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return resolve(DEADLINE);
    const done = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      done();
      resolve(DEADLINE);
    };
    const timer = setTimeout(onAbort, Math.max(0, ms));
    signal?.addEventListener("abort", onAbort, { once: true });
    p.then(
      (v) => {
        done();
        resolve(v);
      },
      (e) => {
        done();
        reject(e);
      },
    );
  });
}

/**
 * A hung browser must not hold a capture slot: `newPage()` and every
 * `close()` get at most this long. A close that runs over is abandoned.
 */
export const BROWSER_STEP_TIMEOUT_MS = 5_000;

/** Waits for `p` at most `ms`; a late rejection is swallowed (never unhandled). */
async function settleWithin(p: Promise<unknown>, ms: number): Promise<void> {
  await race(p, ms).catch(() => {});
}

/** Every URL a navigation's response passed through, oldest last (the response's own request first). */
export function redirectChainUrls(res: Pick<Response, "request"> | null): string[] {
  const urls: string[] = [];
  let req = res?.request() ?? null;
  // A redirect chain is short; the cap only guards against a cyclic structure.
  for (let i = 0; req && i < 50; i++) {
    urls.push(req.url());
    req = req.redirectedFrom();
  }
  return urls;
}

/**
 * True when the landed URL and every redirect hop pass `guard` (which throws
 * on an unsafe URL). Each distinct URL is checked once.
 */
export async function checkNavigationChain(
  landedUrl: string,
  hops: string[],
  guard: (url: string) => Promise<unknown>,
): Promise<boolean> {
  const urls = [...new Set([landedUrl, ...hops])];
  try {
    await Promise.all(urls.map((u) => guard(u)));
    return true;
  } catch {
    return false;
  }
}

/** More distinct main-frame navigation URLs than this and the page is treated as unsafe. */
export const MAX_MAIN_FRAME_NAVIGATIONS = 30;

export interface NavigationLog {
  /** Distinct main-frame navigation request URLs, in order, at most the bound. */
  urls: string[];
  /** More distinct URLs than the bound were requested. */
  overflow: boolean;
  /** Every main-frame navigation request so far, repeats included (detects a new one). */
  total: number;
}

/**
 * Records every main-frame navigation request of the page for its whole life.
 * Each redirect hop is its own request, so the log holds the hops too.
 */
export function recordMainFrameNavigations(
  page: Pick<Page, "on" | "mainFrame">,
  max: number = MAX_MAIN_FRAME_NAVIGATIONS,
): () => NavigationLog {
  const seen = new Set<string>();
  const state = { overflow: false, total: 0 };
  page.on("request", (req) => {
    try {
      if (!req.isNavigationRequest() || req.frame() !== page.mainFrame()) return;
      state.total++;
      const u = req.url();
      if (seen.has(u)) return;
      if (seen.size >= max) state.overflow = true;
      else seen.add(u);
    } catch {
      // A navigation whose frame is gone cannot be attributed; count it so the page is refused.
      state.total++;
      state.overflow = true;
    }
  });
  return () => ({ urls: [...seen], overflow: state.overflow, total: state.total });
}

/** True when the landed URL and every recorded navigation pass `guard`; an overflowing log fails. */
export async function checkRecordedNavigations(
  landedUrl: string,
  log: Pick<NavigationLog, "urls" | "overflow">,
  guard: (url: string) => Promise<unknown>,
): Promise<boolean> {
  if (log.overflow) return false;
  return checkNavigationChain(landedUrl, log.urls, guard);
}

async function newContext(browser: Browser, mobile: boolean): Promise<BrowserContext> {
  const context = await browser.newContext({
    userAgent: mobile ? MOBILE_USER_AGENT : CRAWLER_USER_AGENT,
    viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 720 },
    acceptDownloads: false,
    bypassCSP: true,
    ignoreHTTPSErrors: true,
    locale: "en-US",
  });
  await context.route("**/*", async (route, request) => {
    // A route call after the context closed rejects; nothing is left to route then.
    try {
      const type = request.resourceType();
      // The capture keeps text and addresses; pictures, video and fonts only cost time and memory.
      if (type === "image" || type === "media" || type === "font") return await route.abort();
      if (!request.isNavigationRequest()) return await route.continue();
      try {
        await assertSafeFetchUrl(request.url());
      } catch {
        return await route.abort("blockedbyclient");
      }
      return await route.continue();
    } catch {
      // context closed mid-route
    }
  });
  return context;
}

function failure(url: string, error: OpenedPage["error"], status: number | null = null): OpenedPage {
  return { finalUrl: url, status, html: null, thirdPartyRequests: [], source: "browser", error };
}

async function openOnce(
  context: BrowserContext,
  url: string,
  timeoutMs: number,
  homeUrl: string,
  stepMs: number,
): Promise<OpenedPage> {
  const deadline = Date.now() + timeoutMs;
  const left = () => deadline - Date.now();
  let page: Page | null = null;
  try {
    const pending = context.newPage();
    const opened = await race(pending, stepMs);
    if (opened === DEADLINE) {
      // A page that turns up after we gave up is closed, not leaked.
      pending.then((late) => late.close().catch(() => {}), () => {});
      return failure(url, "nav_error");
    }
    page = opened;
    const requests = recordThirdPartyRequests(page, homeUrl);
    const navigations = recordMainFrameNavigations(page);
    // Leave ~5 s of the page budget for load, cookie banner, scroll and settle.
    const gotoTimeout = timeoutMs > 8_000 ? timeoutMs - 5_000 : timeoutMs;
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: gotoTimeout });
    // The route handler only saw the first URL; check where the navigation went before reading anything.
    const safe = await race(
      checkNavigationChain(page.url(), redirectChainUrls(res), assertSafeFetchUrl),
      Math.max(left(), 1_000),
    );
    if (safe === DEADLINE) return failure(url, "timeout");
    if (!safe) return failure(url, "unsafe_url");
    const status = res?.status() ?? null;
    if (status !== null && status >= 400) {
      return failure(page.url(), BLOCKED_STATUS.has(status) ? "blocked" : "http_error", status);
    }
    // Each settle step only runs while there is time left for it (a Playwright timeout of 0 means "none").
    if (left() > 500) await page.waitForLoadState("load", { timeout: Math.min(2_000, left() - 300) }).catch(() => {});
    if (left() > 1_200) {
      // Only a real <button> outside a form: a link or a submit styled as a button would navigate away.
      const cookieButton = page.getByRole("button", { name: COOKIE_BUTTON }).and(page.locator("button:not(form button)"));
      await cookieButton.first().click({ timeout: 700 }).catch(() => {});
    }
    if (left() > 2_500) await race(page.evaluate(SCROLL_SCRIPT), left() - 500).catch(() => {});
    if (left() > 900) await page.waitForTimeout(400);

    // The page may have navigated again while it settled (meta refresh, script, click): check it all again.
    const checkedUrl = page.url();
    const log = navigations();
    const stillSafe = await race(checkRecordedNavigations(checkedUrl, log, assertSafeFetchUrl), Math.max(left(), 1_000));
    if (stillSafe === DEADLINE) return failure(url, "timeout");
    if (!stillSafe) return failure(url, "unsafe_url");
    const content = await race(page.content(), Math.max(left(), 1_000));
    if (content === DEADLINE) return failure(url, "timeout");
    // Content from a navigation that started after the check is never returned.
    if (page.url() !== checkedUrl || navigations().total !== log.total) return failure(url, "unsafe_url");
    const html = content.slice(0, MAX_HTML_CHARS);
    return { finalUrl: checkedUrl, status, html, thirdPartyRequests: requests(), source: "browser", error: null };
  } catch (err) {
    const m = (err instanceof Error ? err.message : String(err)).toLowerCase();
    if (m.includes("timeout")) return failure(url, "timeout");
    // Chromium reports the route guard's abort as net::ERR_BLOCKED_BY_CLIENT.
    if (m.includes("blocked_by_client") || m.includes("blockedbyclient")) return failure(url, "unsafe_url");
    if (m.includes("closed")) return failure(url, "aborted");
    return failure(url, "nav_error");
  } finally {
    if (page) await settleWithin(page.close(), stepMs);
  }
}

async function openViaHttp(url: string, timeoutMs: number, signal?: AbortSignal): Promise<OpenedPage | null> {
  const attempt = async (): Promise<OpenedPage | null> => {
    const { response, finalUrl } = await safeFetchFollow(url, {
      perHopTimeoutMs: timeoutMs,
      init: { headers: { "user-agent": CRAWLER_USER_AGENT, accept: "text/html,application/xhtml+xml" } },
    });
    if (response.status >= 400 || !/html/i.test(response.headers.get("content-type") ?? "")) {
      await response.body?.cancel().catch(() => {});
      return null;
    }
    const html = await readCappedText(response, MAX_HTML_BYTES);
    return { finalUrl, status: response.status, html, thirdPartyRequests: [], source: "http", error: null };
  };
  try {
    // perHopTimeoutMs covers one hop's headers only; the whole fetch (hops + body) stays inside timeoutMs.
    const r = await race(attempt(), timeoutMs, signal);
    return r === DEADLINE ? null : r;
  } catch {
    return null;
  }
}

/** robots.txt and sitemaps: SSRF-safe, 8 s in total, 200 only. `null` when unavailable. */
export async function fetchTextSafe(url: string): Promise<string | null> {
  const attempt = async (): Promise<string | null> => {
    const { response } = await safeFetchFollow(url, {
      perHopTimeoutMs: TEXT_FILE_TIMEOUT_MS,
      init: { headers: { "user-agent": CRAWLER_USER_AGENT, accept: "text/plain,application/xml,text/xml,*/*" } },
    });
    if (response.status !== 200) {
      await response.body?.cancel().catch(() => {});
      return null;
    }
    return readCappedText(response, MAX_TEXT_FILE_BYTES);
  };
  try {
    const r = await race(attempt(), TEXT_FILE_TIMEOUT_MS);
    return r === DEADLINE ? null : r;
  } catch {
    return null;
  }
}

export async function createPlaywrightOpener(
  browser: Browser,
  homeUrl: string,
  signal?: AbortSignal,
  opts: { stepTimeoutMs?: number } = {},
): Promise<PageOpener> {
  const stepMs = opts.stepTimeoutMs ?? BROWSER_STEP_TIMEOUT_MS;
  const desktop = await newContext(browser, false);
  // A promise, so two pages blocked at the same time share one mobile context.
  let mobile: Promise<BrowserContext> | null = null;
  let closed = false;

  /** Returns within about two steps whatever the browser does. */
  const close = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    const closeMobile = async () => {
      if (!mobile) return;
      const m = await race(mobile, stepMs).catch(() => null);
      if (m && m !== DEADLINE) await settleWithin(m.close(), stepMs);
    };
    await Promise.all([settleWithin(desktop.close(), stepMs), closeMobile()]);
  };
  // Closing the contexts rejects every in-flight navigation: the work stops, not just the wait.
  signal?.addEventListener("abort", () => void close(), { once: true });
  if (signal?.aborted) await close();

  /** A page cut short by close() reports "aborted", whatever error Playwright surfaced. */
  const settle = (result: OpenedPage): OpenedPage => (closed && result.error ? { ...result, error: "aborted" } : result);

  return {
    async open(url, { timeoutMs }) {
      if (closed) return failure(url, "aborted");
      const started = Date.now();
      const left = () => timeoutMs - (Date.now() - started);
      let result = await openOnce(desktop, url, timeoutMs, homeUrl, stepMs);
      if (result.error !== "blocked" || closed) return settle(result);
      if (left() > 3_000) {
        try {
          mobile ??= newContext(browser, true);
          result = await openOnce(await mobile, url, left(), homeUrl, stepMs);
        } catch {
          // the mobile context could not be created; fall through to plain HTTP
        }
        if (result.error !== "blocked" || closed) return settle(result);
      }
      if (left() > 1_000) {
        const viaHttp = await openViaHttp(url, left(), signal);
        if (viaHttp && !closed) return viaHttp;
      }
      return settle(result);
    },
    close,
  };
}
