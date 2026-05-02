/**
 * SSRF-safe fetch with manual redirect handling.
 *
 * The default `fetch(url, { redirect: "follow" })` happily walks any
 * redirect chain, including 30x hops to private addresses. Pre-fix
 * the website-check / website-search routes only validated the
 * initial URL with `assertSafeFetchUrl`, so a public site that 302s
 * to http://169.254.169.254/ slipped through and exposed cloud
 * metadata endpoints to authenticated users.
 *
 * `safeFetchFollow` reproduces the redirect-follow semantics the
 * routes expect, but re-validates EVERY hop's URL with the same SSRF
 * policy. It also caps the chain depth at MAX_REDIRECTS to avoid
 * infinite loops, and treats a missing Location header on a 3xx
 * response as the terminal response (browsers do the same).
 *
 * Returns the final Response and the resolved final URL string.
 * Throws `UrlGuardError` (re-exported from url-guard) when any hop is
 * rejected, or `Error` for transport / depth-cap failures.
 */
import { assertSafeFetchUrl, UrlGuardError } from "./url-guard";

export { UrlGuardError };

export interface SafeFetchOptions {
  /** Standard fetch init. `redirect` is forced to "manual" internally. */
  init?: Omit<RequestInit, "redirect">;
  /** Defaults to 5. Browsers cap at ~20 but the SSRF threat model is "1 hop to internal" so 5 is plenty. */
  maxRedirects?: number;
  /** Defaults to 15_000ms. Applies per-hop, not to the chain total. */
  perHopTimeoutMs?: number;
}

export interface SafeFetchResult {
  response: Response;
  /** Final URL after every redirect was resolved. */
  finalUrl: string;
  /** Number of redirects followed. 0 = no redirect. */
  redirectCount: number;
}

const DEFAULT_MAX_REDIRECTS = 5;
const DEFAULT_PER_HOP_TIMEOUT_MS = 15_000;

/**
 * Safer fetch that follows redirects manually, validating each hop.
 *
 * - Initial URL goes through assertSafeFetchUrl.
 * - Each 30x Location header is resolved against the previous URL,
 *   re-validated, and re-fetched.
 * - Loops cap at maxRedirects (default 5).
 *
 * Caller is responsible for response.text() / response.body etc.
 */
export async function safeFetchFollow(
  rawUrl: string,
  opts: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const maxRedirects = opts.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const perHopTimeout = opts.perHopTimeoutMs ?? DEFAULT_PER_HOP_TIMEOUT_MS;
  const baseInit: RequestInit = {
    ...(opts.init ?? {}),
    redirect: "manual",
  };

  let currentUrl = (await assertSafeFetchUrl(rawUrl)).toString();
  let redirectCount = 0;

  while (true) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), perHopTimeout);
    let response: Response;
    try {
      response = await fetch(currentUrl, {
        ...baseInit,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    // Anything outside 300-399 is terminal. Note: 304 has no Location
    // and is not a redirect either, but we exclude it explicitly so
    // the loop doesn't trip on it.
    if (response.status < 300 || response.status >= 400 || response.status === 304) {
      return { response, finalUrl: currentUrl, redirectCount };
    }

    const location = response.headers.get("location");
    if (!location) {
      // Browsers treat a 30x without Location as terminal too.
      return { response, finalUrl: currentUrl, redirectCount };
    }

    if (redirectCount >= maxRedirects) {
      throw new UrlGuardError(
        `Too many redirects (cap ${maxRedirects} reached at ${currentUrl})`,
      );
    }

    // Resolve relative redirect URLs against the previous absolute.
    let nextUrl: URL;
    try {
      nextUrl = new URL(location, currentUrl);
    } catch {
      throw new UrlGuardError(
        `Redirect Location header is not a valid URL: ${location}`,
      );
    }

    // Re-validate the next hop. Throws UrlGuardError if it points
    // anywhere private; the route caller catches it and returns a
    // 400 to the user (or a "blocked" envelope for the website
    // check route which always responds 200 with a verdict).
    await assertSafeFetchUrl(nextUrl.toString());
    currentUrl = nextUrl.toString();
    redirectCount++;
  }
}
