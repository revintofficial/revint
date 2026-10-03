// src/__tests__/ai-core/room-one-audit.test.ts
import { describe, expect, it } from "vitest";
import { buildRoomOneAudit, type RoomOneAuditSource } from "@/lib/ai-core/agent/room-one-audit";

const NO_MAP = null;
function src(over: Partial<RoomOneAuditSource> = {}): RoomOneAuditSource {
  return {
    hasWebsite: true,
    websiteUrl: "https://padella.co",
    audit: { reachable: true, url: "https://padella.co", hasBookingSystem: false, bookingProvider: null, rawFeaturesJson: {} },
    mapFacts: NO_MAP,
    venueType: null,
    ...over,
  };
}
const SITE = {
  pagesVisited: [],
  bookingChecked: true,
  menuPageSeen: true,
  orderPageSeen: false,
  bookingProvider: null,
  hasPrepayment: null,
  tastingMenu: null,
  languageCount: null,
  deliveryPlatforms: null,
  directOrdering: null,
  qrMenuTool: null,
  menuPdfUrl: null,
};
function withSite(site: Record<string, unknown>, features: Record<string, unknown> = {}) {
  return src({
    audit: { reachable: true, url: "https://padella.co", hasBookingSystem: false, bookingProvider: null, rawFeaturesJson: { ...features, siteFacts: { ...SITE, ...site } } },
  });
}

describe("buildRoomOneAudit", () => {
  it("reads an old audit without subpage facts as unknown, never as absent", () => {
    const a = buildRoomOneAudit(
      src({ audit: { reachable: true, url: "https://padella.co", hasBookingSystem: false, bookingProvider: null, rawFeaturesJson: { hasQrMenu: false, hasOnlineOrdering: false, hasDeliveryIntegration: true } } }),
    )!;
    expect(a.hasBookingSystem).toBeNull();
    expect(a.hasOnlineReservation).toBeNull();
    expect(a.hasQrMenu).toBeNull();
    expect(a.hasOnlineOrdering).toBeNull();
    expect(a.marketplaceOrdering).toBeNull(); // a raw substring is not evidence
  });

  it("says no booking only when the booking surface was checked", () => {
    expect(buildRoomOneAudit(withSite({ bookingChecked: true }))!.hasBookingSystem).toBe(false);
    expect(buildRoomOneAudit(withSite({ bookingChecked: false }))!.hasBookingSystem).toBeNull();
  });

  it("says no QR menu and no direct ordering only when the menu page was read", () => {
    const seen = buildRoomOneAudit(withSite({ menuPageSeen: true }, { hasQrMenu: false }))!;
    expect(seen.hasQrMenu).toBe(false);
    expect(seen.hasOnlineOrdering).toBe(false);
    const unseen = buildRoomOneAudit(withSite({ menuPageSeen: false }, { hasQrMenu: false }))!;
    expect(unseen.hasQrMenu).toBeNull();
    expect(unseen.hasOnlineOrdering).toBeNull();
  });

  it("fills the blind rule inputs from site facts", () => {
    const a = buildRoomOneAudit(
      withSite({
        hasPrepayment: { value: true, url: "https://padella.co/reservations", quote: "deposit of £10" },
        tastingMenu: { value: true, url: "https://padella.co/menu", quote: "7-course tasting menu" },
        languageCount: { value: 2, url: "https://padella.co", quote: "en, it" },
        deliveryPlatforms: { value: ["Deliveroo"], url: "https://padella.co", quote: null },
      }),
    )!;
    expect(a.hasPrepayment).toBe(true);
    expect(a.tastingMenu).toBe(true);
    expect(a.languageCount).toBe(2);
    expect(a.deliveryPlatforms).toEqual(["Deliveroo"]);
    expect(a.marketplaceOrdering).toBe(true);
  });

  it("takes the booking provider and marketplaces from Google when the site shows none", () => {
    const a = buildRoomOneAudit(
      withSite({ bookingChecked: false }, {}),
    )!;
    expect(a.bookingProvider).toBeNull();
    const withMap = buildRoomOneAudit({
      ...withSite({ bookingChecked: false }),
      mapFacts: {
        reservationLinks: [{ name: "OpenTable", url: "https://www.opentable.co.uk/r/x" }],
        orderLinks: [{ name: "Uber Eats", url: "https://www.ubereats.com/store/x" }],
        deliveryPlatforms: ["Uber Eats"],
        menuUrl: "https://padella.co/menu",
        acceptsReservations: true,
        serviceOptions: [],
        price: null,
      },
    })!;
    expect(withMap.bookingProvider).toBe("OpenTable");
    expect(withMap.hasBookingSystem).toBe(true);
    expect(withMap.hasOnlineReservation).toBe(true);
    expect(withMap.deliveryPlatforms).toEqual(["Uber Eats"]);
    expect(withMap.menuUrl).toBe("https://padella.co/menu");
  });

  it("counts a non-marketplace Google order link as the venue's own ordering", () => {
    const a = buildRoomOneAudit({
      ...withSite({}),
      mapFacts: { reservationLinks: [], orderLinks: [{ name: "padella.co", url: "https://padella.co/order" }], deliveryPlatforms: [], menuUrl: null, acceptsReservations: null, serviceOptions: [], price: null },
    })!;
    expect(a.hasOnlineOrdering).toBe(true);
  });

  it("returns map-only facts for a lead with no site audit, and null with nothing at all", () => {
    expect(buildRoomOneAudit(src({ audit: null }))).toBeNull();
    expect(buildRoomOneAudit(src({ audit: null, hasWebsite: false }))).toMatchObject({ hasWebsite: false, websiteBroken: false });
  });
});
