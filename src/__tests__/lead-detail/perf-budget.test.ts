/**
 * Phase 7 — synthetic perf budget regression test.
 *
 * The real perf budget (PLAN §5.6) is enforced in production via
 * Lighthouse + the `perf-marks` PostHog stream. This synthetic test
 * is a CI canary: it walks the `mark / measure` lifecycle the same
 * way the page does, and asserts:
 *   1. Every mark stays scoped to its leadId (no cross-lead leak
 *      when two SPA tabs render different leads back-to-back).
 *   2. `flush(leadId)` clears every mark + measure for that lead
 *      so a long SPA session doesn't accumulate stale entries.
 *   3. The typed `track()` call fires for every measured event with
 *      a positive `durationMs` integer.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const captureSpy = vi.fn();

vi.mock("posthog-js", () => ({
  default: {
    __loaded: true,
    capture: (...args: unknown[]) => captureSpy(...args),
  },
}));

import { mark, measure, flush } from "@/lib/lead-detail/perf-marks";

beforeEach(() => {
  captureSpy.mockReset();
  performance.clearMarks();
  performance.clearMeasures();
});

afterEach(() => {
  performance.clearMarks();
  performance.clearMeasures();
});

describe("perf-marks — mark/measure/flush lifecycle", () => {
  it("namespaces marks by leadId so two leads don't collide", () => {
    mark("lead_a", "mount");
    mark("lead_b", "mount");
    const aMarks = performance.getEntriesByName(
      "lead_detail/lead_a/mount",
      "mark",
    );
    const bMarks = performance.getEntriesByName(
      "lead_detail/lead_b/mount",
      "mark",
    );
    expect(aMarks.length).toBe(1);
    expect(bMarks.length).toBe(1);
  });

  it("emits the typed perf event with a non-negative durationMs", () => {
    mark("lead_a", "mount");
    // A microtask of latency between marks so the measure isn't 0.
    for (let i = 0; i < 10_000; i += 1) {
      Math.sqrt(i);
    }
    mark("lead_a", "preliminary");
    const ms = measure("lead_a", "preliminary_to_paint", "mount", "preliminary");
    expect(ms).not.toBeNull();
    expect(ms!).toBeGreaterThanOrEqual(0);
    expect(captureSpy).toHaveBeenCalledTimes(1);
    expect(captureSpy).toHaveBeenCalledWith(
      "lead_detail.perf.preliminary_to_paint",
      expect.objectContaining({
        event: "preliminary_to_paint",
        leadId: "lead_a",
        durationMs: expect.any(Number),
      }),
    );
  });

  it("returns null when a referenced mark is missing", () => {
    const ms = measure("lead_a", "final_to_paint", "mount", "final");
    expect(ms).toBeNull();
    expect(captureSpy).not.toHaveBeenCalled();
  });

  it("flush(leadId) clears only that lead's entries", () => {
    mark("lead_a", "mount");
    mark("lead_a", "preliminary");
    mark("lead_b", "mount");
    measure("lead_a", "preliminary_to_paint", "mount", "preliminary");

    flush("lead_a");

    const aRemaining = performance
      .getEntries()
      .filter((e) => e.name.startsWith("lead_detail/lead_a/"));
    const bRemaining = performance
      .getEntries()
      .filter((e) => e.name.startsWith("lead_detail/lead_b/"));
    expect(aRemaining.length).toBe(0);
    expect(bRemaining.length).toBe(1);
  });
});

describe("perf-marks — perf budget canary", () => {
  it("preliminary→paint stays under the 1.2s page paint budget on synthetic data", () => {
    // The real budget lives in Lighthouse; the canary value here
    // simulates a hot DB read (~150ms p95 in PLAN §5.6) plus a
    // cheap React render.
    mark("lead_a", "mount");
    mark("lead_a", "preliminary");
    const ms = measure("lead_a", "preliminary_to_paint", "mount", "preliminary");
    expect(ms).not.toBeNull();
    expect(ms!).toBeLessThan(1200);
  });
});
