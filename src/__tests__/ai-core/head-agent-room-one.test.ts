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

import { roomOne, evaluateRoomOne, packageFitScore, openQuestionsFor } from "@/lib/ai-core/agent/head-agent";

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
      reviews: {
        count: 120,
        painPhrases: [
          { text: "waited 20 minutes for the bill", category: "bill", mentions: 6, complaintReviews: 40, recentMentions: 2, quote: "waited 20 minutes for the bill" },
        ],
      },
      locationCount: 1,
    });
    expect(out.wedge).toBe("bill_wait");
    expect(out.plan).toBe("starter");
    expect(out.evidence[0]).toBe('yorum (6/40 şikayetli yorum, %15, son 12 ay: 2): "waited 20 minutes for the bill"');
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
      reviews: {
        count: 200,
        painPhrases: [{ text: "card machine never came", sellable: true, category: "bill", mentions: 6, recentMentions: 3, quote: "card machine never came" }],
      },
      locationCount: 1,
    });
    expect(out).toMatchObject({ wedge: "bill_wait", plan: "growth" });
  });

  it("reservation beats bill wait; bill wait becomes the backup (example card)", () => {
    const out = roomOne({
      audit: { websiteUrl: "https://brasserie.example", bookingProvider: "TheFork", hasPrepayment: false, tableCount: 40 },
      reviews: {
        count: 300,
        painPhrases: [
          { text: "we waited 20 minutes for the bill", sellable: true, category: "bill", mentions: 6, recentMentions: 3, quote: "we waited 20 minutes for the bill" },
        ],
      },
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
    expect(packageFitScore(strong, [])).toBe(65);
    // A reservation card read off the site loses points for a missing site, not for thin reviews.
    expect(packageFitScore(strong, ["website"])).toBe(55);
    expect(packageFitScore(strong, ["reviews"])).toBe(65);
    expect(packageFitScore(strong, ["map", "website", "website_stale", "reviews"])).toBe(35);
  });
});

describe("roomOne — verified review evidence", () => {
  const audit = { reachable: true };

  it("treats one unverified legacy phrase as a single medium signal", () => {
    const out = roomOne({ audit, reviews: { count: 80, painPhrases: [{ text: "waited ages for the bill" }] }, locationCount: 1 });
    expect(out.wedge).toBe("none");
  });

  it("makes a strong bill signal from five reviews and prints the count with the real quote", () => {
    const out = roomOne({
      audit,
      reviews: { count: 80, painPhrases: [{ text: "slow to bring the bill", category: "bill", mentions: 5, recentMentions: 2, quote: "we waited 25 minutes for the bill" }] },
      locationCount: 1,
    });
    expect(out.wedge).toBe("bill_wait");
    expect(out.evidence[0]).toBe('yorum (5/80): "we waited 25 minutes for the bill"');
  });

  it("drops a phrase whose quotes were found in no review", () => {
    const out = roomOne({
      audit,
      reviews: { count: 80, painPhrases: [{ text: "slow to bring the bill", category: "bill", mentions: 0 }, { text: "bill took ages", category: "bill", mentions: 0 }] },
      locationCount: 1,
    });
    expect(out.wedge).toBe("none");
  });

  it("follows the analyst category, not a keyword in the summary", () => {
    const out = roomOne({
      audit,
      reviews: { count: 80, painPhrases: [{ text: "not worth what you pay", category: "other", mentions: 4, quote: "not worth what you pay for the portion" }] },
      locationCount: 1,
    });
    expect(out.wedge).toBe("none");
  });
});

