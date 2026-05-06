/**
 * Round 2 §3.3 + §3.9 — `humanizePrimaryType` and
 * `isSocialPlatformDefaultMeta` regression coverage.
 *
 * Pins down:
 *   1. Google Places `primaryType` snake_case enums render as title-case
 *      ("coffee_shop" → "Coffee Shop"), with niche-aware overrides for
 *      the two known FineDine misclassifications (Black Sheep
 *      `food_store`, YBA Brazil `acai_shop`).
 *   2. Empty / null / "" inputs render as the em-dash placeholder
 *      ("—") instead of the literal string "null" / "undefined".
 *   3. `isSocialPlatformDefaultMeta` matches the Instagram / Facebook /
 *      TikTok / X / LinkedIn login-page default copy that pre-Round-1
 *      audits captured into `metaDescription`. Real business copy must
 *      NOT match.
 */
import { describe, expect, it } from "vitest";
import {
  humanizePrimaryType,
  isSocialPlatformDefaultMeta,
} from "@/lib/labels";

describe("humanizePrimaryType", () => {
  it("title-cases generic snake_case primary types", () => {
    expect(humanizePrimaryType("coffee_shop")).toBe("Coffee Shop");
    expect(humanizePrimaryType("bar")).toBe("Bar");
    expect(humanizePrimaryType("cafe")).toBe("Cafe");
  });

  it("uses niche-aware overrides for known Google misclassifications", () => {
    // Black Sheep — Google returned `food_store` for a chain coffee shop
    expect(humanizePrimaryType("food_store")).toBe("Coffee Shop / Chain");
    // YBA Brazil — Google returned `acai_shop`
    expect(humanizePrimaryType("acai_shop")).toBe("Açaí & Coffee Shop");
  });

  it("returns the em-dash for empty / null / whitespace", () => {
    expect(humanizePrimaryType(null)).toBe("—");
    expect(humanizePrimaryType(undefined)).toBe("—");
    expect(humanizePrimaryType("")).toBe("—");
    expect(humanizePrimaryType("   ")).toBe("—");
  });
});

describe("isSocialPlatformDefaultMeta", () => {
  it("matches Instagram default login copy (Coffee Couch, YBA Brazil)", () => {
    expect(
      isSocialPlatformDefaultMeta(
        "Create an account or log in to Instagram - Share what you're into with the people who get you.",
      ),
    ).toBe(true);
  });

  it("matches Facebook default copy", () => {
    expect(
      isSocialPlatformDefaultMeta(
        "See posts, photos and more on Facebook",
      ),
    ).toBe(true);
    expect(
      isSocialPlatformDefaultMeta("Log in to Facebook to start sharing"),
    ).toBe(true);
  });

  it("does NOT match real business meta_description copy", () => {
    expect(
      isSocialPlatformDefaultMeta(
        "FineDine — modern QR menu for restaurants",
      ),
    ).toBe(false);
    expect(
      isSocialPlatformDefaultMeta(
        "The best coffee in Camden, locally roasted, third-wave.",
      ),
    ).toBe(false);
  });

  it("returns false for null / empty / non-string inputs", () => {
    expect(isSocialPlatformDefaultMeta(null)).toBe(false);
    expect(isSocialPlatformDefaultMeta(undefined)).toBe(false);
    expect(isSocialPlatformDefaultMeta("")).toBe(false);
    expect(isSocialPlatformDefaultMeta("   ")).toBe(false);
  });
});
