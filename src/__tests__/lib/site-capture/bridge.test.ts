// src/__tests__/lib/site-capture/bridge.test.ts
import { describe, expect, it } from "vitest";
import { buildRoomOneAudit } from "@/lib/ai-core/agent/room-one-audit";
import { bridgeSiteFacts, coverageOf, visitedFromCapture } from "@/lib/site-capture/bridge";
import type { CapturedPage, LedgerEntry, PageType, SiteCaptureResult } from "@/lib/site-capture/types";
import { mergeSiteFacts, pickSubpages, type SiteFacts } from "@/lib/site-facts";

const HOME = "https://bistro.test/";
const EMPTY_HOME = "<html><body></body></html>";

function baseFacts(): SiteFacts {
  return mergeSiteFacts({ url: HOME, html: EMPTY_HOME }, [], pickSubpages(EMPTY_HOME, HOME));
}

function pg(type: PageType, path: string, extra: Partial<CapturedPage> = {}): CapturedPage {
  const url = path.startsWith("http") ? path : `https://bistro.test${path}`;
  return {
    title: null,
    text: "",
    links: [],
    embeds: [],
    jsonLd: [],
    url,
    finalUrl: url,
    type,
    httpStatus: 200,
    thirdPartyRequests: [],
    source: "browser",
    needsOcr: false,
    html: null,
    ...extra,
  };
}

function cap(pages: CapturedPage[], ledger: LedgerEntry[] = []): SiteCaptureResult {
  return {
    rootUrl: HOME,
    status: "complete",
    startedAt: "2026-10-04T10:00:00.000Z",
    durationMs: 12_000,
    pages: [pg("home", "/"), ...pages],
    ledger,
    sitemapUrlCount: 0,
  };
}

const led = (path: string, extra: Partial<LedgerEntry> = {}): LedgerEntry => ({
  url: `https://bistro.test${path}`,
  finalUrl: `https://bistro.test${path}`,
  type: "menu",
  source: "home_link",
  outcome: "opened",
  reason: null,
  httpStatus: 200,
  ...extra,
});

describe("bridgeSiteFacts: booking provider", () => {
  it("fills an unknown provider from a link on a captured page", () => {
    const facts = bridgeSiteFacts(
      baseFacts(),
      cap([pg("events", "/private-dining", { links: [{ text: "Enquire", href: "https://www.sevenrooms.com/reservations/bistro" }] })]),
    );
    expect(facts.bookingProvider).toMatchObject({ value: "SevenRooms", url: "https://bistro.test/private-dining", source: "page" });
  });

  it("fills it from a third-party request when no link names the provider", () => {
    const facts = bridgeSiteFacts(
      baseFacts(),
      cap([pg("reservation", "/book", { thirdPartyRequests: ["https://www.sevenrooms.com/widget/embed.js"] })]),
    );
    expect(facts.bookingProvider).toMatchObject({ value: "SevenRooms", source: "network" });
    expect(facts.bookingProvider!.quote).toContain("request to");
  });

  it("never replaces an answer mergeSiteFacts already gave", () => {
    const base = { ...baseFacts(), bookingProvider: { value: "OpenTable", url: HOME, quote: "opentable.com/r/bistro" } };
    const facts = bridgeSiteFacts(
      base,
      cap([pg("reservation", "/book", { links: [{ text: "Book", href: "https://www.sevenrooms.com/reservations/bistro" }] })]),
    );
    expect(facts.bookingProvider).toEqual(base.bookingProvider);
  });

  it("does not turn 'not read' into 'read and absent'", () => {
    const base = baseFacts();
    const facts = bridgeSiteFacts(base, cap([pg("reservation", "/book"), pg("menu", "/menu"), pg("order", "/order")]));
    expect(facts.bookingChecked).toBe(base.bookingChecked);
    expect(facts.menuPageSeen).toBe(false);
    expect(facts.orderPageSeen).toBe(false);
  });
});

