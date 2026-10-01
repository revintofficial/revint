// @vitest-environment node
import { describe, expect, it } from "vitest";
import { formatRate, median, wilson } from "@/lib/control/stats";

describe("wilson", () => {
  it("matches the published wilson half widths at p=0.8", () => {
    expect(wilson(24, 30).high - wilson(24, 30).low).toBeCloseTo(0.29, 1);
    expect(wilson(40, 50).high - wilson(40, 50).low).toBeCloseTo(0.226, 1);
    expect(wilson(80, 100).high - wilson(80, 100).low).toBeCloseTo(0.156, 1);
    expect(wilson(160, 200).high - wilson(160, 200).low).toBeCloseTo(0.11, 1);
  });

  it("is not decidable at twenty items", () => {
    expect(wilson(12, 20).decidable).toBe(false);
  });

  it("is not decidable with no items", () => {
    expect(wilson(0, 0)).toMatchObject({ n: 0, decidable: false });
  });

  it("is decidable from fifty items when the interval is narrow enough", () => {
    expect(wilson(40, 50).decidable).toBe(true);
    // p=0.5 at n=50 is ±0.137, wider than 0.25 in total.
    expect(wilson(25, 50).decidable).toBe(false);
  });

  it("keeps the interval inside zero and one", () => {
    const all = wilson(50, 50);
    expect(all.high).toBeLessThanOrEqual(1);
    expect(all.low).toBeGreaterThan(0.9);
    expect(wilson(0, 50).low).toBe(0);
  });
});

describe("formatRate", () => {
  it("never prints a bare rate", () => {
    expect(formatRate(12, 20)).toBe("%60 (12/20) · %39–%78 · karar için yetersiz");
  });

  it("drops the warning once decidable", () => {
    expect(formatRate(80, 100)).toBe("%80 (80/100) · %71–%87");
  });

  it("says there is no data at zero", () => {
    expect(formatRate(0, 0)).toBe("Veri yok · karar için yetersiz");
  });
});

describe("median", () => {
  it("handles odd, even, and empty inputs", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});
