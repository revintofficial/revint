/**
 * The model labels each review; the code verifies every quote and
 * counts. These tests pin the counting and the bill / price guard.
 */
import { describe, expect, it } from "vitest";
import { guardPainCategory, toPainPhrases, toReviewLabels, type PainPhrase } from "@/lib/review-analysis/pain-phrases";
import { countReviewLabels, mergeLabelCounts, verifyPainQuotes } from "@/lib/review-analysis/quote-verify";

const NOW = new Date("2026-10-01T00:00:00Z");
const REVIEWS = [
  { text: "Lovely pasta, but we waited 25 minutes for the bill and had to chase it twice.", publishTime: new Date("2026-08-01") },
  { text: "Great food. Getting the bill took forever though!", publishTime: new Date("2026-03-10") },
  { text: "Best cacio e pepe in London.", publishTime: new Date("2026-02-01") },
  { text: "Nobody came to take our order for twenty minutes, we nearly left.", publishTime: new Date("2024-01-15") },
  { text: "The bill that followed was astronomically high for what we ate.", publishTime: new Date("2026-06-20") },
  { text: null, publishTime: new Date("2026-06-21") },
  { text: "Waited ages for the bill again, and the card machine was broken.", publishTime: new Date("2023-11-02") },
];

describe("guardPainCategory", () => {
  it("keeps a real bill wait as bill", () => {
    expect(guardPainCategory("bill", "we waited 25 minutes for the bill")).toBe("bill");
    expect(guardPainCategory("bill", "card machine never came")).toBe("bill");
    expect(guardPainCategory("bill", "they would not split the bill")).toBe("bill");
    expect(guardPainCategory("bill", "expensive, and the bill took forever")).toBe("bill");
  });

  it("moves the three sentences from the historical data out of bill", () => {
    expect(guardPainCategory("bill", "the bill that followed was astronomically high")).toBe("price");
    expect(guardPainCategory("bill", "paying by card adds tax")).toBe("price");
    expect(guardPainCategory("bill", "they kept adding stuff to my bill")).toBe("order_error");
  });

  it("reads Turkish price complaints", () => {
    expect(guardPainCategory("bill", "hesap çok pahalı geldi")).toBe("price");
    expect(guardPainCategory("bill", "fiyata göre fazla ödedik")).toBe("price");
    expect(guardPainCategory("bill", "hesabı 20 dakika bekledik")).toBe("bill");
  });

  it("leaves every other category alone", () => {
    expect(guardPainCategory("reservation", "the booking was expensive")).toBe("reservation");
    expect(guardPainCategory(undefined, "expensive")).toBeUndefined();
  });
});

describe("toPainPhrases — categories", () => {
  it("applies the guard and forces unsellable categories to false", () => {
    const [price, staff, wait] = toPainPhrases([
      { text: "the bill was astronomically high", sellable: true, category: "bill", quotes: [] },
      { text: "waiter was rude while we waited", sellable: true, category: "staff", quotes: [] },
      { text: "nobody came to take our order", sellable: true, category: "order_wait", quotes: [] },
    ]);
    expect(price).toMatchObject({ category: "price", sellable: false });
    expect(staff).toMatchObject({ category: "staff", sellable: false });
    expect(wait).toMatchObject({ category: "order_wait", sellable: true });
  });

  it("no longer forces a payment word to sellable", () => {
    const [p] = toPainPhrases([{ text: "not worth what you pay", sellable: false, category: "price", quotes: [] }]);
    expect(p.sellable).toBe(false);
  });
});

describe("toReviewLabels", () => {
  it("keeps well-formed labels and drops the rest", () => {
    const labels = toReviewLabels([
      { i: 1, category: "bill", quote: "we waited 25 minutes for the bill" },
      { i: 0, category: "bill", quote: "zero is not a review number" },
      { i: 2, category: "vibes", quote: "unknown category" },
      { i: 3, category: "menu", quote: "   " },
      "nope",
      { i: 4.9, category: "order_wait", quote: "Nobody came to take our order" },
    ]);
    expect(labels).toEqual([
      { i: 1, category: "bill", quote: "we waited 25 minutes for the bill" },
      { i: 4, category: "order_wait", quote: "Nobody came to take our order" },
    ]);
    expect(toReviewLabels(null)).toEqual([]);
  });
});

