/**
 * Where a fact was seen matters: delivery platforms on the Google
 * profile alone are not evidence, and Google's "accepts reservations"
 * attribute reaches Room 1. Also the venue-type rule for walk-in formats.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { buildRoomOneAudit, type RoomOneAuditSource } from "@/lib/ai-core/agent/room-one-audit";
import { roomOne } from "@/lib/ai-core/agent/head-agent";
import { deriveVenueType } from "@/lib/agent-workers/lead-intelligence-brief";
import type { MapFacts } from "@/lib/agent-workers/apify/map-facts";

const SITE = {
  pagesVisited: [],
  bookingChecked: true,
  menuPageSeen: true,
  orderPageSeen: true,
  bookingProvider: null,
  hasPrepayment: null,
  tastingMenu: null,
  languageCount: null,
  deliveryPlatforms: null,
  directOrdering: null,
  qrMenuTool: null,
  menuPdfUrl: null,
};
function map(over: Partial<MapFacts> = {}): MapFacts {
  return { reservationLinks: [], orderLinks: [], deliveryPlatforms: [], menuUrl: null, acceptsReservations: null, serviceOptions: [], price: null, ...over };
}
function src(site: Record<string, unknown> | null, mapFacts: MapFacts | null): RoomOneAuditSource {
  return {
    hasWebsite: true,
    websiteUrl: "https://venue.example",
    audit: site
      ? { reachable: true, url: "https://venue.example", hasBookingSystem: false, bookingProvider: null, rawFeaturesJson: { siteFacts: { ...SITE, ...site } } }
      : null,
    mapFacts,
    venueType: null,
  };
}

describe("buildRoomOneAudit — where delivery platforms were seen", () => {
  it("marks platforms seen only on the Google profile, and Room 1 ignores them", () => {
    const a = buildRoomOneAudit(src({}, map({ deliveryPlatforms: ["Deliveroo"] })))!;
    expect(a.deliveryPlatforms).toEqual(["Deliveroo"]);
    expect(a.marketplaceSource).toBe("map");
    expect(a.hasOnlineOrdering).toBe(false);
    expect(roomOne({ audit: a, reviews: { count: 0, painPhrases: [] }, locationCount: 1 }).wedge).not.toBe("marketplace");
  });

  it("marks platforms linked from the venue's own site, and Room 1 uses them", () => {
    const a = buildRoomOneAudit(
      src({ deliveryPlatforms: { value: ["Deliveroo"], url: "https://venue.example/order", quote: null } }, map({ deliveryPlatforms: ["Uber Eats"] })),
    )!;
    expect(a.marketplaceSource).toBe("site");
    expect(a.deliveryPlatforms).toEqual(["Deliveroo", "Uber Eats"]);
    expect(roomOne({ audit: a, reviews: { count: 0, painPhrases: [] }, locationCount: 1 }).wedge).toBe("marketplace");
  });

  it("a map-only audit (no crawled site) never makes a marketplace wedge", () => {
    const a = buildRoomOneAudit(src(null, map({ deliveryPlatforms: ["Deliveroo", "Just Eat"] })))!;
    expect(a.marketplaceSource).toBe("map");
    expect(roomOne({ audit: a, reviews: { count: 0, painPhrases: [] }, locationCount: 1 }).wedge).toBe("none");
  });

  it("leaves the source empty when nobody saw a platform", () => {
    expect(buildRoomOneAudit(src({}, map()))!.marketplaceSource).toBeNull();
  });
});

describe("buildRoomOneAudit — accepts reservations", () => {
  it("carries Google's attribute, and a venue that takes none gets no reservation wedge", () => {
    const a = buildRoomOneAudit(src({ bookingChecked: true }, map({ acceptsReservations: false })))!;
    expect(a.acceptsReservations).toBe(false);
    expect(a.hasBookingSystem).toBe(false);
    const out = roomOne({
      audit: a,
      reviews: { count: 200, painPhrases: [{ text: "queue", category: "table_wait", mentions: 9, complaintReviews: 30, recentMentions: 4, quote: "we queued forty minutes for a table" }] },
      locationCount: 1,
    });
    expect(out.wedge).toBe("none");
  });

  it("stays unknown without map facts", () => {
    expect(buildRoomOneAudit(src({}, null))!.acceptsReservations).toBeNull();
  });
});

describe("deriveVenueType — walk-in formats", () => {
  it("reads counter-service place types as quick service", () => {
    for (const t of ["ice_cream_shop", "dessert_shop", "sandwich_shop", "juice_shop", "bagel_shop", "donut_shop", "fast_food_restaurant", "hamburger_restaurant"]) {
      expect(deriveVenueType([null, null, t], 1)).toBe("qsr");
    }
    expect(deriveVenueType([null, null, "coffee_shop"], 1)).toBe("cafe");
    expect(deriveVenueType([null, null, "food_court"], 1)).toBe("food_hall");
  });

  it("reads a pub or bar as a bar, but not a barbecue restaurant", () => {
    expect(deriveVenueType([null, null, "pub"], 2)).toBe("bar");
    expect(deriveVenueType([null, null, "wine_bar"], 2)).toBe("bar");
    expect(deriveVenueType([null, null, "barbecue_restaurant"], 2)).toBeNull();
    expect(deriveVenueType([null, null, "italian_restaurant"], 2)).toBeNull();
  });
});
