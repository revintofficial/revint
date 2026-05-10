/**
 * Phase 2 — `deriveObjectionDiff` bucket coverage.
 *
 * Verifies the three buckets (predicted-and-real, predicted-not-real,
 * real-only), the Jaccard threshold, the rebuttal pass-through, and
 * resilience to empty inputs.
 */
import { describe, expect, it } from "vitest";

import {
  deriveObjectionDiff,
  type RealObjectionInput,
} from "@/lib/lead-detail/derive-objection-diff";

function real(
  id: string,
  text: string,
  overrides: Partial<RealObjectionInput> = {},
): RealObjectionInput {
  return {
    id,
    text,
    rebuttalUsed: null,
    resolvedAt: null,
    category: null,
    ...overrides,
  };
}

describe("deriveObjectionDiff — empty inputs", () => {
  it("returns three empty buckets when both sides are empty", () => {
    const diff = deriveObjectionDiff([], []);
    expect(diff.predictedAndReal).toEqual([]);
    expect(diff.predictedNotReal).toEqual([]);
    expect(diff.realOnly).toEqual([]);
  });

  it("flushes all predicted into predictedNotReal when real is empty", () => {
    const diff = deriveObjectionDiff(["price too high", "switching cost"], []);
    expect(diff.predictedAndReal).toEqual([]);
    expect(diff.predictedNotReal).toHaveLength(2);
    expect(diff.realOnly).toEqual([]);
  });

  it("flushes all real into realOnly when predicted is empty", () => {
    const diff = deriveObjectionDiff(
      [],
      [real("o1", "this is too expensive for our team")],
    );
    expect(diff.realOnly).toHaveLength(1);
    expect(diff.realOnly[0].id).toBe("o1");
    expect(diff.predictedNotReal).toEqual([]);
    expect(diff.predictedAndReal).toEqual([]);
  });
});

describe("deriveObjectionDiff — token overlap matching", () => {
  it("matches predicted and real on Jaccard >= 0.5", () => {
    const diff = deriveObjectionDiff(
      ["price too high"],
      [real("o1", "their price is too high right now")],
    );
    expect(diff.predictedAndReal).toHaveLength(1);
    expect(diff.predictedAndReal[0].predicted).toBe("price too high");
    expect(diff.predictedAndReal[0].real.id).toBe("o1");
    expect(diff.predictedNotReal).toEqual([]);
    expect(diff.realOnly).toEqual([]);
  });

  it("does NOT match when token overlap is below threshold", () => {
    const diff = deriveObjectionDiff(
      ["budget concerns"],
      [real("o1", "we already use Toast and love it")],
    );
    expect(diff.predictedAndReal).toEqual([]);
    expect(diff.predictedNotReal).toHaveLength(1);
    expect(diff.realOnly).toHaveLength(1);
  });

  it("propagates rebuttalUsed onto the matched row", () => {
    const diff = deriveObjectionDiff(
      ["price concern"],
      [real("o1", "the price concern is real", { rebuttalUsed: "ROI calc" })],
    );
    expect(diff.predictedAndReal[0].real.rebuttalUsed).toBe("ROI calc");
  });

  it("marks resolved when resolvedAt is set", () => {
    const diff = deriveObjectionDiff(
      ["price concern"],
      [
        real("o1", "the price concern is real", {
          resolvedAt: new Date("2026-05-01T00:00:00Z"),
        }),
      ],
    );
    expect(diff.predictedAndReal[0].real.resolved).toBe(true);
  });

  it("does not double-match a single real objection", () => {
    const diff = deriveObjectionDiff(
      ["price too high", "price is high"],
      [real("o1", "price too high right now")],
    );
    expect(diff.predictedAndReal).toHaveLength(1);
    expect(diff.predictedNotReal).toHaveLength(1);
  });
});

describe("deriveObjectionDiff — mixed scenario", () => {
  it("partitions into the three buckets correctly", () => {
    const diff = deriveObjectionDiff(
      ["price too high", "switching cost", "data privacy concern"],
      [
        real("o1", "price too high right now"),
        real("o2", "integration issues with the new vendor"),
      ],
    );
    expect(diff.predictedAndReal).toHaveLength(1);
    expect(diff.predictedAndReal[0].predicted).toBe("price too high");
    expect(diff.predictedNotReal.map((p) => p.predicted).sort()).toEqual([
      "data privacy concern",
      "switching cost",
    ]);
    expect(diff.realOnly).toHaveLength(1);
    expect(diff.realOnly[0].id).toBe("o2");
  });
});
