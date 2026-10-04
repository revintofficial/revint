// src/__tests__/lib/site-capture/classify.test.ts
import { describe, expect, it } from "vitest";
import { classifyUrl, isKnownVendorUrl } from "@/lib/site-capture/classify";
import { urlKey } from "@/lib/site-capture/url";

const HOME = new URL("https://www.example-bistro.co.uk/");
const c = (href: string, text: string | null = null) => classifyUrl(new URL(href, HOME), text, HOME);

describe("classifyUrl: page types", () => {
  it.each([
    ["/menu", null, "menu"],
    ["/our-menu/", null, "menu"],
    ["/x", "Menü", "menu"],
    ["/book-a-table", null, "reservation"],
    ["/x", "Reservations", "reservation"],
    ["/order-online", null, "order"],
    ["/faq", null, "faq"],
    ["/x", "Frequently asked questions", "faq"],
    ["/private-dining", null, "events"],
    ["/group-bookings", "Group bookings", "events"],
    ["/x", "Private hire", "events"],
    ["/locations", null, "locations"],
    ["/store-locator", null, "locations"],
    ["/x", "Şubelerimiz", "locations"],
    ["/contact-us", null, "contact"],
    ["/x", "İletişim", "contact"],
    ["/about", null, "about"],
    ["/our-suppliers", "Suppliers", "other"],
  ] as const)("%s (%s) -> %s", (href, text, type) => {
    expect(c(href, text)).toBe(type);
  });

  it("recognises the homepage with or without www and trailing slash", () => {
    expect(c("/")).toBe("home");
    expect(c("https://example-bistro.co.uk")).toBe("home");
  });

  it("types a booking or ordering subdomain of the venue's own domain", () => {
    expect(c("https://booking.example-bistro.co.uk/")).toBe("reservation");
    expect(c("https://order.example-bistro.co.uk/")).toBe("order");
  });
});

describe("classifyUrl: never a candidate", () => {
  it.each([
    "/privacy-policy",
    "/terms-and-conditions",
    "/cart",
    "/my-account",
    "/wp-admin/",
    "/blog/best-brunch-in-town",
    "/careers",
    "/gift-cards",
    "/images/hero.jpg",
    "/menu.pdf",
    "https://www.instagram.com/examplebistro",
    "https://deliveroo.co.uk/menu/london/example-bistro",
    "https://www.opentable.com/legal/privacy-policy",
  ])("%s", (href) => {
    expect(c(href)).toBeNull();
  });

  it("hard noise stays out even when the link text looks like a guest page", () => {
    expect(c("/terms", "Booking terms")).toBeNull();
    expect(c("/login", "Menu")).toBeNull();
  });
});

describe("classifyUrl: one hop off the site", () => {
  it("a known booking provider page is external", () => {
    expect(c("https://www.sevenrooms.com/reservations/examplebistro", "Book")).toBe("external");
    expect(isKnownVendorUrl(new URL("https://web.dojo.app/create_booking/vendor/abc"))).toBe(true);
  });
  it("a white-label ordering vendor page is external", () => {
    expect(c("https://examplebistro.orderswift.com/", "Click & collect")).toBe("external");
  });
});

describe("urlKey", () => {
  it("ignores scheme, www, fragment, trailing slash and tracking parameters", () => {
    const a = urlKey("http://www.example-bistro.co.uk/menu/?utm_source=ig#lunch");
    const b = urlKey("https://example-bistro.co.uk/menu");
    expect(a).toBe(b);
  });
  it("keeps meaningful query strings apart", () => {
    expect(urlKey("https://x.test/menu?id=1")).not.toBe(urlKey("https://x.test/menu?id=2"));
  });
  it("returns null for non-http addresses", () => {
    expect(urlKey("mailto:hi@x.test")).toBeNull();
    expect(urlKey("not a url")).toBeNull();
  });
});
