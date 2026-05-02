/**
 * Bug C3 regression test - SSRF via redirect chain.
 *
 * Pre-fix the `/api/website-check` and `/api/website-search` routes
 * called `fetch(url, { redirect: "follow" })`. assertSafeFetchUrl
 * vetted only the FIRST URL; the runtime then walked any 30x chain
 * the server gave it, including hops to private addresses. So a
 * public URL that 302s to http://169.254.169.254/ slipped through
 * and the response body ended up in the user's verdict.
 *
 * Post-fix: both routes go through `safeFetchFollow` which:
 *   - validates the initial URL with assertSafeFetchUrl,
 *   - fetches with redirect:"manual",
 *   - re-validates each Location header,
 *   - caps the chain at maxRedirects (default 5),
 *   - throws UrlGuardError on any blocked hop.
 *
 * These are the underlying-helper tests; the route-level integration
 * tests live alongside the route files (Sprint 1 follow-up).
 */
import { describe, it, expect, afterEach } from "vitest";
import { mockFetchChain } from "../_helpers/mock-fetch";
import { safeFetchFollow, UrlGuardError } from "@/lib/safe-fetch";

// We use public IP literals for "innocent" endpoints in this file
// because url-guard.ts intentionally does a real DNS lookup for any
// non-IP hostname to defeat DNS-rebinding attacks. Mocking
// node:dns/promises across module-load boundaries is brittle in
// vitest, so we sidestep DNS entirely:
//
//   PUBLIC_A = 93.184.216.34   (example.com's real IP, public)
//   PUBLIC_B = 1.1.1.1          (Cloudflare, public)
//   PUBLIC_C = 8.8.8.8          (Google, public)
//   PUBLIC_D = 9.9.9.9          (Quad9, public)
//   PUBLIC_E = 208.67.222.222   (OpenDNS, public)
//   PUBLIC_F = 199.232.0.1      (Fastly, public)
//   PUBLIC_G = 151.101.1.1      (Fastly, public)
//
// All of these pass isPrivateIPv4 / isPrivateIPv6 checks. The fetch
// itself is mocked so we never make real network calls.
const PUBLIC_A = "http://93.184.216.34/";
const PUBLIC_B = "http://1.1.1.1/welcome";
const CHAIN_HOSTS = [
  "http://1.1.1.1/",
  "http://8.8.8.8/",
  "http://9.9.9.9/",
  "http://208.67.222.222/",
  "http://199.232.0.1/",
  "http://151.101.1.1/",
  "http://93.184.216.34/end",
];

let restore: (() => void) | null = null;

afterEach(() => {
  restore?.();
  restore = null;
});

describe("C3 - safeFetchFollow redirect-chain SSRF guard", () => {
  it("returns the response when no redirect happens", async () => {
    restore = mockFetchChain([
      {
        url: PUBLIC_A,
        status: 200,
        body: "<html>hi</html>",
        headers: { "content-type": "text/html" },
      },
    ]);
    const { response, finalUrl, redirectCount } = await safeFetchFollow(PUBLIC_A);
    expect(response.status).toBe(200);
    expect(finalUrl).toBe(PUBLIC_A);
    expect(redirectCount).toBe(0);
    expect(await response.text()).toBe("<html>hi</html>");
  });

  it("follows a benign public-to-public redirect", async () => {
    restore = mockFetchChain([
      {
        url: PUBLIC_A,
        status: 302,
        headers: { location: PUBLIC_B },
      },
      {
        url: PUBLIC_B,
        status: 200,
        body: "ok",
      },
    ]);
    const { response, finalUrl, redirectCount } = await safeFetchFollow(PUBLIC_A);
    expect(response.status).toBe(200);
    expect(finalUrl).toBe(PUBLIC_B);
    expect(redirectCount).toBe(1);
  });

  it("rejects an initial URL pointing to a private address (no fetch)", async () => {
    restore = mockFetchChain([], { fallbackThrows: true });
    await expect(
      safeFetchFollow("http://169.254.169.254/"),
    ).rejects.toBeInstanceOf(UrlGuardError);
  });

  it("rejects a redirect to GCP/AWS metadata (the C3 attack)", async () => {
    restore = mockFetchChain([
      {
        url: PUBLIC_A,
        status: 302,
        headers: { location: "http://169.254.169.254/computeMetadata/v1/" },
      },
      // The second hop should NEVER be reached. If it is, this stub
      // throws and the test fails for the wrong reason - making the
      // signal extra clear.
      {
        url: "http://169.254.169.254/computeMetadata/v1/",
        throws: new Error("c3-test: second hop must not be performed"),
      },
    ]);
    await expect(safeFetchFollow(PUBLIC_A)).rejects.toBeInstanceOf(UrlGuardError);
  });

  it("rejects a redirect to localhost", async () => {
    restore = mockFetchChain([
      {
        url: PUBLIC_A,
        status: 301,
        headers: { location: "http://127.0.0.1:5432/" },
      },
    ]);
    await expect(safeFetchFollow(PUBLIC_A)).rejects.toBeInstanceOf(UrlGuardError);
  });

  it("rejects a redirect to RFC1918", async () => {
    restore = mockFetchChain([
      {
        url: PUBLIC_A,
        status: 307,
        headers: { location: "http://10.0.0.5/admin" },
      },
    ]);
    await expect(safeFetchFollow(PUBLIC_A)).rejects.toBeInstanceOf(UrlGuardError);
  });

  it("rejects protocol-relative redirect that resolves to a private address", async () => {
    // The Location header is protocol-relative (`//169.254.169.254/`).
    // `new URL(loc, prev)` resolves it against the previous absolute,
    // inheriting prev's protocol. The result must still go through
    // the SSRF guard.
    restore = mockFetchChain([
      {
        url: PUBLIC_A,
        status: 302,
        headers: { location: "//169.254.169.254/" },
      },
    ]);
    await expect(safeFetchFollow(PUBLIC_A)).rejects.toBeInstanceOf(UrlGuardError);
  });

  it("caps redirect depth at maxRedirects", async () => {
    // Build a chain longer than the cap (default 5). Hop 6 would
    // succeed but the loop must reject before fetching it.
    restore = mockFetchChain([
      { url: CHAIN_HOSTS[0], status: 302, headers: { location: CHAIN_HOSTS[1] } },
      { url: CHAIN_HOSTS[1], status: 302, headers: { location: CHAIN_HOSTS[2] } },
      { url: CHAIN_HOSTS[2], status: 302, headers: { location: CHAIN_HOSTS[3] } },
      { url: CHAIN_HOSTS[3], status: 302, headers: { location: CHAIN_HOSTS[4] } },
      { url: CHAIN_HOSTS[4], status: 302, headers: { location: CHAIN_HOSTS[5] } },
      { url: CHAIN_HOSTS[5], status: 302, headers: { location: CHAIN_HOSTS[6] } },
      { url: CHAIN_HOSTS[6], status: 200, body: "should-not-reach" },
    ]);
    await expect(safeFetchFollow(CHAIN_HOSTS[0])).rejects.toBeInstanceOf(UrlGuardError);
  });

  it("treats a 30x without Location header as terminal (does not loop)", async () => {
    restore = mockFetchChain([
      {
        url: PUBLIC_A,
        status: 304,
      },
    ]);
    const { response, redirectCount } = await safeFetchFollow(PUBLIC_A);
    expect(response.status).toBe(304);
    expect(redirectCount).toBe(0);
  });
});
