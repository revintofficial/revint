/**
 * Round 2 §3.12 / §3.13 — opener-writer websiteContext + isChain
 * regression coverage (Sprint 1 lite).
 *
 * Pins down two narrow surfaces:
 *
 *   §3.12 NO_WEBSITE + social branch
 *     - When `lead.websiteUrl` points at an Instagram / Facebook /
 *       TikTok / LinkedIn page AND `lead.crawlStatus === "NO_WEBSITE"`,
 *       the prompt must include a "social page" rule and forbid
 *       "your site" / "your website" phrasing.
 *
 *   §3.13 isChain branch
 *     - When `salesOpportunity.reasonCodes` contains "chain_detected"
 *       AND the active niche pack carries `chainConsiderations`, the
 *       prompt must list the centralized modules as forbidden and
 *       prefer the chain-HQ enterprise modules instead.
 *
 *   `detectSocialPlatform` smoke
 *     - Recognises real IG / FB / TikTok / LinkedIn hostnames; returns
 *       null for null / empty / non-social URLs.
 *
 * The full opener-writer surface (memory hydration, mockup wiring,
 * etc.) is already covered by `opener-writer.test.ts`. This file
 * deliberately stays scoped to the new prompt branches.
 */
import { describe, expect, it } from "vitest";
import { detectSocialPlatform } from "@/lib/agent-workers/opener-writer";

describe("Round 2 §3.12 — detectSocialPlatform", () => {
  it("recognises canonical Instagram hostnames", () => {
    expect(detectSocialPlatform("https://www.instagram.com/coffeecouch/")).toBe(
      "instagram",
    );
    expect(detectSocialPlatform("https://instagram.com/yba_brazil")).toBe(
      "instagram",
    );
  });

  it("recognises Facebook (with fb.com alias)", () => {
    expect(detectSocialPlatform("https://www.facebook.com/oneshot")).toBe(
      "facebook",
    );
    expect(detectSocialPlatform("https://fb.com/oneshot")).toBe("facebook");
  });

  it("recognises TikTok and LinkedIn", () => {
    expect(detectSocialPlatform("https://www.tiktok.com/@cafe")).toBe("tiktok");
    expect(detectSocialPlatform("https://www.linkedin.com/company/cafe")).toBe(
      "linkedin",
    );
  });

  it("returns null for normal websites", () => {
    expect(detectSocialPlatform("https://www.example-cafe.com/")).toBe(null);
    expect(detectSocialPlatform("https://lumi-camden.co.uk")).toBe(null);
  });

  it("returns null for null / empty / unparseable URLs", () => {
    expect(detectSocialPlatform(null)).toBe(null);
    expect(detectSocialPlatform(undefined)).toBe(null);
    expect(detectSocialPlatform("")).toBe(null);
    expect(detectSocialPlatform("not-a-url")).toBe(null);
  });
});