describe("openQuestionsFor", () => {
  it("asks only for the unknown inputs that matter to the chosen wedge", () => {
    expect(openQuestionsFor({ hasPrepayment: null }, "reservation", 1)).toEqual([
      "Rezervasyonda depozito veya kart garantisi alıyorlar mı?",
    ]);
    expect(openQuestionsFor({ tableCount: null, languageCount: null }, "bill_wait", 1)).toEqual([
      "Kaç masa var, ayda kaç sipariş? (20 masa veya 1.000 sipariş üstü Growth)",
      "Menü kaç dilde?",
    ]);
    expect(openQuestionsFor({ languageCount: 2 }, "menu_surface", 1)).toEqual(["Menüde kaç ürün var? (100 üstü Growth)"]);
    expect(openQuestionsFor({ hasPrepayment: true, centralPurchasing: null }, "reservation", 3)).toEqual([
      "Satın alma kararı şubede mi, merkezde mi?",
    ]);
    // No wedge: the two discovery questions, unless Room 1 stopped the call.
    expect(openQuestionsFor({}, "none", 1)).toEqual([
      "Rezervasyonları nasıl alıyorsunuz: telefon, bir platform, kendi siteniz?",
      "Misafir menüyü nasıl görüyor: basılı, PDF, QR?",
    ]);
    expect(openQuestionsFor({ operator: "hotel_fnb" }, "none", 1)).toEqual([]);
  });
});

describe("roomOne — frequency thresholds", () => {
  const audit = { reachable: true };
  const bill = (extra: Record<string, unknown>) => ({
    text: "slow to bring the bill",
    category: "bill",
    quote: "we waited 25 minutes for the bill",
    ...extra,
  });

  it("two reviews are one medium signal: alone they open nothing", () => {
    const ev = evaluateRoomOne({ audit, reviews: { count: 200, painPhrases: [bill({ mentions: 2, complaintReviews: 30 })] }, locationCount: 1 });
    expect(ev.output.wedge).toBe("none");
  });

  it("a single review is an anecdote, not a signal", () => {
    const out = roomOne({
      audit: { hasQrMenu: false },
      reviews: { count: 200, painPhrases: [{ text: "menu is out of date", category: "menu", mentions: 1, quote: "the menu online is out of date" }] },
      locationCount: 1,
    });
    expect(out.wedge).toBe("none");
  });

  it("five reviews below 10% of the complaint reviews stay medium", () => {
    const out = roomOne({ audit, reviews: { count: 200, painPhrases: [bill({ mentions: 5, complaintReviews: 80, recentMentions: 3 })] }, locationCount: 1 });
    expect(out.wedge).toBe("none");
  });

  it("an old complaint is not a strong signal: none of the reviews is from the last 12 months", () => {
    const out = roomOne({ audit, reviews: { count: 200, painPhrases: [bill({ mentions: 8, complaintReviews: 40, recentMentions: 0 })] }, locationCount: 1 });
    expect(out.wedge).toBe("none");
  });

  it("frequent, recent and a real share of the complaints: strong, tier B", () => {
    const out = roomOne({ audit, reviews: { count: 200, painPhrases: [bill({ mentions: 8, complaintReviews: 40, recentMentions: 3 })] }, locationCount: 1 });
    expect(out).toMatchObject({ wedge: "bill_wait", tier: "B" });
    expect(out.evidence[0]).toBe('yorum (8/40 şikayetli yorum, %20, son 12 ay: 3): "we waited 25 minutes for the bill"');
  });

  it("waiting to order and waiting for the bill are two medium signals on the same wedge", () => {
    const out = roomOne({
      audit,
      reviews: {
        count: 200,
        painPhrases: [
          bill({ mentions: 3, complaintReviews: 60 }),
          { text: "nobody took our order", category: "order_wait", mentions: 2, complaintReviews: 60, quote: "nobody came to take our order for 20 minutes" },
        ],
      },
      locationCount: 1,
    });
    expect(out).toMatchObject({ wedge: "bill_wait", tier: "C" });
  });

  it("order errors never make a strong signal on their own", () => {
    const out = roomOne({
      audit,
      reviews: { count: 200, painPhrases: [{ text: "wrong dishes", category: "order_error", mentions: 12, complaintReviews: 40, recentMentions: 6, quote: "they brought the wrong dish twice" }] },
      locationCount: 1,
    });
    expect(out.wedge).toBe("none");
  });

  it("price, food quality, staff, ambiance and kitchen wait never open a wedge, however frequent", () => {
    for (const category of ["price", "food_quality", "staff", "ambiance", "kitchen_wait", "other"]) {
      const out = roomOne({
        audit: { hasQrMenu: false },
        reviews: { count: 200, painPhrases: [{ text: "complaint", category, mentions: 30, complaintReviews: 60, recentMentions: 10, quote: "a long complaint about it" }] },
        locationCount: 1,
      });
      expect(out.wedge).toBe("none");
    }
  });

  it("legacy rows: a price sentence that mentions the bill is not a bill-wait signal", () => {
    const out = roomOne({
      audit,
      reviews: { count: 120, painPhrases: [{ text: "the bill that followed was astronomically high" }, { text: "we overpaid, the bill was too expensive" }] },
      locationCount: 1,
    });
    expect(out.wedge).toBe("none");
  });

  it("legacy rows: 'pay' and 'split' alone no longer mean the bill", () => {
    const out = roomOne({
      audit,
      reviews: { count: 120, painPhrases: [{ text: "not worth what you pay" }, { text: "we split a dessert" }] },
      locationCount: 1,
    });
    expect(out.wedge).toBe("none");
  });
});

