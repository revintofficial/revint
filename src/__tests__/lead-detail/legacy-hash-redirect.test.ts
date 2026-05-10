/**
 * Phase 0 unit — legacy-hash → v2 mapping table.
 *
 * Covers every entry from PLAN §3.2 plus an unknown-hash case.
 */
import { describe, expect, it } from "vitest";
import {
  getRedirectTarget,
  LEGACY_HASHES,
} from "@/lib/lead-detail/legacy-hash-redirect";

interface ExpectedAction {
  kind: "scroll" | "navigate" | "noop";
  target?: string;
}

const CASES: Array<[string, ExpectedAction]> = [
  ["#overview", { kind: "noop" }],
  ["#outreach", { kind: "scroll", target: "next-gesture-block" }],
  ["#anchor-sales-opportunity", { kind: "scroll", target: "next-gesture-block" }],
  // Phase 6: workers hashes navigate to the dedicated /workers route.
  ["#workers", { kind: "navigate", target: "/workers" }],
  ["#anchor-workers-top", { kind: "navigate", target: "/workers" }],
  ["#reviews", { kind: "scroll", target: "history-block" }],
  ["#website", { kind: "scroll", target: "why-now-block" }],
];

describe("getRedirectTarget — table coverage", () => {
  it.each(CASES)("hash %s maps to expected action", (hash, expected) => {
    const result = getRedirectTarget(hash);
    expect(result.kind).toBe(expected.kind);
    if (expected.target === undefined) {
      expect(result.target).toBeUndefined();
    } else {
      expect(result.target).toBe(expected.target);
    }
  });
});

describe("getRedirectTarget — edge cases", () => {
  it("unknown hash returns noop", () => {
    expect(getRedirectTarget("#unknown-hash-not-in-table")).toEqual({
      kind: "noop",
    });
  });

  it("empty hash returns noop", () => {
    expect(getRedirectTarget("")).toEqual({ kind: "noop" });
  });

  it("null hash returns noop", () => {
    expect(getRedirectTarget(null)).toEqual({ kind: "noop" });
  });

  it("undefined hash returns noop", () => {
    expect(getRedirectTarget(undefined)).toEqual({ kind: "noop" });
  });

  it("just '#' returns noop", () => {
    expect(getRedirectTarget("#")).toEqual({ kind: "noop" });
  });

  it("normalizes case-insensitively", () => {
    expect(getRedirectTarget("#WORKERS")).toEqual({
      kind: "navigate",
      target: "/workers",
    });
    expect(getRedirectTarget("#OuTrEaCh")).toEqual({
      kind: "scroll",
      target: "next-gesture-block",
    });
  });

  it("accepts hash without leading #", () => {
    expect(getRedirectTarget("reviews")).toEqual({
      kind: "scroll",
      target: "history-block",
    });
  });

  it("LEGACY_HASHES exports every key handled by the table", () => {
    expect(LEGACY_HASHES).toContain("overview");
    expect(LEGACY_HASHES).toContain("outreach");
    expect(LEGACY_HASHES).toContain("anchor-sales-opportunity");
    expect(LEGACY_HASHES).toContain("workers");
    expect(LEGACY_HASHES).toContain("anchor-workers-top");
    expect(LEGACY_HASHES).toContain("reviews");
    expect(LEGACY_HASHES).toContain("website");
    expect(LEGACY_HASHES).toHaveLength(7);
  });
});
