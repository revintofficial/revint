/**
 * Beta finding §4 — deterministic package selector.
 *
 * Pins down the tier-decision boundary cases identified in the
 * FineDine beta:
 *
 *   - Six small/independent FineDine cafés (≤200 reviews, no hotel,
 *     0-1 pain points) must land on Base. Premium was being picked
 *     for cafés that didn't deserve it because Gemini saw the
 *     `isPopular` badge.
 *   - Pied a Terre (200+ reviews, fine dining, multiple ops pains)
 *     must land on Premium. Falling to Base on that lead would be
 *     leaving real ARR on the table.
 *   - Any hotel restaurant must escalate to Enterprise regardless of
 *     pain count.
 *   - Multi-location chains escalate to Enterprise even when small.
 *   - Workspaces with fewer than 3 packages reuse the last entry —
 *     a 1-package workspace returns that single id; a 2-package
 *     workspace returns id[1] for premium AND enterprise tiers.
 */
import { describe, expect, it } from "vitest";
import { selectPackage } from "@/lib/agent-workers/package-selector";

const PACKAGES = [
  { id: "pkg-base", name: "Base", sortOrder: 0 },
  { id: "pkg-premium", name: "Premium", sortOrder: 1 },
  { id: "pkg-enterprise", name: "Enterprise", sortOrder: 2 },
];

