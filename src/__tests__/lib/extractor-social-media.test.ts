/**
 * Beta finding §1 — extractor + crawler social-media gate regression.
 *
 * Three guarantees this test pins down:
 *
 *   1. `detectSocialMediaPlatform` recognises the major social hosts
 *      (instagram, facebook, tiktok, linkedin, twitter, x, youtube)
 *      and returns null for normal restaurant websites.
 *
 *   2. The keyword detector uses word-boundaries — "Facebook" in body
 *      copy must NOT match the "book" booking keyword. This was the
 *      single largest false-positive driver in the FineDine beta:
 *      cafés with a Facebook footer link were flagged as having a
 *      booking system.
 *
 *   3. `hasBookingSystem` only fires when the multi-signal threshold
 *      is met (recognised provider OR JSON-LD reservation + a CTA
 *      link with a booking keyword). A bare body-text mention of the
 *      word "reservation" alone is no longer enough.
 *
 *   Note: the extractor uses Cheerio + Playwright fixtures inside
 *   `crawlWebsite`. We exercise the smaller `extractFeatures(html)`
 *   surface here (pure DOM parse) so the test stays unit-scoped and
 *   deterministic.
 */
import { describe, expect, it } from "vitest";
import { detectSocialMediaPlatform, isSocialMediaUrl } from "@/lib/audit/social-url-gate";
import { extractFeatures } from "@/lib/extractor";

describe("Beta §1 — social-media URL gate", () => {
  it("flags major social hosts", () => {
    expect(detectSocialMediaPlatform("https://www.instagram.com/black_eye_cafe")).toBe(
      "Instagram",
    );
    expect(detectSocialMediaPlatform("https://www.facebook.com/blackheath.bistro")).toBe(
      "Facebook",
    );
    expect(detectSocialMediaPlatform("https://www.tiktok.com/@brewedlondon")).toBe("TikTok");
    expect(detectSocialMediaPlatform("https://www.linkedin.com/company/finedine")).toBe(
      "LinkedIn",
    );
    expect(detectSocialMediaPlatform("https://twitter.com/foo")).toBe("Twitter/X");
    expect(detectSocialMediaPlatform("https://x.com/foo")).toBe("Twitter/X");
    expect(detectSocialMediaPlatform("https://www.youtube.com/@finedine")).toBe("YouTube");
  });

  it("returns null for normal restaurant domains", () => {
    expect(detectSocialMediaPlatform("https://www.piedaterre.co.uk")).toBeNull();
    expect(detectSocialMediaPlatform("https://example.com/menu")).toBeNull();
    expect(detectSocialMediaPlatform("not a url")).toBeNull();
  });

  it("isSocialMediaUrl is the boolean wrapper", () => {
    expect(isSocialMediaUrl("https://www.instagram.com/foo")).toBe(true);
    expect(isSocialMediaUrl("https://example.com")).toBe(false);
  });
});

describe("Beta §1 — extractor word-boundary keyword matching", () => {
  it("does NOT trigger hasBookingSystem from a 'Facebook' body mention", () => {
    // Black Eye / Brewed beta lead reproducer: footer says
    // "Follow us on Facebook" with no booking system anywhere.
    const html = `
      <html><head><title>Black Eye Coffee</title></head>
        <body>
          <h1>Welcome to Black Eye Coffee</h1>
          <p>We are open daily. Come for the coffee, stay for the cake.</p>
          <footer>
            <a href="https://www.facebook.com/blackeyecoffee">Follow us on Facebook</a>
          </footer>
        </body>
      </html>`;
    const features = extractFeatures(html, "https://blackeyecoffee.example");
    expect(features.hasBookingSystem).toBe(false);
    expect(features.bookingProvider ?? null).toBeNull();
  });

  it("does NOT trigger hasBookingSystem from a 'reserve a table' body mention alone", () => {
    const html = `
      <html><body>
        <h1>Pied a Terre</h1>
        <p>Reserve a table by calling us — see you soon.</p>
      </body></html>`;
    const features = extractFeatures(html, "https://pied.example");
    // Booking might be inferred via keyword-token, but the multi-signal
    // requirement (provider OR JSON-LD + CTA) should keep this false.
    expect(features.hasBookingSystem).toBe(false);
    expect(features.hasEcommerce).toBe(false);
  });

  it("DOES trigger hasBookingSystem when an OpenTable widget is embedded", () => {
    // Provider fingerprint short-circuits the multi-signal threshold.
    const html = `
      <html><body>
        <h1>The Bistro</h1>
        <iframe src="https://www.opentable.com/widget/reservation/loader?rid=123"></iframe>
      </body></html>`;
    const features = extractFeatures(html, "https://thebistro.example");
    expect(features.hasBookingSystem).toBe(true);
    expect(features.bookingProvider).toBe("OpenTable");
  });

  it("DOES trigger hasBookingSystem when JSON-LD ReserveAction + a 'Booking' CTA link are both present", () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Restaurant",
              "potentialAction": {
                "@type": "ReserveAction",
                "target": "https://example.com/reserve"
              }
            }
          </script>
        </head>
        <body>
          <h1>Test Restaurant</h1>
          <a href="/reserve">Booking</a>
        </body>
      </html>`;
    const features = extractFeatures(html, "https://test-restaurant.example");
    expect(features.hasBookingSystem).toBe(true);
  });
});
