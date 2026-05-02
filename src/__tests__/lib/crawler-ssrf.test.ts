/**
 * Bug C2 regression test - crawler SSRF guard.
 *
 * Pre-fix `crawlWebsite(url)` handed any caller-supplied URL straight
 * to Playwright's page.goto, which would cheerfully open
 * http://169.254.169.254/, http://localhost:5432, or any RFC1918
 * address. Combined with the lead-website ingestion path that
 * accepts arbitrary URLs from operator input, this was a
 * server-side request forgery hole.
 *
 * Post-fix: `crawlWebsite` calls `assertSafeFetchUrl(url)` BEFORE
 * spinning up a Playwright page, so the SSRF guard short-circuits
 * with a `BLOCKED_BY_GUARD` result and never even launches the
 * browser. Redirect hops are then re-validated by a `page.route()`
 * interceptor inside `crawlOnce` (covered separately by integration
 * tests because that path needs a real Playwright instance).
 *
 * This unit test asserts the cheap entry-point guard. The deeper
 * Playwright route-interceptor behaviour is covered in the manual
 * smoke checklist (Sprint 1 deploy gate).
 */
import { describe, it, expect, vi, afterEach } from "vitest";

// Stub Playwright so the SSRF rejections cannot accidentally launch a
// real chromium on the developer's machine (and so failures are loud
// if the guard is ever bypassed). vi.hoisted is required because
// vi.mock factories are hoisted above imports.
const { launchMock } = vi.hoisted(() => ({
  launchMock: vi.fn(async () => ({
    isConnected: () => true,
    newPage: vi.fn(async () => {
      throw new Error(
        "ssrf-test: Playwright should never be opened for blocked URLs",
      );
    }),
    close: vi.fn(),
  })),
}));

vi.mock("playwright", () => ({
  chromium: { launch: launchMock },
}));

import { crawlWebsite } from "@/lib/crawler";

afterEach(() => {
  vi.clearAllMocks();
});

describe("C2 - crawlWebsite SSRF entry guard", () => {
  const blocked: Array<{ name: string; url: string }> = [
    { name: "GCE/AWS metadata IPv4 literal", url: "http://169.254.169.254/" },
    { name: "Loopback IPv4 literal", url: "http://127.0.0.1:8080" },
    { name: "RFC1918 10.x", url: "http://10.0.0.1" },
    { name: "RFC1918 192.168.x", url: "http://192.168.1.1" },
    { name: "Localhost hostname", url: "http://localhost:5432" },
    { name: "GCP metadata hostname", url: "http://metadata.google.internal/" },
    { name: "Loopback IPv6", url: "http://[::1]/" },
    { name: ".internal TLD", url: "https://services.internal/" },
    { name: "Unsupported protocol (file)", url: "file:///etc/passwd" },
    { name: "Unsupported protocol (gopher)", url: "gopher://internal/" },
  ];

  for (const c of blocked) {
    it(`rejects ${c.name} (${c.url}) without launching Playwright`, async () => {
      const res = await crawlWebsite(c.url);
      expect(res.reachable).toBe(false);
      expect(res.crawlError).toBe("BLOCKED_BY_GUARD");
      expect(launchMock).not.toHaveBeenCalled();
      // The URL we asked for is preserved in the result so the UI
      // can show the user what was rejected.
      expect(res.url).toBe(c.url);
    });
  }

  it("rejects an invalid URL without launching Playwright", async () => {
    const res = await crawlWebsite("not a url at all");
    expect(res.reachable).toBe(false);
    expect(res.crawlError).toBe("BLOCKED_BY_GUARD");
    expect(launchMock).not.toHaveBeenCalled();
  });
});
