/**
 * Round 2 §3.4 + §3.5 — extractor regression coverage.
 *
 * Pins down two false-positive classes the FineDine Camden tester
 * caught in Round 2:
 *
 *   §3.5 QR_MENU split
 *     - Glass / Camden Roastery / Black Sheep all flipped to
 *       `detectedMenuTool="E-Menu"` because their pages contained
 *       "e-menu" in editorial body copy or in unrelated widget URLs.
 *       The fix removes "e-menu" / "emenu" entirely and splits the
 *       remaining vendors into LONG (fullHtml `includes`) and SHORT
 *       (hostname-only) lists.
 *
 *   §3.4 hasOnlineReservation symmetry
 *     - LUMI Camden's press section quoted a Resy review; the old
 *       extractor treated that body-text mention as a positive
 *       reservation signal. The fix now requires either a recognised
 *       provider hostname inside an `<a href>`, or the
 *       `bookingProvider !== null` / JSON-LD + CTA path used by
 *       `hasBookingSystemFinal`.
 *
 * The extractor uses Cheerio over already-fetched HTML, so we exercise
 * the pure `extractFeatures(html)` surface here.
 */
import { describe, expect, it } from "vitest";
import { extractFeatures } from "@/lib/extractor";

const PAGE_URL = "https://example-cafe.test/";

describe("Round 2 §3.5 — QR menu detection", () => {
  it("flags FineDine when the long pattern appears in the HTML", () => {
    const html = `
      <html><body>
        <a href="https://restaurant.finedinemenu.com/123">View menu</a>
      </body></html>`;
    const f = extractFeatures(html, PAGE_URL);
    expect(f.hasQrMenu).toBe(true);
    expect(f.detectedMenuTool).toBe("FineDine");
  });

  it("does NOT flag E-Menu when 'e-menu' appears as body copy", () => {
    // Glass / Camden Roastery / Black Sheep regression
    const html = `
      <html><body>
        <p>Our new e-menu is launching soon — stay tuned!</p>
      </body></html>`;
    const f = extractFeatures(html, PAGE_URL);
    expect(f.hasQrMenu).toBe(false);
    expect(f.detectedMenuTool).toBe(null);
  });

  it("does NOT flag E-Menu when 'emenu' substring appears in unrelated copy", () => {
    const html = `
      <html><body>
        <p>The supplemental menu, also known as the menu, is coming back.</p>
        <p>Visit our themenu page for details.</p>
      </body></html>`;
    const f = extractFeatures(html, PAGE_URL);
    expect(f.hasQrMenu).toBe(false);
  });

  it("flags PlumQR only when it appears inside an actual link hostname", () => {
    // SHORT pattern — body text alone must NOT trigger.
    const bodyOnly = `
      <html><body><p>plumqr is great</p></body></html>`;
    expect(extractFeatures(bodyOnly, PAGE_URL).hasQrMenu).toBe(false);

    const linkHtml = `
      <html><body>
        <a href="https://venue.plumqr.com/x">Menu</a>
      </body></html>`;
    const f = extractFeatures(linkHtml, PAGE_URL);
    expect(f.hasQrMenu).toBe(true);
    expect(f.detectedMenuTool).toBe("PlumQR");
  });

  it("flags QR Menu via Yoello when it appears inside a link hostname", () => {
    const html = `
      <html><body>
        <a href="https://venue.yoello.com/order">Order online</a>
      </body></html>`;
    const f = extractFeatures(html, PAGE_URL);
    expect(f.hasQrMenu).toBe(true);
    expect(f.detectedMenuTool).toBe("Yoello");
  });
});

describe("Round 2 §3.4 — hasOnlineReservation multi-signal", () => {
  it("does NOT fire on a body-text mention of OpenTable", () => {
    // LUMI Camden regression
    const html = `
      <html><body>
        <p>Critics have called us "the best new spot in Camden" (OpenTable review).</p>
      </body></html>`;
    const f = extractFeatures(html, PAGE_URL);
    expect(f.hasOnlineReservation).toBe(false);
  });

  it("fires when an OpenTable hostname appears in an actual link", () => {
    const html = `
      <html><body>
        <a href="https://www.opentable.com/r/lumi-camden">Book a table</a>
      </body></html>`;
    const f = extractFeatures(html, PAGE_URL);
    expect(f.hasOnlineReservation).toBe(true);
  });

  it("fires when a Yelp reservations path appears in an actual link", () => {
    const html = `
      <html><body>
        <a href="https://www.yelp.com/reservations/lumi-camden">Reserve</a>
      </body></html>`;
    const f = extractFeatures(html, PAGE_URL);
    expect(f.hasOnlineReservation).toBe(true);
  });

  it("fires via JSON-LD reservation marker + booking CTA (Path B)", () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
          { "@context":"https://schema.org", "@type":"FoodEstablishment",
            "potentialAction": {
              "@type": "ReserveAction",
              "target": "https://example-cafe.test/reserve"
            } }
        </script>
      </head><body>
        <a href="/reserve">Book a table</a>
      </body></html>`;
    const f = extractFeatures(html, PAGE_URL);
    expect(f.hasOnlineReservation).toBe(true);
  });

  it("does NOT fire on JSON-LD alone without a booking CTA", () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
          { "@context":"https://schema.org", "@type":"FoodEstablishment",
            "potentialAction": {
              "@type": "ReserveAction",
              "target": "https://example-cafe.test/reserve"
            } }
        </script>
      </head><body>
        <p>Welcome to our restaurant.</p>
      </body></html>`;
    const f = extractFeatures(html, PAGE_URL);
    expect(f.hasOnlineReservation).toBe(false);
  });
});
