// src/__tests__/lib/site-facts-real-sites.test.ts
/**
 * Website-audit eval (2026-10): every fingerprint and heuristic added to
 * site-facts / booking-detection / site-signals is pinned on markup cut
 * from the real lead site where the old extractor was wrong or blind.
 * Fixtures: src/__tests__/fixtures/sites/*.html (trimmed, no secrets).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { detectBookingProvider } from "@/lib/audit/booking-detection";
import { extractFeatures } from "@/lib/extractor";
import { mergeSiteFacts, pickSubpages, type VisitedPage } from "@/lib/site-facts";
import { detectHotelOperator, detectLanguageCount, detectLocations, visibleText } from "@/lib/site-signals";

function fixture(name: string): { url: string; html: string } {
  const html = readFileSync(path.join(__dirname, "../fixtures/sites", name), "utf8");
  const url = /Trimmed from (\S+)/.exec(html)?.[1] ?? "https://example.test/";
  return { url, html };
}
function homeFacts(name: string, pages: VisitedPage[] = []) {
  const home = fixture(name);
  return mergeSiteFacts(home, pages, pickSubpages(home.html, home.url));
}

describe("booking providers seen on lead sites", () => {
  it("names Dojo from Padella's 'BOOK A TABLE' link", () => {
    const f = homeFacts("padella-soho.html");
    expect(f.bookingProvider).toMatchObject({ value: "Dojo", url: "https://www.padella.co/soho/" });
    expect(f.bookingProvider!.quote).toContain("web.dojo.app/create_booking");
    expect(f.bookingChecked).toBe(true);
  });

  it("names SevenRooms on Mildreds and ignores BentoBox's Resy preconnect", () => {
    const { html, url } = fixture("mildreds-camden.html");
    expect(html).toContain('rel="preconnect" href="https://widgets.resy.com"');
    expect(extractFeatures(html, url).bookingProvider).toBe("SevenRooms");
  });

  it("names Quandoo on Blue House and does not take the hotel's room engine for a table provider", () => {
    const f = homeFacts("bluehouse-istanbul.html");
    expect(f.bookingProvider).toMatchObject({ value: "Quandoo" });
    expect(f.bookingProvider!.quote).toContain("quandoo.co.uk/place/56634/widget");
  });

  it("names SevenRooms on GALLADA's /reservations/<venue> link", () => {
    expect(homeFacts("gallada-istanbul.html").bookingProvider).toMatchObject({ value: "SevenRooms" });
  });

  it("names ResDiary from the 15grams booking page widget, not Square from a gift-card link", () => {
    const home = fixture("15grams-home.html");
    expect(extractFeatures(home.html, home.url).bookingProvider).toBeNull();
    const book = fixture("15grams-book-table.html");
    const f = mergeSiteFacts(home, [{ kind: "reservation", url: book.url, html: book.html }], pickSubpages(home.html, home.url));
    expect(f.bookingProvider).toMatchObject({ value: "ResDiary", url: book.url });
  });

  it("names OpenTable on Bill's booking page from the widget's own terms links", () => {
    const { html, url } = fixture("bills-bookatable.html");
    expect(extractFeatures(html, url).bookingProvider).toBe("OpenTable");
  });

  it("matches provider hosts, not substrings of other hosts or slugs", () => {
    const links = [{ href: "https://purezza.co.uk/purezza-camden-opentable-booking/" }, { href: "https://notresy.com.example/x" }];
    expect(detectBookingProvider({ html: "", links })).toBeNull();
    expect(detectBookingProvider({ html: "", links: [{ href: "https://www.opentable.co.uk/r/purezza-camden-london" }] })).toBe("OpenTable");
    expect(detectBookingProvider({ html: "", links: [{ href: "https://app.walkup.co/create_booking/abc_group" }] })).toBe("Dojo");
    expect(detectBookingProvider({ html: "", links: [{ href: "https://app.squareup.com/gift/X/order" }] })).toBeNull();
  });

  it("knows documented widget loaders (Quandoo, DesignMyNight/Collins, Tock) and not DMN event pages", () => {
    const script = (src: string) => `<script src="${src}"></script>`;
    expect(detectBookingProvider({ html: script("https://booking-widget.quandoo.com/index.js"), links: [] })).toBe("Quandoo");
    expect(detectBookingProvider({ html: script("//widgets.designmynight.com/bookings-partner.min.js"), links: [] })).toBe("DesignMyNight");
    expect(detectBookingProvider({ html: script("https://www.exploretock.com/tock.js"), links: [] })).toBe("Tock");
    // Pizza Pilgrims links a DesignMyNight *event* listing; that is not its table booking.
    const pp = fixture("pizzapilgrims-soho.html");
    expect(extractFeatures(pp.html, pp.url).bookingProvider).toBe("SevenRooms");
    expect(detectBookingProvider({ html: "", links: [{ href: "https://www.designmynight.com/london/whats-on/daytime/dough-it-yourself-pizza-masterclass" }] })).toBeNull();
  });

  it("reads 'no booking link' as unknown when the menu lives on another of the venue's domains", () => {
    const f = homeFacts("matiz-home.html");
    expect(f.bookingProvider).toBeNull();
    expect(f.bookingChecked).toBe(false);
  });
});

describe("prepayment wording", () => {
  it("finds the Wolseley card-guarantee sentence on its reservations page", () => {
    const res = fixture("wolseley-reservations.html");
    const f = mergeSiteFacts({ url: "https://www.thewolseleypiccadilly.com/", html: "<html></html>" }, [{ kind: "reservation", url: res.url, html: res.html }], {
      targets: [],
      menuPdfUrl: null,
      hasBookingLink: true,
    });
    expect(f.hasPrepayment).toMatchObject({ value: true, url: res.url });
    expect(f.hasPrepayment!.quote).toContain("card details to secure the reservation");
  });

  it("finds Bill's 'credit card details are required'", () => {
    const res = fixture("bills-bookatable.html");
    const f = mergeSiteFacts({ url: "https://bills-website.co.uk/", html: "<html></html>" }, [{ kind: "reservation", url: res.url, html: res.html }], {
      targets: [],
      menuPdfUrl: null,
      hasBookingLink: true,
    });
    expect(f.hasPrepayment!.quote).toContain("credit card details are required");
  });

  it("does not read Wix's DepositeOrFullAmount flag (inside a script) as a deposit", () => {
    const { html } = fixture("andys-taverna.html");
    expect(html).toContain("DepositeOrFullAmountUoU");
    expect(homeFacts("andys-taverna.html").hasPrepayment).toBeNull();
  });

  it("does not read a hotel's 'Safe Deposit Box' as a deposit", () => {
    expect(homeFacts("bluehouse-istanbul.html").hasPrepayment).toBeNull();
  });

  it("does not read ResDiary's i18n 'Card details are required' string as venue policy", () => {
    const home = fixture("15grams-home.html");
    const book = fixture("15grams-book-table.html");
    expect(book.html).toContain("Card details are required to secure your reservation");
    const f = mergeSiteFacts(home, [{ kind: "reservation", url: book.url, html: book.html }], pickSubpages(home.html, home.url));
    expect(f.hasPrepayment).toBeNull();
  });
});

describe("menus and ordering", () => {
  it("records Eva Bosphorus' /menu redirect to Menuzade as the digital-menu vendor", () => {
    const home = fixture("eva-bosphorus.html");
    const f = mergeSiteFacts(
      home,
      [{ kind: "menu", url: "https://www.evabosphorus.com/menu", html: null, landedUrl: "https://menuzade.com.tr/evabosphorus" }],
      pickSubpages(home.html, home.url),
    );
    expect(f.qrMenuTool).toMatchObject({ value: "Menuzade", url: "https://www.evabosphorus.com/menu" });
    expect(f.qrMenuTool!.quote).toContain("redirects to https://menuzade.com.tr/evabosphorus");
    expect(f.menuPageSeen).toBe(false);
  });

  it("keeps FineDine from Blue House's QR MENU link", () => {
    expect(homeFacts("bluehouse-istanbul.html").qrMenuTool).toMatchObject({ value: "FineDine" });
  });

  it("finds Viva's menu PDF on a CDN host (Wix usrfiles) behind the menu page's 'View Menu'", () => {
    const home = fixture("viva-cafe-bistro.html");
    const pick = pickSubpages(home.html, home.url);
    expect(pick.menuPdfUrl).toBeNull();
    expect(pick.targets).toContainEqual({ kind: "menu", url: "https://www.vivacafebistro.co.uk/menu" });
    const menu = fixture("viva-cafe-bistro-menu.html");
    const f = mergeSiteFacts(home, [{ kind: "menu", url: menu.url, html: menu.html }], pick);
    expect(f.menuPdfUrl).toMatch(/usrfiles\.com\/ugd\/.+\.pdf$/);
  });

  it("finds Pizza Pilgrims' DatoCMS menu PDF and Orderswift click & collect", () => {
    const f = homeFacts("pizzapilgrims-soho.html");
    expect(f.menuPdfUrl).toMatch(/datocms-assets\.com\/.+core-menu.+\.pdf$/);
    expect(f.directOrdering).toMatchObject({ value: true });
    expect(f.directOrdering!.quote).toContain("orderswift.com");
    expect(f.bookingProvider).toMatchObject({ value: "SevenRooms" });
  });

  it("counts Mildreds' Storekit collection link as own ordering, Deliveroo as marketplace", () => {
    const page = fixture("mildreds-delivery-and-collection.html");
    const f = homeFacts("mildreds-camden.html", [{ kind: "order", url: page.url, html: page.html }]);
    expect(f.directOrdering).toMatchObject({ value: true, url: page.url });
    expect(f.directOrdering!.quote).toContain("order.storekit.com");
    expect(f.deliveryPlatforms!.value).toEqual(["Deliveroo"]);
  });

  it("reads Honest Burgers' Vita Mojo ordering and the Uber Eats short link", () => {
    const f = homeFacts("honest-dalston.html");
    expect(f.directOrdering!.quote).toContain("vmos.io");
    expect(f.deliveryPlatforms!.value.sort()).toEqual(["Deliveroo", "Just Eat", "Uber Eats"]);
  });

  it("counts Dishoom's delivery subdomain as the venue's own ordering", () => {
    const f = homeFacts("dishoom-covent-garden.html");
    expect(f.directOrdering!.quote).toContain("delivery.dishoom.com");
  });

  it("does not read Dishoom's semi-private Chef's Table as a tasting menu", () => {
    expect(homeFacts("dishoom-covent-garden.html").tastingMenu).toBeNull();
  });
});

describe("languages", () => {
  it("counts GALLADA's English / Türkçe switcher", () => {
    const { url, html } = fixture("gallada-istanbul.html");
    expect(detectLanguageCount(url, html)).toMatchObject({ value: 2, url });
  });

  it("counts Deraliye's 'TR' subdomain link as a second language", () => {
    const { url, html } = fixture("deraliye-terrace.html");
    expect(detectLanguageCount(url, html)!.value).toBe(2);
  });

  it("counts Eva Bosphorus' hreflang en/tr", () => {
    const { url, html } = fixture("eva-bosphorus.html");
    expect(detectLanguageCount(url, html)).toMatchObject({ value: 2 });
  });

  it("counts the Ritz-Carlton hreflang set, ignoring x-default", () => {
    const { url, html } = fixture("ritzcarlton-istanbul-dining.html");
    expect(detectLanguageCount(url, html)!.value).toBe(5);
  });

  it("reads translation-plugin markup (WPML, Polylang, GTranslate) per the vendors' documented markers", () => {
    const url = "https://cafe.example/";
    const wpml = `<html lang="en"><div class="wpml-ls"><ul><li class="wpml-ls-item wpml-ls-item-en wpml-ls-current-language"><a href="/">EN</a></li><li class="wpml-ls-item wpml-ls-item-tr"><a href="/tr/">TR</a></li><li class="wpml-ls-item wpml-ls-item-de"><a href="/de/">DE</a></li></ul></div></html>`;
    expect(detectLanguageCount(url, wpml)).toMatchObject({ value: 3, quote: "WPML: en, tr, de" });
    const pll = `<html lang="en"><ul><li class="lang-item lang-item-2 lang-item-en current-lang"><a href="/">English</a></li><li class="lang-item lang-item-5 lang-item-fr"><a href="/fr/">Français</a></li></ul></html>`;
    expect(detectLanguageCount(url, pll)!.value).toBe(2);
    const gt = `<html lang="en"><div class="gtranslate_wrapper"></div><script>window.gtranslateSettings = {"default_language":"en","languages":["en","fr","de","it"],"wrapper_selector":".gtranslate_wrapper"}</script><script src="https://cdn.gtranslate.net/widgets/latest/dropdown.js"></script></html>`;
    expect(detectLanguageCount(url, gt)).toMatchObject({ value: 4, quote: "GTranslate: en, fr, de, it" });
  });

  it("says 1 for a declared single-language page with no switcher, and null with a translate widget", () => {
    const { url, html } = fixture("padella-soho.html");
    expect(detectLanguageCount(url, html)).toMatchObject({ value: 1 });
    expect(detectLanguageCount(url, `<html lang="en"><script src="https://cdn.weglot.com/weglot.min.js"></script></html>`)).toBeNull();
    expect(detectLanguageCount(url, `<html><body>no lang</body></html>`)).toBeNull();
  });
});

describe("locations and operator", () => {
  it("counts 15grams' two shop postcodes and its 'OUR SHOPS' nav", () => {
    const { url, html } = fixture("15grams-home.html");
    const s = detectLocations([{ url, html, kind: "home" }]);
    expect(s.locationCount).toMatchObject({ value: 2, url });
    expect(s.locationCount!.quote).toContain("SE10 9BJ");
    expect(s.locationHints!.value.join(" ")).toContain("OUR SHOPS");
  });

  it("counts Pizza Pilgrims' sibling pizzeria pages", () => {
    const { url, html } = fixture("pizzapilgrims-pizzerias.html");
    const s = detectLocations([{ url, html, kind: "menu" }]);
    expect(s.locationCount!.value).toBeGreaterThanOrEqual(10);
    expect(s.locationCount!.quote).toContain("/pizzerias/");
  });

  it("hints a group from 'Part of the Bull Group' and from the Wolseley group site link", () => {
    const e = fixture("eleventh-hour.html");
    expect(detectLocations([{ ...e, kind: "home" }]).locationHints!.value.join(" ")).toContain("Part of the Bull Group");
    const w = fixture("wolseley-reservations.html");
    expect(detectLocations([{ ...w, kind: "reservation" }]).locationHints!.value.join(" ")).toContain("thewolseleyhospitalitygroup.com");
  });

  it("never asserts a location count from a single venue", () => {
    const { url, html } = fixture("padella-soho.html");
    expect(detectLocations([{ url, html, kind: "home" }]).locationCount).toBeNull();
    const single = `<a href="/restaurant/about">About</a><a href="/restaurant/gallery">Gallery</a><p>Open 7 days. 3 courses £30.</p>`;
    expect(detectLocations([{ url: "https://one.example/", html: single, kind: "home" }]).locationCount).toBeNull();
  });

  it("names the hotel operator: Ritz-Carlton (own host), The Peninsula (footer link), independent (room engine)", () => {
    const r = fixture("ritzcarlton-istanbul-dining.html");
    expect(detectHotelOperator([{ ...r, kind: "home" }])!.value).toBe("The Ritz-Carlton (Marriott)");
    const g = fixture("gallada-istanbul.html");
    expect(detectHotelOperator([{ ...g, kind: "home" }])).toMatchObject({ value: "The Peninsula" });
    const b = fixture("bluehouse-istanbul.html");
    const hotel = detectHotelOperator([{ ...b, kind: "home" }]);
    expect(hotel!.value).toBe("independent hotel");
    expect(hotel!.quote).toContain("istbooking.com");
    const p = fixture("padella-soho.html");
    expect(detectHotelOperator([{ ...p, kind: "home" }])).toBeNull();
  });

  it("exposes locationCount, locationHints and hotelOperator on SiteFacts", () => {
    const f = homeFacts("gallada-istanbul.html");
    expect(f.hotelOperator).toMatchObject({ value: "The Peninsula" });
    expect(f).toHaveProperty("locationCount");
    expect(f).toHaveProperty("locationHints");
  });
});

describe("visibleText", () => {
  it("drops script bodies and keeps tag boundaries apart", () => {
    expect(visibleText(`<p>London SE3 0AX</p><p>Copyright</p><script>var deposit=1</script>`)).toBe("London SE3 0AX Copyright");
  });
});
