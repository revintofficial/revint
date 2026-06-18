/**
 * Package draft sanitization, dedupe, and confirmation validation.
 */
import { describe, expect, it } from "vitest";
import {
  sanitizePackageDrafts,
  validateConfirmedPackages,
} from "@/lib/onboarding/packages";

describe("sanitizePackageDrafts", () => {
  it("dedupes by case-insensitive name and re-indexes sortOrder", () => {
    const { packages, droppedDuplicates } = sanitizePackageDrafts([
      { name: "Starter", priceLabel: "$10", features: ["a"] },
      { name: "starter", priceLabel: "$20" },
      { name: "Pro", priceLabel: "$99", isPopular: true },
    ]);
    expect(packages.map((p) => p.name)).toEqual(["Starter", "Pro"]);
    expect(droppedDuplicates).toEqual(["starter"]);
    expect(packages.map((p) => p.sortOrder)).toEqual([0, 1]);
    expect(packages[1].isPopular).toBe(true);
  });

  it("drops entries without a name and defaults price", () => {
    const { packages } = sanitizePackageDrafts([
      { name: "", priceLabel: "$1" },
      { name: "Solo" },
    ]);
    expect(packages).toHaveLength(1);
    expect(packages[0].priceLabel).toBe("Contact for pricing");
  });

  it("caps features at 8 and tolerates non-arrays", () => {
    const { packages } = sanitizePackageDrafts([
      { name: "X", features: Array.from({ length: 20 }, (_, i) => `f${i}`) },
      { name: "Y", features: "not-array" },
    ]);
    expect(packages[0].features).toHaveLength(8);
    expect(packages[1].features).toEqual([]);
  });

  it("returns empty list for non-array input", () => {
    expect(sanitizePackageDrafts(null).packages).toEqual([]);
    expect(sanitizePackageDrafts({}).packages).toEqual([]);
  });
});

describe("validateConfirmedPackages", () => {
  it("requires at least one package", () => {
    expect(validateConfirmedPackages([])).toMatch(/at least one/i);
  });

  it("passes a valid set", () => {
    const { packages } = sanitizePackageDrafts([{ name: "Solo", priceLabel: "$1" }]);
    expect(validateConfirmedPackages(packages)).toBeNull();
  });
});