describe("countReviewLabels", () => {
  const labels = toReviewLabels([
    { i: 1, category: "bill", quote: "we waited 25 minutes for the bill" },
    { i: 1, category: "bill", quote: "had to chase it twice" }, // same review, same category: once
    { i: 2, category: "bill", quote: "Getting the bill took forever" },
    { i: 4, category: "order_wait", quote: "Nobody came to take our order for twenty minutes" },
    { i: 5, category: "bill", quote: "The bill that followed was astronomically high" }, // really price
    { i: 3, category: "bill", quote: "Waited ages for the bill again" }, // wrong index, found in review 7
    { i: 3, category: "menu", quote: "the menu had no allergen information" }, // nobody wrote this
    { i: 2, category: "bill", quote: "the bill" }, // too short to be evidence
  ]);
  const counts = countReviewLabels(labels, REVIEWS, NOW);

  it("counts distinct reviews per category, only for quotes found in a review", () => {
    expect(counts.byCategory.bill?.mentions).toBe(3);
    expect(counts.byCategory.order_wait?.mentions).toBe(1);
    expect(counts.byCategory.menu).toBeUndefined();
  });

  it("re-labels a price complaint the model called bill", () => {
    expect(counts.byCategory.price?.mentions).toBe(1);
  });

  it("uses every review with a verified complaint as the denominator, whatever its stars", () => {
    expect(counts.complaintReviews).toBe(5);
  });

  it("counts how many are from the last 12 months", () => {
    expect(counts.byCategory.bill?.recentMentions).toBe(2);
    expect(counts.byCategory.order_wait?.recentMentions).toBe(0);
  });

  it("returns null recency when no review carries a date", () => {
    const undated = countReviewLabels(labels, REVIEWS.map((r) => r.text), NOW);
    expect(undated.byCategory.bill).toMatchObject({ mentions: 3, recentMentions: null });
  });

  it("keeps the verified quotes in review order", () => {
    expect(counts.byCategory.bill?.quotes).toEqual([
      "we waited 25 minutes for the bill",
      "Getting the bill took forever",
      "Waited ages for the bill again",
    ]);
  });
});

describe("mergeLabelCounts", () => {
  const labels = toReviewLabels([
    { i: 1, category: "bill", quote: "we waited 25 minutes for the bill" },
    { i: 2, category: "bill", quote: "Getting the bill took forever" },
    { i: 7, category: "bill", quote: "Waited ages for the bill again" },
    { i: 4, category: "order_wait", quote: "Nobody came to take our order for twenty minutes" },
    { i: 7, category: "order_wait", quote: "the card machine was broken" },
    { i: 5, category: "price", quote: "The bill that followed was astronomically high" },
    { i: 3, category: "price", quote: "Best cacio e pepe in London" },
  ]);
  const counts = countReviewLabels(labels, REVIEWS, NOW);

  it("lifts a phrase to its category count and carries the denominator and recency", () => {
    const phrases: PainPhrase[] = verifyPainQuotes(
      toPainPhrases([{ text: "slow bill", sellable: true, category: "bill", quotes: ["we waited 25 minutes for the bill"] }]),
      REVIEWS,
      NOW,
    );
    const [bill] = mergeLabelCounts(phrases, counts);
    expect(bill).toMatchObject({ category: "bill", mentions: 3, recentMentions: 2, complaintReviews: counts.complaintReviews });
    expect(bill.quotes).toEqual([
      "we waited 25 minutes for the bill",
      "Getting the bill took forever",
      "Waited ages for the bill again",
    ]);
  });

  it("adds a phrase for a counted sellable category nobody summarised", () => {
    const merged = mergeLabelCounts([], counts);
    const categories = merged.map((p) => p.category).sort();
    expect(categories).toEqual(["bill", "order_wait"]);
    expect(merged.find((p) => p.category === "order_wait")).toMatchObject({ sellable: true, mentions: 2 });
  });

  it("never adds a phrase for price or other unsellable categories", () => {
    expect(mergeLabelCounts([], counts).some((p) => p.category === "price")).toBe(false);
  });

  it("leaves the phrases untouched when the model returned no labels", () => {
    const phrases: PainPhrase[] = [{ text: "slow bill", sellable: true, category: "bill", quotes: [], mentions: 0 }];
    expect(mergeLabelCounts(phrases, countReviewLabels([], REVIEWS, NOW))).toBe(phrases);
  });
});

describe("verifyPainQuotes — recency", () => {
  it("records how many of the verified reviews are recent", () => {
    const [p] = verifyPainQuotes(
      [{ text: "slow bill", sellable: true, category: "bill", quotes: ["we waited 25 minutes for the bill", "Waited ages for the bill again"] }],
      REVIEWS,
      NOW,
    );
    expect(p).toMatchObject({ mentions: 2, recentMentions: 1 });
  });
});
