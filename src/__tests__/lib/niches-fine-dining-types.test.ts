/**
 * Phase 2.3 — Sub-niche Places type expansion + fine-dining auto-assign.
 *
 * Beta finding §5: Pied à Terre's Google Places `primaryType` comes
 * back as `"french_restaurant"` with no `fine_dining_restaurant`
 * marker. Without the type expansion + the auto-assign rule, the
 * lead falls through into the parent `fnb` pack with low confidence
 * and the opener pitches generic restaurant copy instead of the
 * white-glove fine-dining angle.
 *
 * These tests pin down BOTH halves of the fix:
 *   1. The type-only matcher (`findNichePackForPrimaryType`) now
 *      returns `fnb-fine-dining` for cuisine subtypes.
 *   2. The deterministic `autoAssignFineDining` helper promotes a
 *      lead with rating ≥ 4.5 + reviews ≥ 200 + priceLevel ≥ 3 to
 *      `fnb-fine-dining` at confidence 0.85, regardless of what the
 *      rule pass returned.
 *
 * The auto-assign rule sits BEFORE the rule-default fallback in
 * `subvertical-classifier.ts` so a Pied à Terre never lands at
 * `subNicheSlug = null` again.
 */
import { describe, expect, it } from "vitest";
import {
  autoAssignFineDining,
  findNichePackForPrimaryType,
} from "@/lib/niches";

describe("Phase 2.3 — fine-dining Places type expansion", () => {
  it("french_restaurant maps to fnb-fine-dining (Pied à Terre case)", () => {
    const pack = findNichePackForPrimaryType("french_restaurant");
    expect(pack?.slug).toBe("fnb-fine-dining");
  });

  it("italian_restaurant, japanese_restaurant, modern_european_restaurant all map to fnb-fine-dining", () => {
    for (const type of [
      "italian_restaurant",
      "japanese_restaurant",
      "modern_european_restaurant",
      "scandinavian_restaurant",
      "spanish_restaurant",
      "mediterranean_restaurant",
      "steak_house",
      "seafood_restaurant",
    ]) {
      const pack = findNichePackForPrimaryType(type);
      expect(pack?.slug, `${type} should map to fnb-fine-dining`).toBe(
        "fnb-fine-dining",
      );
    }
  });

  it("fine_dining_restaurant still resolves (legacy callers shouldn't break)", () => {
    const pack = findNichePackForPrimaryType("fine_dining_restaurant");
    expect(pack?.slug).toBe("fnb-fine-dining");
  });

  it("café-style daytime subtypes route to fnb-cafe-bakery, NOT fine dining", () => {
    for (const type of ["brunch_restaurant", "breakfast_restaurant", "tea_house"]) {
      const pack = findNichePackForPrimaryType(type);
      expect(pack?.slug, `${type} should map to fnb-cafe-bakery`).toBe(
        "fnb-cafe-bakery",
      );
    }
  });

  it("returns null for unknown primaryType (caller falls back to generic)", () => {
    expect(findNichePackForPrimaryType("auto_repair_shop")).toBeNull();
    expect(findNichePackForPrimaryType("")).toBeNull();
    expect(findNichePackForPrimaryType(null)).toBeNull();
    expect(findNichePackForPrimaryType(undefined)).toBeNull();
  });
});

describe("Phase 2.3 — autoAssignFineDining()", () => {
  it("promotes Pied à Terre to fnb-fine-dining at confidence 0.85", () => {
    const result = autoAssignFineDining({
      parentSlug: "fnb",
      rating: 4.7,
      reviewCount: 250,
      priceLevel: 4,
    });
    expect(result).not.toBeNull();
    expect(result!.slug).toBe("fnb-fine-dining");
    expect(result!.confidence).toBe(0.85);
    expect(result!.reason).toMatch(/rating=4\.7/);
    expect(result!.reason).toMatch(/reviews=250/);
    expect(result!.reason).toMatch(/priceLevel=4/);
  });

  it("promotes at the exact thresholds (rating=4.5, reviews=200, priceLevel=3)", () => {
    const result = autoAssignFineDining({
      parentSlug: "fnb",
      rating: 4.5,
      reviewCount: 200,
      priceLevel: 3,
    });
    expect(result?.slug).toBe("fnb-fine-dining");
  });

  it("rejects when rating is below 4.5", () => {
    const result = autoAssignFineDining({
      parentSlug: "fnb",
      rating: 4.4,
      reviewCount: 250,
      priceLevel: 4,
    });
    expect(result).toBeNull();
  });

  it("rejects when reviewCount is below 200 (low-evidence guard)", () => {
    const result = autoAssignFineDining({
      parentSlug: "fnb",
      rating: 4.8,
      reviewCount: 199,
      priceLevel: 4,
    });
    expect(result).toBeNull();
  });

  it("rejects when priceLevel is below 3 (must be 'expensive' or above)", () => {
    const result = autoAssignFineDining({
      parentSlug: "fnb",
      rating: 4.9,
      reviewCount: 1000,
      priceLevel: 2,
    });
    expect(result).toBeNull();
  });

  it("rejects when parentSlug is not 'fnb' (rule is F&B-only)", () => {
    const result = autoAssignFineDining({
      parentSlug: "dental",
      rating: 4.9,
      reviewCount: 1000,
      priceLevel: 4,
    });
    expect(result).toBeNull();
  });

  it("treats null priceLevel / rating / reviewCount as 'unknown' (rejects)", () => {
    expect(
      autoAssignFineDining({
        parentSlug: "fnb",
        rating: null,
        reviewCount: 250,
        priceLevel: 4,
      }),
    ).toBeNull();
    expect(
      autoAssignFineDining({
        parentSlug: "fnb",
        rating: 4.9,
        reviewCount: null,
        priceLevel: 4,
      }),
    ).toBeNull();
    expect(
      autoAssignFineDining({
        parentSlug: "fnb",
        rating: 4.9,
        reviewCount: 250,
        priceLevel: null,
      }),
    ).toBeNull();
  });
});