describe("roomOne — strength first, playbook order second", () => {
  const strongBill = { text: "slow bill", category: "bill", mentions: 30, complaintReviews: 90, recentMentions: 12, quote: "we waited half an hour for the bill" };
  const mediumBooking = { text: "booking ignored", category: "reservation", mentions: 2, complaintReviews: 90, quote: "our booking was not in the system" };

  it("two weak reservation hints do not beat thirty bill complaints (C vs B)", () => {
    const out = roomOne({
      audit: { websiteUrl: "https://x.example", reachable: true, hasBookingSystem: false },
      reviews: { count: 200, painPhrases: [mediumBooking, strongBill] },
      locationCount: 1,
    });
    expect(out).toMatchObject({ wedge: "bill_wait", tier: "B", backup: "reservation" });
  });

  it("at the same tier the playbook order decides: reservation before bill wait (B vs B)", () => {
    const out = roomOne({
      audit: { bookingProvider: "OpenTable" },
      reviews: { count: 200, painPhrases: [strongBill] },
      locationCount: 1,
    });
    expect(out).toMatchObject({ wedge: "reservation", tier: "B", backup: "bill_wait" });
  });

  it("a strong signal confirmed by a second source is tier A and wins (A vs B)", () => {
    const out = roomOne({
      audit: { bookingProvider: "OpenTable" },
      reviews: { count: 200, painPhrases: [mediumBooking, strongBill] },
      locationCount: 1,
    });
    expect(out).toMatchObject({ wedge: "reservation", tier: "A", backup: "bill_wait" });
  });

  it("a better-supported lower-priority wedge wins: marketplace A over reservation B", () => {
    const out = roomOne({
      audit: { bookingProvider: "OpenTable", deliveryPlatforms: ["Deliveroo"], hasOnlineOrdering: false },
      reviews: {
        count: 200,
        painPhrases: [{ text: "late delivery", category: "delivery", mentions: 4, complaintReviews: 90, quote: "the delivery arrived an hour late" }],
      },
      locationCount: 1,
    });
    expect(out).toMatchObject({ wedge: "marketplace", tier: "A", backup: "reservation" });
  });

  it("the fit score follows the tier and drops 10 per missing source", () => {
    const a = evaluateRoomOne({ audit: { bookingProvider: "OpenTable" }, reviews: { count: 200, painPhrases: [mediumBooking] }, locationCount: 1 });
    const b = evaluateRoomOne({ audit: { bookingProvider: "OpenTable" }, reviews: { count: 0, painPhrases: [] }, locationCount: 1 });
    const c = evaluateRoomOne({ audit: { hasBookingSystem: false, reachable: true }, reviews: { count: 200, painPhrases: [mediumBooking] }, locationCount: 1 });
    expect([a.output.tier, b.output.tier, c.output.tier]).toEqual(["A", "B", "C"]);
    expect(packageFitScore(a, [])).toBe(80);
    expect(packageFitScore(b, [])).toBe(65);
    expect(packageFitScore(c, [])).toBe(50);
    expect(packageFitScore(a, ["map", "reviews"])).toBe(60);
  });
});

