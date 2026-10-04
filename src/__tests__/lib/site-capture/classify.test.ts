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

  it.each([
    "https://careers.example-bistro.co.uk/",
    "https://careers.example-bistro.co.uk/chef-de-partie",
    "https://shop.example-bistro.co.uk/gift-cards",
    "https://blog.example-bistro.co.uk/menu-launch",
    "https://shop.example-bistro.co.uk/",
    "https://jobs.example-bistro.co.uk/menu",
  ])("a noise subdomain of the venue's own domain: %s", (href) => {
    expect(c(href)).toBeNull();
  });

  it("keeps the booking and ordering subdomain rules", () => {
    expect(c("https://booking.example-bistro.co.uk/")).toBe("reservation");
    expect(c("https://order.example-bistro.co.uk/")).toBe("order");
    expect(c("https://delivery.example-bistro.co.uk/")).toBe("order");
  });
});

// Final fix C3: shop / blog sections and "books" are not guest pages.
describe("classifyUrl: shop and blog sections, books", () => {
  it.each([
    ["/store/collections/books-and-music/", null],
    ["/store/books-recommended-reads/", "Recommended reads"],
    ["/store/products/dishoom-cookery-book/hardback", "Dishoom cookery book"],
    ["/shop/menu-gift", "Menu"],
    ["/news/christmas-party", null],
    ["/blog/book-a-table-tips", "Book a table"],
  ])("a URL whose first segment is a shop or blog section is never a candidate: %s", (href, text) => {
    expect(c(href, text)).toBeNull();
  });

  it.each([
    ["/books", "Books"],
    ["/bookshop", null],
    ["/bookstore", null],
    ["/x", "Our book"],
    ["/x", "Cookbook"],
  ])("books are not a booking: %s (%s)", (href, text) => {
    expect(c(href, text)).not.toBe("reservation");
  });

  it.each(["/book", "/bookings", "/booking", "/book-a-table"])("%s is still a booking page", (href) => {
    expect(c(href)).toBe("reservation");
  });

  it("the store locator is not the segment 'store'", () => {
    expect(c("/store-locator")).toBe("locations");
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