describe("bridgeSiteFacts: prepayment and its scope", () => {
  it("a deposit on the reservation page is a general fact", () => {
    const facts = bridgeSiteFacts(
      baseFacts(),
      cap([pg("reservation", "/book", { text: "A deposit of £10 per person is required to confirm your booking." })]),
    );
    expect(facts.hasPrepayment).toMatchObject({ value: true, scope: "general", url: "https://bistro.test/book" });
  });

  // Review Focus 3: a groups-only deposit must not read as "this venue takes deposits".
  it("a deposit stated on a group page is scoped to groups", () => {
    const facts = bridgeSiteFacts(
      baseFacts(),
      cap([pg("events", "/group-feasts", { text: "For groups of 8 or more, we ask for debit or credit card details to secure your table." })]),
    );
    expect(facts.hasPrepayment).toMatchObject({ value: true, scope: "group_or_event", url: "https://bistro.test/group-feasts" });
  });

  it("group wording next to the deposit scopes it even on a reservation page", () => {
    const facts = bridgeSiteFacts(
      baseFacts(),
      cap([pg("reservation", "/book", { text: "Walk in any time. For parties of 10 or more a deposit is taken at the time of booking." })]),
    );
    expect(facts.hasPrepayment?.scope).toBe("group_or_event");
  });

  it("prefers a general statement over a group one", () => {
    const facts = bridgeSiteFacts(
      baseFacts(),
      cap([
        pg("events", "/private-hire", { text: "Private hire requires a deposit." }),
        pg("faq", "/faq", { text: "Every booking is secured with a deposit of £5 per guest." }),
      ]),
    );
    expect(facts.hasPrepayment).toMatchObject({ scope: "general", url: "https://bistro.test/faq" });
  });

  it("stays unknown when the page says there is no deposit", () => {
    const facts = bridgeSiteFacts(
      baseFacts(),
      cap([pg("faq", "/faq", { text: "Do I need to pay a deposit? No, we don't take deposits for any booking." })]),
    );
    expect(facts.hasPrepayment).toBeNull();
  });

  it("reads a no-show fee on the booking vendor's page", () => {
    const facts = bridgeSiteFacts(
      baseFacts(),
      cap([
        pg("external", "https://bistro.test/book", {
          finalUrl: "https://web.dojo.app/create_booking/vendor/abc",
          text: "Card details are requested for groups over four. A no-show fee of £10 per person applies.",
        }),
      ]),
    );
    expect(facts.hasPrepayment).toMatchObject({ value: true, scope: "group_or_event" });
    expect(facts.bookingProvider).toMatchObject({ value: "Dojo" });
  });

  it("Room 1 claims prepayment only from a general fact", () => {
    const audit = (hasPrepayment: SiteFacts["hasPrepayment"]) =>
      buildRoomOneAudit({
        hasWebsite: true,
        websiteUrl: HOME,
        audit: { reachable: true, url: HOME, hasBookingSystem: false, bookingProvider: null, rawFeaturesJson: { siteFacts: { ...baseFacts(), hasPrepayment } } },
        mapFacts: null,
        venueType: null,
      })!;
    expect(audit({ value: true, url: HOME, quote: "deposit", scope: "group_or_event" }).hasPrepayment).toBeNull();
    expect(audit({ value: true, url: HOME, quote: "deposit", scope: "general" }).hasPrepayment).toBe(true);
    expect(audit({ value: true, url: HOME, quote: "deposit" }).hasPrepayment).toBe(true);
  });
});