describe("roomOne — operator, plan assumption and discovery", () => {
  it("a hotel restaurant is no call, with the reason and no discovery questions", () => {
    const ev = evaluateRoomOne({
      audit: { bookingProvider: "OpenTable", operator: "hotel_fnb", operatorEvidence: "kempinski.com — otel alan adı" },
      reviews: { count: 0, painPhrases: [] },
      locationCount: 1,
    });
    expect(ev.output).toMatchObject({ wedge: "none", plan: "none", evidence: [] });
    expect(ev.blocked).toBe(true);
    expect(ev.blockReason).toMatch(/Otel F&B/);
    expect(ev.blockReason).toContain("kempinski.com");
    expect(ev.discoveryQuestions).toEqual([]);
    expect(ev.output.bans.join(" ")).toMatch(/Otel restoranına/);
    expect(packageFitScore(ev, [])).toBe(0);
  });

  it("a chain branch is no call: the head office decides", () => {
    const ev = evaluateRoomOne({
      audit: { bookingProvider: "OpenTable", operator: "chain", operatorEvidence: 'ad: "Gaucho Piccadilly" — bilinen zincir' },
      reviews: { count: 0, painPhrases: [] },
      locationCount: 12,
    });
    expect(ev.blocked).toBe(true);
    expect(ev.blockReason).toMatch(/Zincir şubesi/);
  });

  it("an owner-run small group is the Premium prospect and shows its proof", () => {
    const out = roomOne({
      audit: { operator: "small_group", operatorEvidence: "brand.example — aynı alan adında 3 şube" },
      reviews: { count: 0, painPhrases: [] },
      locationCount: 3,
    });
    expect(out).toMatchObject({ wedge: "multi_location", plan: "premium" });
    expect(out.evidence[0]).toBe("brand.example — aynı alan adında 3 şube");
  });

  const billReviews = {
    count: 200,
    painPhrases: [{ text: "slow bill", category: "bill", mentions: 9, complaintReviews: 40, recentMentions: 4, quote: "we waited ages for the bill" }],
  };

  it("with no table count the plan is a stated assumption from size proxies", () => {
    const small = roomOne({ audit: {}, reviews: billReviews, locationCount: 1, size: { reviewCount: 240, priceLevel: 2 } });
    expect(small.plan).toBe("starter");
    expect(small.planAssumption).toBe(
      "Paket varsayımı: Starter. Masa ve sipariş sayısı görülmedi (240 yorum, fiyat seviyesi 2); 20 masanın ve ayda 1.000 siparişin altı varsayıldı. İlk soruda doğrula.",
    );
    const large = roomOne({ audit: {}, reviews: billReviews, locationCount: 1, size: { reviewCount: 3200, priceLevel: 2 } });
    expect(large.plan).toBe("growth");
    expect(large.planAssumption).toMatch(/Growth\. Masa ve sipariş sayısı görülmedi \(3200 yorum, fiyat seviyesi 2\); 20 masanın veya ayda 1\.000 siparişin üstü/);
    const pricey = roomOne({ audit: {}, reviews: billReviews, locationCount: 1, size: { reviewCount: 150, priceLevel: 3 } });
    expect(pricey.plan).toBe("growth");
  });

  it("a seen table count or several languages is a fact, not an assumption", () => {
    expect(roomOne({ audit: { tableCount: 12 }, reviews: billReviews, locationCount: 1 }).planAssumption).toBeNull();
    const langs = roomOne({ audit: { languageCount: 3 }, reviews: billReviews, locationCount: 1 });
    expect(langs).toMatchObject({ plan: "growth", planAssumption: null });
  });

  it("a menu wedge with unknown language count says it assumed one language", () => {
    const out = roomOne({ audit: { pdfMenu: true }, reviews: { count: 0, painPhrases: [] }, locationCount: 1 });
    expect(out.plan).toBe("starter");
    expect(out.planAssumption).toMatch(/tek dil ve 100 ürünün altı varsayıldı/);
  });

  it("one venue gets Premium only on a seen table count above Growth's 50", () => {
    const big = roomOne({ audit: { tableCount: 70 }, reviews: billReviews, locationCount: 1 });
    expect(big).toMatchObject({ wedge: "bill_wait", plan: "premium", planAssumption: null });
    expect(big.bans.join(" ")).not.toMatch(/Tek şubeye Premium/);
    // A size proxy never lifts the plan past Growth.
    const proxy = roomOne({ audit: {}, reviews: billReviews, locationCount: 1, size: { reviewCount: 9000, priceLevel: 4 } });
    expect(proxy.plan).toBe("growth");
  });

  it("a group of 6-9 venues still gets a card, addressed above the branch", () => {
    const out = roomOne({
      audit: { operator: "group_hq", operatorEvidence: "brand.example — aynı alan adında 7 şube" },
      reviews: { count: 0, painPhrases: [] },
      locationCount: 7,
    });
    expect(out).toMatchObject({ wedge: "multi_location", plan: "premium" });
    expect(out.bans.join(" ")).toMatch(/işletme sahibini veya operasyon müdürünü ara/);
    expect(out.bans.join(" ")).toMatch(/fiyat şube başınadır/);
  });
});

