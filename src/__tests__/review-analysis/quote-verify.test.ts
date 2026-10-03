import { describe, expect, it } from "vitest";
import { toPainPhrases } from "@/lib/review-analysis/pain-phrases";
import { verifyPainQuotes } from "@/lib/review-analysis/quote-verify";

const REVIEWS = [
  "Lovely pasta, but we waited 25 minutes for the bill and had to chase it twice.",
  "Great food. Getting the bill took forever though!",
  "Best cacio e pepe in London.",
  null,
];

describe("toPainPhrases", () => {
  it("keeps a valid category and up to five quotes, and drops an unknown category", () => {
    const [a, b] = toPainPhrases([
      { text: "slow bill", sellable: true, category: "bill", quotes: ["q1", "q2", "q3", "q4", "q5", "q6", 7] },
      { text: "rude staff", sellable: false, category: "vibes" },
    ]);
    expect(a.category).toBe("bill");
    expect(a.quotes).toEqual(["q1", "q2", "q3", "q4", "q5"]);
    expect(b.category).toBeUndefined();
    expect(b.quotes).toEqual([]);
  });

  it("still accepts legacy bare strings", () => {
    expect(toPainPhrases(["waited ages"])[0]).toMatchObject({ text: "waited ages", quotes: [] });
  });
});

describe("verifyPainQuotes", () => {
  it("counts distinct reviews whose text contains a quote", () => {
    const [p] = verifyPainQuotes(
      [{ text: "slow bill", sellable: true, category: "bill", quotes: ["we waited 25 minutes for the bill", "Getting the bill took forever"] }],
      REVIEWS,
    );
    expect(p.mentions).toBe(2);
    expect(p.quotes).toEqual(["we waited 25 minutes for the bill", "Getting the bill took forever"]);
  });

  it("drops a paraphrase the model wrote itself", () => {
    const [p] = verifyPainQuotes(
      [{ text: "slow bill", sellable: true, category: "bill", quotes: ["Guests complain about slow payment"] }],
      REVIEWS,
    );
    expect(p.mentions).toBe(0);
    expect(p.quotes).toEqual([]);
  });

  it("counts two quotes from the same review once", () => {
    const [p] = verifyPainQuotes(
      [{ text: "slow bill", sellable: true, quotes: ["waited 25 minutes for the bill", "had to chase it twice"] }],
      REVIEWS,
    );
    expect(p.mentions).toBe(1);
    expect(p.quotes).toEqual(["waited 25 minutes for the bill"]);
  });

  it("ignores quotes too short to be evidence and tolerates punctuation and case", () => {
    const [p] = verifyPainQuotes(
      [{ text: "bill", sellable: true, quotes: ["the bill", "GETTING THE BILL took forever, though"] }],
      REVIEWS,
    );
    expect(p.mentions).toBe(1);
  });

  it("gives zero mentions to a phrase with no quotes", () => {
    expect(verifyPainQuotes([{ text: "x", sellable: true }], REVIEWS)[0].mentions).toBe(0);
  });
});
