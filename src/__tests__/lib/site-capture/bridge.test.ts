// src/__tests__/lib/site-capture/bridge.test.ts
import { describe, expect, it } from "vitest";
import { buildRoomOneAudit } from "@/lib/ai-core/agent/room-one-audit";
import { bridgeSiteFacts, coverageOf, siteFactsFromCapture, visitedFromCapture } from "@/lib/site-capture/bridge";
import { reducePage } from "@/lib/site-capture/reduce";
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
    candidateOverflow: 0,
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

describe("bridgeSiteFacts: prepayment sentence rule", () => {
  const VENDOR = "https://web.dojo.app/create_booking/vendor/abc";
  const on = (type: "reservation" | "faq" | "external", text: string) =>
    bridgeSiteFacts(
      baseFacts(),
      cap([pg(type, type === "faq" ? "/faq" : "/book", type === "external" ? { finalUrl: VENDOR, text } : { text })]),
    ).hasPrepayment;

  const negated = [
    "There is no late cancellation fee.",
    "We do not charge a cancellation fee.",
    "We don't charge cancellation fees for any booking.",
    "Cancellation fees do not apply.",
    "Deposits are not required.",
    "No deposit or card details are required.",
  ];
  for (const text of negated) {
    for (const type of ["reservation", "faq"] as const) {
      it(`a negated statement stays unknown (${type}): ${text}`, () => {
        expect(on(type, text)).toBeNull();
      });
    }
  }

  const thresholds = [
    "Tables of eight or more require a deposit.",
    "Bookings of 8 and above require a deposit.",
    "Tables of 5 or more require a deposit.",
    "Tables larger than 6 require a deposit.",
  ];
  for (const text of thresholds) {
    for (const type of ["reservation", "faq"] as const) {
      it(`a party-size threshold scopes the deposit (${type}): ${text}`, () => {
        expect(on(type, text)?.scope).toBe("group_or_event");
      });
    }
  }

  it.each(["reservation", "faq"] as const)("a seasonal deposit is scoped (%s)", (type) => {
    expect(on(type, "A deposit is required for all Christmas bookings.")?.scope).toBe("group_or_event");
  });

  it.each(["reservation", "faq"] as const)("card details at a voucher checkout are not a deposit (%s)", (type) => {
    expect(on(type, "Gift vouchers: card details are required at checkout.")).toBeNull();
  });

  it.each(["reservation", "faq"] as const)("a company name 'Group' is not a group restriction (%s)", (type) => {
    expect(on(type, "Part of the Hawksmoor Group. A deposit of £10 per person is required to confirm your booking.")?.scope).toBe("general");
  });

  it.each(["reservation", "faq"] as const)("a negation in another sentence does not cancel the deposit (%s)", (type) => {
    expect(on(type, "We cannot take bookings by phone. A deposit of £10 per person is required to confirm your booking.")?.scope).toBe("general");
  });

  it("a question answered 'yes' for every booking is general", () => {
    expect(on("reservation", "Do you take a deposit? Yes, £10 per person for every booking.")?.scope).toBe("general");
  });

  it("a question answered 'only for groups' is scoped", () => {
    expect(on("reservation", "Do you take a deposit? Only for groups of 8 or more.")?.scope).toBe("group_or_event");
  });

  it("'no-show' is not a negation on a booking vendor's page", () => {
    expect(on("external", "A no-show fee of £10 per person applies.")).toMatchObject({ value: true, scope: "general" });
  });

  it("an FAQ deposit without booking wording stays unknown; on the reservation page it is general", () => {
    expect(on("faq", "A deposit is required.")).toBeNull();
    expect(on("reservation", "A deposit is required.")?.scope).toBe("general");
  });

  it.each([
    "Groups require a deposit.",
    "Deposits only apply to groups.",
    "Groups above 8 require a deposit.",
    "Large party bookings require a deposit.",
    "A deposit is required for larger bookings.",
    "When booking for 8, a deposit is required.",
  ])("ordinary groups-only wording scopes the deposit: %s", (text) => {
    expect(on("reservation", text)?.scope).toBe("group_or_event");
  });

  it.each([
    "Group Bookings\nA deposit of £10 per person is required to confirm your booking.",
    "Group Bookings A deposit of £10 per person is required to confirm your booking.",
    "Christmas Parties\nA deposit of £20 per person is required to confirm your booking.",
    "Christmas Parties A deposit of £20 per person is required to confirm your booking.",
  ])("a heading stays with the sentence after it: %j", (text) => {
    expect(on("reservation", text)?.scope).toBe("group_or_event");
  });

  it.each([
    "Do I need to pay a deposit to book\nNo, we don't take deposits.",
    "Do I need to pay a deposit to book No, we don't take deposits.",
  ])("an unpunctuated FAQ question stays with its answer: %j", (text) => {
    expect(on("faq", text)).toBeNull();
  });

  it.each(["Cancellation fees are waived.", "Deposit-free booking.", "Pre-payment is optional."])(
    "a 'no fee' phrasing stays unknown: %s",
    (text) => {
      expect(on("reservation", text)).toBeNull();
    },
  );

  it.each([
    "Card details are requested for groups over four. A no-show fee of £10 per person applies.",
    "A no-show fee of £10 per person applies. Card details are requested for groups over four.",
  ])("one scoped statement scopes the page in either order: %s", (text) => {
    expect(on("external", text)?.scope).toBe("group_or_event");
  });

  it("a page with a groups-only deposit is never general", () => {
    expect(on("reservation", "Groups of 8+ require a deposit. A no-show fee of £10 per person applies to all bookings.")?.scope).toBe(
      "group_or_event",
    );
  });

  it("a restriction marker scopes the deposit", () => {
    expect(on("reservation", "A deposit is only required on Fridays and Saturdays.")?.scope).toBe("group_or_event");
  });

  it("a time period is not a party size", () => {
    expect(
      on("reservation", "A deposit of £10 per person is refunded if you cancel more than 48 hours before your booking.")?.scope,
    ).toBe("general");
  });

  it.each([
    "A deposit of £10 per person is required. This applies to parties of 8 or more.",
    "A deposit of £10 per person is required. This applies to bookings of 8 or more.",
    "Do I need to pay a deposit? Yes. Groups of 8 or more pay £10 per person.",
  ])("a restriction in the following sentence scopes the deposit: %s", (text) => {
    expect(on("reservation", text)?.scope).toBe("group_or_event");
  });

  it.each([
    "A deposit is required for all events.",
    "A deposit is required for all functions.",
    "A deposit is required for birthday bookings.",
    "Exclusive use of the restaurant requires a deposit.",
    "Whole venue hire requires a deposit.",
    "Bookings for larger numbers require a deposit.",
    "Deposits are required for corporate bookings.",
    "A deposit is required for bookings in December.",
    "During December all bookings require a deposit.",
    "A deposit is required for Friday and Saturday evening bookings.",
    "Weekend bookings require a deposit.",
    "A deposit is required at peak times.",
    "A deposit is required for bookings of 100 guests.",
    "Deposits are taken for NYE.",
    "Deposits apply to hen and stag dos.",
    "A deposit is required to book the Chef's Table.",
    "A deposit is required for buffet bookings.",
  ])("an occasion, event, day or qualified booking scopes the deposit: %s", (text) => {
    expect(on("reservation", text)?.scope).toBe("group_or_event");
  });

  it.each([
    "We have scrapped deposits.",
    "We have stopped taking deposits.",
    "There is zero deposit to book.",
    "Deposits are unnecessary for standard bookings.",
  ])("a negation without a negation word stays unknown: %s", (text) => {
    expect(on("reservation", text)).toBeNull();
  });

  it.each([
    "A deposit is required for all bookings.",
    "All online bookings require a deposit.",
    "A deposit is taken at the time of booking.",
    "We require a deposit to secure your reservation.",
  ])("an unqualified booking stays general: %s", (text) => {
    expect(on("reservation", text)?.scope).toBe("general");
  });

  // The group statement is negated, but the rule cannot tell that apart from an affirmative
  // group statement with an incidental negation word; unknown is the safe side.
  it("a negated group statement keeps the page from a general claim", () => {
    expect(on("reservation", "We have stopped taking deposits for groups. A deposit is required to confirm your booking.")).toBeNull();
  });

  it.each([
    "Groups of 8 or more require a deposit, with zero exceptions. A deposit is required to confirm your booking.",
    "A deposit is required for parties of 8 or more, and is unnecessary for smaller tables. A no-show fee of £10 per person applies.",
  ])("a group statement with an incidental negation word is never general: %s", (text) => {
    expect(on("reservation", text)).toBeNull();
  });

  // Only a negation skip blocks the page; a hit skipped as non-booking commerce does not,
  // even when it also carries a negation word and names a group.
  it("a commerce skip that names a group does not keep the page from a general claim", () => {
    expect(
      on("reservation", "Deposits are not taken on gift vouchers for groups. A deposit is required to confirm your booking.")?.scope,
    ).toBe("general");
  });

  it("a skipped negated group statement leaves another scoped statement on the page", () => {
    expect(
      on(
        "reservation",
        "Christmas bookings require a deposit. Please arrive on time. " +
          "Groups of 8 or more require a deposit, with zero exceptions. A deposit is required to confirm your booking.",
      ),
    ).toMatchObject({ value: true, scope: "group_or_event", quote: "Christmas bookings require a deposit. Please arrive on time." });
  });

  it("an uncertain deposit statement is not a general claim", () => {
    expect(on("reservation", "A deposit may be required to confirm your booking.")?.scope).toBe("group_or_event");
  });

  it("a company name 'Group' still does not scope", () => {
    expect(on("reservation", "Part of the Hawksmoor Group. A deposit of £10 per person is required to confirm your booking.")?.scope).toBe(
      "general",
    );
  });

  // The second case is the slow one without a word-start anchor: the run is not directly
  // followed by the booking noun, so the scan would restart at every letter of it.
  it.each([
    "A deposit is required for " + "a".repeat(60_000) + " bookings.",
    "A deposit is required for " + "a".repeat(60_000) + " and other bookings.",
  ])("a very long unbroken run of letters before 'bookings' is read in linear time (#%#)", (text) => {
    const started = performance.now();
    const fact = on("reservation", text);
    expect(performance.now() - started).toBeLessThan(500);
    expect(fact?.scope).not.toBe("general");
  });
});

