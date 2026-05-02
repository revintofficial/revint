/**
 * Bug L7 regression test - url-guard rejects URL credentials.
 *
 * `https://user:pass@host/` is a recurrent SSRF + credential-leak
 * shape. Pre-fix the guard accepted it and the URL flowed into:
 *   - Apify scrape inputs (Apify logs the input verbatim)
 *   - Lead.websiteUrl rows that later show up in copilot prompts
 *   - Referer headers when the crawler followed redirects
 *
 * Post-fix the guard rejects ANY URL with a username or password
 * field set, even if both are empty strings (the URL parser sometimes
 * still flags them depending on the input).
 */
import { describe, it, expect } from "vitest";
import { assertSafeFetchUrl, UrlGuardError } from "@/lib/url-guard";

describe("L7 - URL userinfo rejection", () => {
  const cases: Array<{ name: string; url: string }> = [
    { name: "user only", url: "https://attacker@93.184.216.34/" },
    { name: "user:pass", url: "https://user:pass@93.184.216.34/" },
    { name: "empty user with password", url: "https://:pass@93.184.216.34/" },
    {
      name: "percent-encoded user",
      url: "https://%75ser:pass@93.184.216.34/",
    },
    {
      name: "userinfo + port (classic confusion attack)",
      url: "https://attacker.example:8080@93.184.216.34/",
    },
  ];

  for (const c of cases) {
    it(`rejects ${c.name}: ${c.url}`, async () => {
      await expect(assertSafeFetchUrl(c.url)).rejects.toBeInstanceOf(
        UrlGuardError,
      );
    });
  }

  it("accepts the same host without credentials (sanity)", async () => {
    // The IP literal short-circuits the DNS lookup so this is hermetic.
    await expect(assertSafeFetchUrl("https://93.184.216.34/")).resolves.toBeInstanceOf(
      URL,
    );
  });

  it("returns a URL object whose username/password are empty after vetting", async () => {
    const u = await assertSafeFetchUrl("https://93.184.216.34/path?x=1");
    expect(u.username).toBe("");
    expect(u.password).toBe("");
  });
});
