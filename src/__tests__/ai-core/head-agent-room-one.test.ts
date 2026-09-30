/**
 * Room 1 — pure package + wedge selection (playbook §7, plan Task 3).
 * No model is called anywhere in this file.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai-core/agent/claude", () => ({
  callClaudeJson: vi.fn(() => {
    throw new Error("Room 1 must not call a model");
  }),
  runClaudeToolLoop: vi.fn(() => {
    throw new Error("Room 1 must not call a model");
  }),
  parseClaudeJson: vi.fn(),
  getHeadAgentModel: () => "mock",
  isAnthropicConfigured: () => false,
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { roomOne, evaluateRoomOne, packageFitScore } from "@/lib/ai-core/agent/head-agent";

describe("roomOne — plan snippets", () => {
  it("picks growth and the reservation wedge when a marketplace holds the bookings", () => {
    const out = roomOne({
      audit: { hasBookingSystem: true, bookingProvider: "TheFork", hasPrepayment: false, tableCount: 40 },
      reviews: { count: 420, painPhrases: [] },
      locationCount: 1,
    });
    expect(out.wedge).toBe("reservation");
    expect(out.plan).toBe("growth");
    expect(out.evidence.length).toBeGreaterThan(0);
  });

  it("returns none when there is no strong signal and no two medium signals", () => {
    const out = roomOne({ audit: { reachable: true }, reviews: { count: 0, painPhrases: [] }, locationCount: 1 });
    expect(out.wedge).toBe("none");
    expect(out.plan).toBe("none");
  });

  it("never sells premium to a single venue", () => {
    const out = roomOne({ audit: {}, reviews: { count: 0, painPhrases: [] }, locationCount: 1 });
    expect(out.plan).not.toBe("premium");
  });

  it("does not open a wedge from a taste complaint", () => {
    const out = roomOne({
      audit: {},
      reviews: { count: 120, painPhrases: [{ text: "food was bland", sellable: false }] },
      locationCount: 1,
    });
    expect(out.wedge).toBe("none");
  });
});

describe("roomOne — rules", () => {
  it("does not open a wedge from an unsellable phrase even when it matches a wedge keyword", () => {
    const out = roomOne({
      audit: {},
      reviews: { count: 120, painPhrases: [{ text: "got food poisoning after paying the bill", sellable: false }] },
      locationCount: 1,
    });
    expect(out.wedge).toBe("none");
  });

  it("treats a phrase without `sellable` as sellable (pre-sellable analyst rows)", () => {
    const out = roomOne({
      audit: {},
      reviews: { count: 120, painPhrases: [{ text: "waited 20 minutes for the bill" }] },
      locationCount: 1,
    });
    expect(out.wedge).toBe("bill_wait");
    expect(out.plan).toBe("starter");
    expect(out.evidence[0]).toContain("waited 20 minutes for the bill");
  });

  it("ignores review evidence below the 30-review corpus", () => {
    const out = roomOne({
      audit: {},
      reviews: { count: 5, painPhrases: [{ text: "waited 20 minutes for the bill", sellable: true }] },
      locationCount: 1,
    });
    expect(out.wedge).toBe("none");
  });

  it("bill wait moves to growth above 20 tables", () => {
    const out = roomOne({
      audit: { tableCount: 40 },
      reviews: { count: 200, painPhrases: [{ text: "card machine never came", sellable: true }] },
      locationCount: 1,
    });
    expect(out).toMatchObject({ wedge: "bill_wait", plan: "growth" });
  });

  it("reservation beats bill wait; bill wait becomes the backup (example card)", () => {
    const out = roomOne({
      audit: { websiteUrl: "https://brasserie.example", bookingProvider: "TheFork", hasPrepayment: false, tableCount: 40 },
      reviews: { count: 300, painPhrases: [{ text: "we waited 20 minutes for the bill", sellable: true }] },
      locationCount: 1,
    });
    expect(out.wedge).toBe("reservation");
    expect(out.plan).toBe("growth");
    expect(out.backup).toBe("bill_wait");
    expect(out.evidence[0]).toContain("https://brasserie.example");
    expect(out.bans.join(" ")).toMatch(/TheFork/);
  });

  it("a direct (non-marketplace) booking provider opens no reservation wedge", () => {
    const out = roomOne({
      audit: { hasBookingSystem: true, bookingProvider: "Dishoom reservations" },
      reviews: { count: 0, painPhrases: [] },
      locationCount: 1,
    });
    expect(out.wedge).toBe("none");
  });

  it("does not sell reservations to a walk-in cafe", () => {
    const out = roomOne({
      audit: { bookingProvider: "OpenTable", venueType: "cafe" },
      reviews: { count: 0, painPhrases: [] },
      locationCount: 1,
    });
    expect(out.wedge).not.toBe("reservation");
    expect(out.bans.join(" ")).toMatch(/rezervasyon satma/);
  });

  it("marketplace-only ordering picks starter", () => {
    const out = roomOne({
      audit: { deliveryPlatforms: ["Deliveroo", "Uber Eats"], hasOnlineOrdering: false },
      reviews: { count: 0, painPhrases: [] },
      locationCount: 1,
    });
    expect(out).toMatchObject({ wedge: "marketplace", plan: "starter" });
    expect(out.bans.join(" ")).toMatch(/masa başı sipariş/);
  });

  it("unknown online ordering (null) alone is not a wedge", () => {
    const out = roomOne({
      audit: { hasQrMenu: null, hasOnlineOrdering: null },
      reviews: { count: 0, painPhrases: [] },
      locationCount: 1,
    });
    expect(out.wedge).toBe("none");
  });

  it("PDF menu picks the menu surface on starter; multi-language evidence lifts to growth", () => {
    const starter = roomOne({ audit: { pdfMenu: true, menuUrl: "https://x.example/menu.pdf" }, reviews: { count: 0, painPhrases: [] }, locationCount: 1 });
    expect(starter).toMatchObject({ wedge: "menu_surface", plan: "starter" });
    expect(starter.evidence[0]).toContain("menu.pdf");
    const growth = roomOne({ audit: { pdfMenu: true, languageCount: 3 }, reviews: { count: 0, painPhrases: [] }, locationCount: 1 });
    expect(growth.plan).toBe("growth");
  });

  it("a lone missing QR menu (e.g. fine dining) is only one medium signal — no call", () => {
    const out = roomOne({ audit: { hasQrMenu: false, venueType: "fine_dining" }, reviews: { count: 0, painPhrases: [] }, locationCount: 1 });
    expect(out.wedge).toBe("none");
  });

  it("two or more venues pick premium on the multi-location wedge", () => {
    const out = roomOne({ audit: { pdfMenu: true }, reviews: { count: 0, painPhrases: [] }, locationCount: 3 });
    expect(out).toMatchObject({ wedge: "multi_location", plan: "premium" });
  });

  it("guest repeat needs two medium signals and picks growth", () => {
    const out = roomOne({
      audit: { venueType: "cafe" },
      reviews: { count: 150, painPhrases: [{ text: "regulars get forgotten", sellable: true }] },
      locationCount: 1,
    });
    expect(out).toMatchObject({ wedge: "guest_repeat", plan: "growth" });
  });

  it("a centrally purchasing chain branch is a hard ban: no call", () => {
    const out = roomOne({
      audit: { bookingProvider: "TheFork", centralPurchasing: true },
      reviews: { count: 0, painPhrases: [] },
      locationCount: 1,
    });
    expect(out).toMatchObject({ wedge: "none", plan: "none", evidence: [] });
    expect(out.bans.join(" ")).toMatch(/şube müdürüne/);
  });

  it("always carries the opener and premium bans for a single venue", () => {
    const out = roomOne({ audit: {}, reviews: { count: 0, painPhrases: [] }, locationCount: 1 });
    expect(out.bans.join(" ")).toMatch(/AI, CRM/);
    expect(out.bans.join(" ")).toMatch(/Tek şubeye Premium/);
  });

  it("package fit score is low for no call and higher with a strong signal", () => {
    const none = evaluateRoomOne({ audit: {}, reviews: { count: 0, painPhrases: [] }, locationCount: 1 });
    const strong = evaluateRoomOne({ audit: { bookingProvider: "TheFork" }, reviews: { count: 0, painPhrases: [] }, locationCount: 1 });
    expect(packageFitScore(none, ["reviews"])).toBeLessThan(20);
    expect(packageFitScore(strong, [])).toBeGreaterThanOrEqual(70);
    expect(packageFitScore(strong, ["reviews"])).toBeLessThan(packageFitScore(strong, []));
  });
});