describe("roomOne — rules from the playbook research", () => {
  const strongBooking = { text: "booking lost", category: "reservation", mentions: 9, complaintReviews: 40, recentMentions: 4, quote: "they had no record of our booking" };

  it("unknown review dates never make a strong signal", () => {
    const out = roomOne({
      audit: {},
      reviews: { count: 200, painPhrases: [{ text: "slow bill", category: "bill", mentions: 12, complaintReviews: 40, quote: "we waited ages for the bill" }] },
      locationCount: 1,
    });
    expect(out.wedge).toBe("none");
  });

  it("one recent review out of many is not enough for strong; two are", () => {
    const phrase = (recentMentions: number) => ({ text: "slow bill", category: "bill", mentions: 12, complaintReviews: 40, recentMentions, recent24Mentions: 5, quote: "we waited ages for the bill" });
    expect(roomOne({ audit: {}, reviews: { count: 200, painPhrases: [phrase(1)] }, locationCount: 1 }).wedge).toBe("none");
    expect(roomOne({ audit: {}, reviews: { count: 200, painPhrases: [phrase(2)] }, locationCount: 1 }).wedge).toBe("bill_wait");
  });

  it("a theme nobody mentioned in the last 24 months is no signal, not even medium", () => {
    const out = roomOne({
      audit: { reachable: true, hasBookingSystem: false },
      reviews: { count: 200, painPhrases: [{ text: "booking lost", category: "reservation", mentions: 6, complaintReviews: 40, recentMentions: 0, recent24Mentions: 0, quote: "they had no record of our booking" }] },
      locationCount: 1,
    });
    expect(out.wedge).toBe("none");
  });

  it("queuing for a table is a medium reservation signal, never strong", () => {
    const queue = { text: "queue despite booking", category: "table_wait", mentions: 20, complaintReviews: 40, recentMentions: 9, quote: "we had a booking and still waited 40 minutes for the table" };
    expect(roomOne({ audit: {}, reviews: { count: 200, painPhrases: [queue] }, locationCount: 1 }).wedge).toBe("none");
    const withSite = roomOne({ audit: { reachable: true, hasBookingSystem: false }, reviews: { count: 200, painPhrases: [queue] }, locationCount: 1 });
    expect(withSite).toMatchObject({ wedge: "reservation", tier: "C" });
  });

  it("slow food is the kitchen's problem: it opens nothing", () => {
    const out = roomOne({
      audit: { hasQrMenu: false },
      reviews: { count: 200, painPhrases: [{ text: "slow food", category: "kitchen_wait", mentions: 30, complaintReviews: 60, recentMentions: 12, quote: "the mains took over an hour to arrive" }] },
      locationCount: 1,
    });
    expect(out.wedge).toBe("none");
  });

  it("a venue running its own reservation software is not sold reservations", () => {
    const out = roomOne({ audit: { bookingProvider: "SevenRooms" }, reviews: { count: 200, painPhrases: [strongBooking] }, locationCount: 1 });
    expect(out.wedge).toBe("none");
    expect(out.bans.join(" ")).toMatch(/SevenRooms bir rezervasyon yazılımı/);
  });

  it("a review site is not a booking provider", () => {
    for (const provider of ["Tripadvisor", "Yelp", "Zomato"]) {
      expect(roomOne({ audit: { bookingProvider: provider }, reviews: { count: 0, painPhrases: [] }, locationCount: 1 }).wedge).toBe("none");
    }
    expect(roomOne({ audit: { bookingProvider: "Reztoran" }, reviews: { count: 0, painPhrases: [] }, locationCount: 1 }).wedge).toBe("reservation");
  });

  it("a venue that tells Google it takes no reservations is walk-in", () => {
    const out = roomOne({
      audit: { reachable: true, hasBookingSystem: false, acceptsReservations: false },
      reviews: { count: 200, painPhrases: [strongBooking] },
      locationCount: 1,
    });
    expect(out.wedge).toBe("none");
  });

  it("a pub is walk-in unless it links a booking provider", () => {
    const pub = roomOne({ audit: { venueType: "bar", reachable: true, hasBookingSystem: false }, reviews: { count: 200, painPhrases: [strongBooking] }, locationCount: 1 });
    expect(pub.wedge).toBe("none");
    const gastropub = roomOne({ audit: { venueType: "bar", bookingProvider: "OpenTable" }, reviews: { count: 0, painPhrases: [] }, locationCount: 1 });
    expect(gastropub.wedge).toBe("reservation");
  });

  it("delivery platforms seen only on the Google profile are not evidence", () => {
    const mapOnly = roomOne({
      audit: { deliveryPlatforms: ["Deliveroo", "Uber Eats"], marketplaceSource: "map", hasOnlineOrdering: false },
      reviews: { count: 0, painPhrases: [] },
      locationCount: 1,
    });
    expect(mapOnly.wedge).toBe("none");
    const onSite = roomOne({
      audit: { deliveryPlatforms: ["Deliveroo", "Uber Eats"], marketplaceSource: "site", hasOnlineOrdering: false },
      reviews: { count: 0, painPhrases: [] },
      locationCount: 1,
    });
    expect(onSite).toMatchObject({ wedge: "marketplace", plan: "starter" });
    expect(onSite.bans.join(" ")).toMatch(/Pazar yerini bırakın deme/);
  });

  it("every card bans the promises FineDine does not publish", () => {
    const bans = roomOne({ audit: {}, reviews: { count: 0, painPhrases: [] }, locationCount: 1 }).bans.join(" ");
    expect(bans).toMatch(/entegrasyon vaat etme/);
    expect(bans).toMatch(/Sadakat programı vaat etme/);
  });

  it("several venues come before the menu in the playbook order", () => {
    const out = roomOne({
      audit: { bookingProvider: "OpenTable", operator: "small_group" },
      reviews: { count: 0, painPhrases: [] },
      locationCount: 3,
    });
    expect(out).toMatchObject({ wedge: "reservation", backup: "multi_location" });
  });

  it("no wedge still gives the rep two fixed questions from what the audit saw", () => {
    const ev = evaluateRoomOne({
      audit: { reachable: true, hasBookingSystem: false, hasOnlineReservation: false, deliveryPlatforms: ["Deliveroo"], hasOnlineOrdering: true, hasQrMenu: true },
      reviews: { count: 0, painPhrases: [] },
      locationCount: 1,
    });
    expect(ev.output.wedge).toBe("none");
    expect(ev.discoveryQuestions).toEqual([
      "Online rezervasyon almıyorsunuz; telefonla yönetmek ne kadar vaktinizi alıyor?",
      "Yoğun saatte en çok hangi adım yavaşlıyor: sipariş almak mı, hesabı kapatmak mı?",
    ]);
  });

  it("a walk-in venue is never asked about reservations", () => {
    const ev = evaluateRoomOne({ audit: { venueType: "qsr", hasQrMenu: true, hasOnlineOrdering: true }, reviews: { count: 0, painPhrases: [] }, locationCount: 1 });
    expect(ev.discoveryQuestions.join(" ")).not.toMatch(/[Rr]ezervasyon/);
  });
});
