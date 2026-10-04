// src/lib/site-capture/opener.ts
/**
 * Opens pages for the capture in one browser context per site. Every
 * navigation goes through the SSRF guard. A page that answers 401 / 403 /
 * 429 is retried with a mobile identity, then with a plain HTTP fetch;
 * after that it is "blocked" (no proxy).
 *
 * Contract the capture loop relies on (it does not wrap these itself):
 * - `open(url, { timeoutMs })` returns within roughly `timeoutMs`: the
 *   navigation gets the bulk of it and every later step is skipped or cut
 *   to what is left; the HTTP fallback runs under the same deadline.
 * - After the abort signal fires, in-flight and later `open` calls end
 *   promptly: closing the contexts rejects every pending Playwright call.
 * - Navigations (top frame, sub-frames, every redirect hop) pass
 *   `assertSafeFetchUrl` in the context's route handler; HTTP fetches go
 *   through `safeFetchFollow`, which checks every hop.
 */
import type { Browser, BrowserContext, Page } from "playwright";
import { CRAWLER_USER_AGENT } from "@/lib/crawler";
import { safeFetchFollow } from "@/lib/safe-fetch";
import { assertSafeFetchUrl } from "@/lib/url-guard";
import { recordThirdPartyRequests } from "./requests";
import type { OpenedPage, PageOpener } from "./types";

const MOBILE_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const MAX_HTML_CHARS = 1_500_000;
const MAX_TEXT_FILE_CHARS = 2_000_000;
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

async function openOnce(context: BrowserContext, url: string, timeoutMs: number, homeUrl: string): Promise<OpenedPage> {
  const deadline = Date.now() + timeoutMs;
  const left = () => deadline - Date.now();
  let page: Page | null = null;
  try {
    page = await context.newPage();
    const requests = recordThirdPartyRequests(page, homeUrl);
    // Leave ~5 s of the page budget for load, cookie banner, scroll and settle.
    const gotoTimeout = timeoutMs > 8_000 ? timeoutMs - 5_000 : timeoutMs;
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: gotoTimeout });
    const status = res?.status() ?? null;
    if (status !== null && status >= 400) {
      return failure(page.url(), BLOCKED_STATUS.has(status) ? "blocked" : "http_error", status);
    }
    // Each settle step only runs while there is time left for it (a Playwright timeout of 0 means "none").
    if (left() > 500) await page.waitForLoadState("load", { timeout: Math.min(2_000, left() - 300) }).catch(() => {});
    if (left() > 1_200) {
      await page.getByRole("button", { name: COOKIE_BUTTON }).first().click({ timeout: 700 }).catch(() => {});
    }
    if (left() > 2_500) await race(page.evaluate(SCROLL_SCRIPT), left() - 500).catch(() => {});
    if (left() > 900) await page.waitForTimeout(400);
    const content = await race(page.content(), Math.max(left(), 1_000));
    if (content === DEADLINE) return failure(url, "timeout");
    const html = content.slice(0, MAX_HTML_CHARS);
    return { finalUrl: page.url(), status, html, thirdPartyRequests: requests(), source: "browser", error: null };
  } catch (err) {
    const m = (err instanceof Error ? err.message : String(err)).toLowerCase();
    if (m.includes("timeout")) return failure(url, "timeout");
    // Chromium reports the route guard's abort as net::ERR_BLOCKED_BY_CLIENT.
    if (m.includes("blocked_by_client") || m.includes("blockedbyclient")) return failure(url, "unsafe_url");
    if (m.includes("closed")) return failure(url, "aborted");
    return failure(url, "nav_error");
  } finally {
    if (page) await page.close().catch(() => {});
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
    const html = (await response.text()).slice(0, MAX_HTML_CHARS);
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
    return (await response.text()).slice(0, MAX_TEXT_FILE_CHARS);
  };
  try {
    const r = await race(attempt(), TEXT_FILE_TIMEOUT_MS);
    return r === DEADLINE ? null : r;
  } catch {
    return null;
  }
}

export async function createPlaywrightOpener(browser: Browser, homeUrl: string, signal?: AbortSignal): Promise<PageOpener> {
  const desktop = await newContext(browser, false);
  // A promise, so two pages blocked at the same time share one mobile context.
  let mobile: Promise<BrowserContext> | null = null;
  let closed = false;

  const close = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    await desktop.close().catch(() => {});
    if (mobile) {
      const m = await mobile.catch(() => null);
      await m?.close().catch(() => {});
    }
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
      let result = await openOnce(desktop, url, timeoutMs, homeUrl);
      if (result.error !== "blocked" || closed) return settle(result);
      if (left() > 3_000) {
        try {
          mobile ??= newContext(browser, true);
          result = await openOnce(await mobile, url, left(), homeUrl);
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