describe("Beta §4 — selectPackage()", () => {
  describe("FineDine beta cafés (4× Base, 2× Premium expected)", () => {
    // Six FineDine beta leads, paraphrased from
    // research/finedine/beta-test-analysis-report.md.
    // Each "café" describes the operational signals available.
    const FIXTURES: Array<{
      name: string;
      input: Parameters<typeof selectPackage>[0];
      expectedTier: "base" | "premium" | "enterprise";
    }> = [
      {
        name: "Black Eye Coffee — 80 reviews, instagram-only, 0 pains",
        input: {
          reviewCount: 80,
          rating: 4.7,
          hasMultipleLocations: false,
          isHotel: false,
          servicePackages: PACKAGES,
          painPointCount: 0,
        },
        expectedTier: "base",
      },
      {
        name: "Brewed London — 120 reviews, 1 pain, single site",
        input: {
          reviewCount: 120,
          rating: 4.5,
          hasMultipleLocations: false,
          isHotel: false,
          servicePackages: PACKAGES,
          painPointCount: 1,
        },
        expectedTier: "base",
      },
      {
        name: "Coffee & Beyond — 60 reviews, 1 pain",
        input: {
          reviewCount: 60,
          rating: 4.3,
          hasMultipleLocations: false,
          isHotel: false,
          servicePackages: PACKAGES,
          painPointCount: 1,
        },
        expectedTier: "base",
      },
      {
        name: "Bunk Brew — 40 reviews, no pains",
        input: {
          reviewCount: 40,
          rating: 4.4,
          hasMultipleLocations: false,
          isHotel: false,
          servicePackages: PACKAGES,
          painPointCount: 0,
        },
        expectedTier: "base",
      },
      {
        name: "Blackheath Bistro — 320 reviews, 1 pain (high volume)",
        input: {
          reviewCount: 320,
          rating: 4.4,
          hasMultipleLocations: false,
          isHotel: false,
          servicePackages: PACKAGES,
          painPointCount: 1,
        },
        expectedTier: "premium",
      },
      {
        name: "Pied a Terre — 250 reviews, 3 ops pains, single site",
        input: {
          reviewCount: 250,
          rating: 4.7,
          hasMultipleLocations: false,
          isHotel: false,
          servicePackages: PACKAGES,
          painPointCount: 3,
        },
        expectedTier: "premium",
      },
    ];

    FIXTURES.forEach((fx) => {
      it(`${fx.name} -> ${fx.expectedTier}`, () => {
        const result = selectPackage(fx.input);
        expect(result.tier).toBe(fx.expectedTier);
      });
    });

    it("aggregates to 4× base + 2× premium overall", () => {
      const tally = { base: 0, premium: 0, enterprise: 0 } as Record<
        string,
        number
      >;
      FIXTURES.forEach((fx) => {
        tally[selectPackage(fx.input).tier] += 1;
      });
      expect(tally).toEqual({ base: 4, premium: 2, enterprise: 0 });
    });
  });

  describe("hotel + multi-location escalation", () => {
    it("hotel restaurant always lands on enterprise", () => {
      const result = selectPackage({
        reviewCount: 30,
        rating: 4.0,
        hasMultipleLocations: false,
        isHotel: true,
        servicePackages: PACKAGES,
        painPointCount: 0,
      });
      expect(result.tier).toBe("enterprise");
      expect(result.reason).toBe("hotel_property");
    });

    it("multi-location lead always lands on enterprise", () => {
      const result = selectPackage({
        reviewCount: 50,
        rating: 4.2,
        hasMultipleLocations: true,
        isHotel: false,
        servicePackages: PACKAGES,
        painPointCount: 0,
      });
      expect(result.tier).toBe("enterprise");
      expect(result.reason).toBe("multi_location");
    });

    it("hotel takes precedence over chain (both -> enterprise, hotel reason)", () => {
      const result = selectPackage({
        reviewCount: 100,
        rating: 4.5,
        hasMultipleLocations: true,
        isHotel: true,
        servicePackages: PACKAGES,
        painPointCount: 5,
      });
      expect(result.tier).toBe("enterprise");
      expect(result.reason).toBe("hotel_property");
    });
  });

  describe("premium drivers", () => {
    it("≥2 pain points -> premium even on small reviews", () => {
      const result = selectPackage({
        reviewCount: 50,
        rating: 4.0,
        hasMultipleLocations: false,
        isHotel: false,
        servicePackages: PACKAGES,
        painPointCount: 2,
      });
      expect(result.tier).toBe("premium");
      expect(result.reason).toBe("multiple_pain_points");
    });

    it("review_count > 300 alone is enough", () => {
      const result = selectPackage({
        reviewCount: 350,
        rating: 4.4,
        hasMultipleLocations: false,
        isHotel: false,
        servicePackages: PACKAGES,
        painPointCount: 0,
      });
      expect(result.tier).toBe("premium");
      expect(result.reason).toBe("high_review_volume");
    });

    it("both signals -> premium with combined reason", () => {
      const result = selectPackage({
        reviewCount: 400,
        rating: 4.5,
        hasMultipleLocations: false,
        isHotel: false,
        servicePackages: PACKAGES,
        painPointCount: 4,
      });
      expect(result.tier).toBe("premium");
      expect(result.reason).toBe("high_volume_high_pain");
    });
  });

  describe("workspace package count edge cases", () => {
    it("returns null id when no packages are configured", () => {
      const result = selectPackage({
        reviewCount: 100,
        rating: 4.0,
        hasMultipleLocations: false,
        isHotel: false,
        servicePackages: [],
        painPointCount: 0,
      });
      expect(result.id).toBeNull();
      expect(result.reason).toBe("no_packages_configured");
    });

    it("1-package workspace falls back to that id for every tier", () => {
      const single = [{ id: "pkg-only", name: "Only", sortOrder: 0 }];
      // Hotel scenario would normally pick enterprise; with one package
      // it must reuse the only available id.
      const result = selectPackage({
        reviewCount: 100,
        rating: 4.0,
        hasMultipleLocations: false,
        isHotel: true,
        servicePackages: single,
        painPointCount: 0,
      });
      expect(result.id).toBe("pkg-only");
      expect(result.tier).toBe("enterprise");
    });

    it("2-package workspace reuses premium for enterprise tier", () => {
      const two = [
        { id: "pkg-base", name: "Base", sortOrder: 0 },
        { id: "pkg-premium", name: "Premium", sortOrder: 1 },
      ];
      const result = selectPackage({
        reviewCount: 50,
        rating: 4.0,
        hasMultipleLocations: false,
        isHotel: true, // would normally land enterprise
        servicePackages: two,
        painPointCount: 0,
      });
      expect(result.id).toBe("pkg-premium");
      expect(result.tier).toBe("enterprise");
    });

    it("respects sortOrder, not array order", () => {
      // Pass packages out of natural order; selector must still pick
      // the cheapest tier (sortOrder=0) for a small lead.
      const shuffled = [
        { id: "pkg-enterprise", name: "Enterprise", sortOrder: 2 },
        { id: "pkg-base", name: "Base", sortOrder: 0 },
        { id: "pkg-premium", name: "Premium", sortOrder: 1 },
      ];
      const result = selectPackage({
        reviewCount: 30,
        rating: 4.5,
        hasMultipleLocations: false,
        isHotel: false,
        servicePackages: shuffled,
        painPointCount: 0,
      });
      expect(result.id).toBe("pkg-base");
      expect(result.tier).toBe("base");
    });
  });
});