describe("bridgeSiteFacts: menu, ordering, PDFs", () => {
  it("reads a tasting menu from a menu PDF and names the source", () => {
    const facts = bridgeSiteFacts(
      baseFacts(),
      cap([pg("menu", "/files/menu.pdf", { source: "pdf", text: "Seven-course tasting menu 85 per person" })]),
    );
    expect(facts.tastingMenu).toMatchObject({ value: true, source: "pdf", url: "https://bistro.test/files/menu.pdf" });
    expect(facts.menuPdfUrl).toBe("https://bistro.test/files/menu.pdf");
  });

  it("ignores a PDF that has no text layer", () => {
    const facts = bridgeSiteFacts(baseFacts(), cap([pg("menu", "/files/menu.pdf", { source: "pdf", needsOcr: true, text: "" })]));
    expect(facts.tastingMenu).toBeNull();
  });

  it("names a digital-menu vendor and a white-label ordering vendor from deeper pages", () => {
    const facts = bridgeSiteFacts(
      baseFacts(),
      cap([
        pg("menu", "/menu", { embeds: ["https://app.menutiger.com/embed/bistro"] }),
        pg("order", "/order", { links: [{ text: "Start order", href: "https://bistro.orderswift.com/" }] }),
      ]),
    );
    expect(facts.qrMenuTool).toMatchObject({ value: "MenuTiger", url: "https://bistro.test/menu" });
    expect(facts.directOrdering).toMatchObject({ value: true, url: "https://bistro.test/order" });
  });

  it("collects delivery marketplaces linked from the order page", () => {
    const facts = bridgeSiteFacts(
      baseFacts(),
      cap([pg("order", "/order", { links: [{ text: "Deliveroo", href: "https://deliveroo.co.uk/menu/london/bistro" }, { text: "Uber Eats", href: "https://www.ubereats.com/store/bistro" }] })]),
    );
    expect(facts.deliveryPlatforms?.value).toEqual(["Deliveroo", "Uber Eats"]);
  });
});

describe("coverageOf", () => {
  it("summarises the ledger and lists what was not read, failures first", () => {
    const capture = cap(
      [],
      [
        led("/"),
        led("/menu"),
        led("/a", { outcome: "skipped", reason: "limit_type" }),
        led("/b", { outcome: "skipped", reason: "budget" }),
        led("/faq", { outcome: "failed", reason: "timeout", httpStatus: null, type: "faq" }),
      ],
    );
    expect(coverageOf(capture)).toEqual({
      status: "complete",
      opened: 2,
      skipped: 2,
      failed: 1,
      durationMs: 12_000,
      notOpened: [
        { url: "https://bistro.test/faq", type: "faq", reason: "timeout" },
        { url: "https://bistro.test/b", type: "menu", reason: "budget" },
      ],
    });
  });

  it("is attached to the bridged facts", () => {
    expect(bridgeSiteFacts(baseFacts(), cap([], [led("/")])).coverage).toMatchObject({ opened: 1 });
  });
});

describe("visitedFromCapture", () => {
  const pick = {
    targets: [
      { kind: "reservation" as const, url: "https://bistro.test/book" },
      { kind: "menu" as const, url: "https://bistro.test/menu" },
      { kind: "order" as const, url: "https://bistro.test/order" },
    ],
    menuPdfUrl: null,
    hasBookingLink: true,
  };

  it("maps captured pinned pages back to what mergeSiteFacts expects", () => {
    const capture = cap(
      [
        pg("menu", "/menu", { html: "<body>Menu</body>" }),
        pg("external", "/book", { finalUrl: "https://www.sevenrooms.com/reservations/bistro", html: "<body>Vendor</body>" }),
      ],
      [led("/order", { outcome: "failed", reason: "timeout", finalUrl: "https://bistro.test/order", httpStatus: null })],
    );
    expect(visitedFromCapture(pick, capture, HOME)).toEqual([
      { kind: "reservation", url: "https://bistro.test/book", html: null, landedUrl: "https://www.sevenrooms.com/reservations/bistro" },
      { kind: "menu", url: "https://bistro.test/menu", html: "<body>Menu</body>" },
      { kind: "order", url: "https://bistro.test/order", html: null },
    ]);
  });

  it("carries an unknown off-site landing from the ledger", () => {
    const capture = cap([], [led("/order", { outcome: "failed", reason: "offsite", finalUrl: "https://shop.other.test/" })]);
    expect(visitedFromCapture(pick, capture, HOME)[2]).toEqual({
      kind: "order",
      url: "https://bistro.test/order",
      html: null,
      landedUrl: "https://shop.other.test/",
    });
  });
});
