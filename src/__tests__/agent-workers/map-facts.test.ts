import { describe, expect, it } from "vitest";
import { deliveryPlatformFor, isDirectOrderingHost } from "@/lib/delivery-platforms";
import { countryCodeFromAddress, extractMapFacts, parseMapFacts } from "@/lib/agent-workers/apify/map-facts";

describe("deliveryPlatformFor", () => {
  it("names a marketplace from a url or a label", () => {
    expect(deliveryPlatformFor("https://deliveroo.co.uk/menu/london/x")).toBe("Deliveroo");
    expect(deliveryPlatformFor("Uber Eats")).toBe("Uber Eats");
    expect(deliveryPlatformFor("https://www.just-eat.co.uk/restaurants-x")).toBe("Just Eat");
    expect(deliveryPlatformFor("https://padella.co/order")).toBeNull();
  });
  it("knows direct-ordering vendors are not marketplaces", () => {
    expect(isDirectOrderingHost("order.flipdish.com")).toBe(true);
    expect(isDirectOrderingHost("deliveroo.co.uk")).toBe(false);
  });
});

describe("extractMapFacts", () => {
  it("reads reservation links, order platforms, menu and service options", () => {
    const facts = extractMapFacts({
      reserveTableUrl: "https://www.opentable.co.uk/r/x",
      tableReservationLinks: [{ name: "OpenTable", url: "https://www.opentable.co.uk/r/x" }],
      orderBy: [
        { name: "Deliveroo", orderUrl: "https://deliveroo.co.uk/menu/x" },
        { name: "padella.co", url: "https://padella.co/order" },
      ],
      menu: "https://padella.co/menu",
      price: "££",
      additionalInfo: {
        "Service options": [{ "Dine-in": true }, { Delivery: true }, { Takeaway: false }],
        Planning: [{ "Accepts reservations": true }],
      },
    });
    expect(facts.reservationLinks).toEqual([{ name: "OpenTable", url: "https://www.opentable.co.uk/r/x" }]);
    expect(facts.orderLinks).toHaveLength(2);
    expect(facts.deliveryPlatforms).toEqual(["Deliveroo"]);
    expect(facts.menuUrl).toBe("https://padella.co/menu");
    expect(facts.serviceOptions).toEqual(["Dine-in", "Delivery"]);
    expect(facts.acceptsReservations).toBe(true);
    expect(facts.price).toBe("££");
  });

  it("returns empty facts for a payload without these fields and never throws", () => {
    const empty = { reservationLinks: [], orderLinks: [], deliveryPlatforms: [], menuUrl: null, acceptsReservations: null, serviceOptions: [], price: null };
    expect(extractMapFacts({ title: "x" })).toEqual(empty);
    expect(extractMapFacts(null)).toEqual(empty);
    expect(extractMapFacts({ orderBy: "nope", additionalInfo: [1, 2], tableReservationLinks: [null, { url: 5 }] })).toEqual(empty);
  });

  it("never turns 'Reservations required: false' into a refusal", () => {
    expect(extractMapFacts({ additionalInfo: { Planning: [{ "Reservations required": false }] } }).acceptsReservations).toBeNull();
    expect(extractMapFacts({ additionalInfo: { Planning: [{ "Reservations required": true }] } }).acceptsReservations).toBe(true);
  });

  it("puts the reservation provider first and merges booking links without duplicates", () => {
    const facts = extractMapFacts({
      restaurantData: { tableReservationProvider: { name: "Resy", reserveTableUrl: "https://resy.com/x" } },
      reserveTableUrl: "https://resy.com/x",
      tableReservationLinks: [{ name: "carminesnyc.com", url: "https://carminesnyc.com/book" }],
      bookingLinks: [{ name: "x", url: "https://booking.example/x" }],
    });
    expect(facts.reservationLinks[0]).toEqual({ name: "Resy", url: "https://resy.com/x" });
    expect(facts.reservationLinks).toHaveLength(3);
    const urls = facts.reservationLinks.map((l) => l.url);
    expect(new Set(urls).size).toBe(3);
  });

  it("round-trips through stored JSON", () => {
    const facts = extractMapFacts({ menu: "https://x.co/menu" });
    expect(parseMapFacts(JSON.parse(JSON.stringify(facts)))).toEqual(facts);
    expect(parseMapFacts(undefined)).toBeNull();
  });
});

describe("countryCodeFromAddress", () => {
  it("reads the country from the end of a formatted address", () => {
    expect(countryCodeFromAddress("6 Southwark St, London SE1 1TQ, UK")).toBe("gb");
    expect(countryCodeFromAddress("İstiklal Cd. 12, 34435 Beyoğlu/İstanbul, Türkiye")).toBe("tr");
    expect(countryCodeFromAddress("12 Rue X, 75001 Paris, France")).toBe("fr");
    expect(countryCodeFromAddress("somewhere unknown")).toBeUndefined();
    expect(countryCodeFromAddress(null)).toBeUndefined();
  });
});