// Final fix C1: in the deep path the deposit is always decided by the sentence rule.
describe("bridgeSiteFacts: the sentence rule decides the deposit", () => {
  const GENERAL_FROM_MERGE = { value: true as const, url: HOME, quote: "deposit and fees will vary" };
  const withHome = (homeText: string, pages: CapturedPage[] = []): SiteCaptureResult => ({
    ...cap(pages),
    pages: [pg("home", "/", { text: homeText }), ...pages],
  });

  it("replaces a general deposit from mergeSiteFacts with null when no captured page supports it", () => {
    const facts = bridgeSiteFacts({ ...baseFacts(), hasPrepayment: GENERAL_FROM_MERGE }, cap([pg("menu", "/menu", { text: "Starters" })]));
    expect(facts.hasPrepayment).toBeNull();
  });

  it("replaces a general deposit from mergeSiteFacts with the scoped one the rule finds", () => {
    const facts = bridgeSiteFacts(
      { ...baseFacts(), hasPrepayment: GENERAL_FROM_MERGE },
      cap([pg("reservation", "/book", { text: "Groups of 8 or more require a deposit." })]),
    );
    expect(facts.hasPrepayment).toMatchObject({ value: true, scope: "group_or_event", url: "https://bistro.test/book" });
  });

  it("15grams: a deposit for bookings of 7+ is scoped", () => {
    const facts = bridgeSiteFacts(
      { ...baseFacts(), hasPrepayment: GENERAL_FROM_MERGE },
      cap([
        pg("reservation", "https://15grams.co.uk/15grams-book-table", {
          text: "For bookings of 7+: we require at lest 5 days notice for cancellation, deposit and fees will vary We're flexible, but appreciate timely communication.",
        }),
      ]),
    );
    expect(facts.hasPrepayment?.scope).toBe("group_or_event");
  });

  it("Avlu: an i18n string table on the homepage is not a statement", () => {
    const blob =
      `{"Oops! Something went wrong":"Oops! Something went wrong","Add Ons":"Add Ons","Credit Card Required":"Credit Card Required",` +
      `"Book a table":"Book a table","Your booking":"Your booking","Reservation details":"Reservation details",` +
      `"Select a date":"Select a date","Select a time":"Select a time","Number of guests":"Number of guests",` +
      `"We apologize for the inconvenience, but it seems like the booking could not be completed":"We apologize for the inconvenience, but it seems like the booking could not be completed"}`;
    expect(blob.length).toBeGreaterThan(400);
    const facts = bridgeSiteFacts({ ...baseFacts(), hasPrepayment: GENERAL_FROM_MERGE }, withHome(blob));
    expect(facts.hasPrepayment).toBeNull();
  });

  it("Peninsula: a hotel's room prepayment is not a table deposit", () => {
    const facts = bridgeSiteFacts(
      { ...baseFacts(), hasPrepayment: GENERAL_FROM_MERGE },
      cap([
        pg("reservation", "https://bistro.test/special-offers/rooms/stay-longer", {
          text: "Limited in-room wireless internet access Terms and Conditions: Hotel may request prepayment at the time of booking. Hotel reserves the rights to cancel the reservation.",
        }),
      ]),
    );
    // An absent scope reads as general, so only null or an explicit group scope pass.
    expect(facts.hasPrepayment === null || facts.hasPrepayment.scope === "group_or_event").toBe(true);
  });

  it("a first-night deposit on a reservation page is a room deposit", () => {
    const facts = bridgeSiteFacts(
      baseFacts(),
      cap([pg("reservation", "/rooms/book-now", { text: "A deposit of the first night is required to confirm your booking." })]),
    );
    expect(facts.hasPrepayment).toBeNull();
  });

  it("reads a general deposit on the homepage when it talks about bookings", () => {
    const facts = bridgeSiteFacts(baseFacts(), withHome("A deposit of £10 per person is required to confirm your booking."));
    expect(facts.hasPrepayment).toMatchObject({ value: true, scope: "general", url: HOME });
  });

  it("a homepage deposit without booking wording stays unknown", () => {
    expect(bridgeSiteFacts(baseFacts(), withHome("A deposit is required.")).hasPrepayment).toBeNull();
  });

  it("a sentence longer than 400 characters is skipped", () => {
    const long = `A deposit of £10 per person is required to confirm your booking ${"and more words ".repeat(30)}.`;
    expect(long.length).toBeGreaterThan(400);
    expect(bridgeSiteFacts(baseFacts(), cap([pg("reservation", "/book", { text: long })])).hasPrepayment).toBeNull();
  });

  it("prefers the reservation and vendor pages over the homepage", () => {
    const facts = bridgeSiteFacts(
      baseFacts(),
      withHome("A deposit of £10 per person is required to confirm your booking.", [
        pg("reservation", "/book", { text: "A deposit of £20 per person is required to confirm your booking." }),
      ]),
    );
    expect(facts.hasPrepayment).toMatchObject({ scope: "general", url: "https://bistro.test/book" });
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

  it("does not take a non-menu PDF as the menu PDF", () => {
    const facts = bridgeSiteFacts(baseFacts(), cap([pg("other", "/files/allergens.pdf", { source: "pdf", text: "Allergen guide" })]));
    expect(facts.menuPdfUrl).toBeNull();
  });

  // Final fix C2: a wine list linked from a menu page is not the menu PDF.
  it("never takes a drinks-only PDF linked from a menu page as the menu PDF", () => {
    const facts = bridgeSiteFacts(
      baseFacts(),
      cap([
        pg("menu", "/menu/dinner", {
          links: [
            { text: "Wine list", href: "https://bistro.test/app/uploads/00728_WOLSELEY_OG_Winter_2026_Wine_Menu.pdf" },
            { text: "Cocktails", href: "https://bistro.test/files/cocktail-menu.pdf" },
          ],
        }),
      ]),
    );
    expect(facts.menuPdfUrl).toBeNull();
  });

  it("still takes a food menu PDF linked from a menu page", () => {
    const facts = bridgeSiteFacts(
      baseFacts(),
      cap([pg("menu", "/menu", { links: [{ text: "Wine list", href: "https://bistro.test/files/wine.pdf" }, { text: "Dinner menu", href: "https://bistro.test/files/dinner.pdf" }] })]),
    );
    expect(facts.menuPdfUrl).toBe("https://bistro.test/files/dinner.pdf");
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

// Final fix C4: location and hotel signals come only from pages that list venues.
describe("bridgeSiteFacts: location signals", () => {
  const ADDRESSES = "<html><body><p>12 Soho St, London W1D 3QF</p><p>4 Camden Rd, London NW1 9LS</p><p>9 Mare St, London E8 4RP</p></body></html>";
  const HOTEL = `<html><body><a href="https://www.fourseasons.com/istanbul/">Four Seasons Istanbul</a></body></html>`;
  // As in production, the homepage's HTML is kept too.
  const at = (type: PageType, path: string, html: string) =>
    bridgeSiteFacts(baseFacts(), { ...cap([]), pages: [pg("home", "/", { html: EMPTY_HOME }), pg(type, path, { html })] });

  it("reads a venue count from a page that lists the venues", () => {
    expect(at("locations", "/locations/", ADDRESSES).locationCount).toMatchObject({ value: 3 });
    expect(at("locations", "/our-restaurants", ADDRESSES).locationCount).toMatchObject({ value: 3 });
  });

  it.each([
    ["locations", "/location/"],
    ["locations", "/find-us"],
    ["contact", "/contact"],
    ["about", "/about"],
  ] as const)("does not read venue counts or a hotel from a %s page at %s", (type, path) => {
    expect(at(type, path, ADDRESSES).locationCount ?? null).toBeNull();
    expect(at(type, path, HOTEL).hotelOperator ?? null).toBeNull();
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
      overflow: 0,
      notOpened: [
        { url: "https://bistro.test/faq", type: "faq", reason: "timeout" },
        { url: "https://bistro.test/b", type: "menu", reason: "budget" },
      ],
    });
  });

  it("carries the candidate overflow", () => {
    expect(coverageOf({ ...cap([], [led("/")]), candidateOverflow: 42 }).overflow).toBe(42);
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

// Production 2026-10-04 (15grams): a ResDiary widget keeps every state message as hidden markup.
describe("siteFactsFromCapture: the deposit is read from the text a visitor can see", () => {
  const RESDIARY_STATES =
    "Please start a new booking. The restaurant is currently setup in Stripe test mode. Please make sure live mode is enabled " +
    "before attempting to accept online bookings to avoid bookings being declined. A payment of will be required to hold this " +
    "booking. Card details are required to secure your reservation. These will be held securely in our PCI-compliant Payment " +
    "Gateway. Charges may be applied in accordance with our terms and conditions. Unfortunately the transaction for this booking " +
    "has failed. Money was not taken from your account nor were your card details stored.";
  const VISIBLE = "Book a Table For larger bookings (7+ people) and private events please get in touch";
  const BOOK = "https://bistro.test/book-table";
  const homeHtml = `<html><body><a href="/book-table">Book a table</a></body></html>`;
  const bookHtml =
    `<html><head><title>Book a Table</title></head><body><h1>Book a Table</h1>` +
    `<div class="rd-widget"><div style="display:none">${RESDIARY_STATES}</div></div>` +
    `<p>For larger bookings (7+ people) and private events please get in touch</p></body></html>`;

  function factsWith(text: string): SiteFacts {
    const pick = pickSubpages(homeHtml, HOME);
    expect(pick.targets).toContainEqual({ kind: "reservation", url: BOOK });
    const capture: SiteCaptureResult = {
      ...cap([]),
      pages: [
        pg("home", "/", { text: "Book a table", html: homeHtml }),
        pg("reservation", "/book-table", { title: "Book a Table", text, html: bookHtml }),
      ],
      ledger: [led("/"), led("/book-table", { type: "reservation" })],
    };
    return siteFactsFromCapture({ url: HOME, html: homeHtml }, capture, pick);
  }

  it("has no deposit when the rendered text is the venue's own sentence, whatever the hidden HTML says", () => {
    expect(factsWith(VISIBLE).hasPrepayment).toBeNull();
  });

  it("finds the hidden widget sentence when the text is derived from the HTML (the defect)", () => {
    const derived = reducePage(bookHtml, BOOK).text;
    expect(derived).toContain("Card details are required to secure your reservation.");
    expect(factsWith(derived).hasPrepayment).toMatchObject({ value: true, url: BOOK });
  });
});
