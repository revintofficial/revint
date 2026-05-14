/**
 * Phase 7 (V-L) — perf-marks unit test.
 *
 * Companion to `perf-budget.test.ts` (the synthetic-data canary).
 * This file pins the integration contract between the perf-marks
 * helper and `performance.mark` / `performance.measure`:
 *
 *   1. `mark()` calls `performance.mark` with the lead-namespaced
 *      name `lead_detail/<leadId>/<label>` so two SPA tabs cannot
 *      collide.
 *   2. `measure()` resolves both marks AND fires `track()` with
 *      the typed PostHog event name; the event payload always
 *      includes the `event` short name + `leadId` + `durationMs`.
 *   3. The helper is defensive: a thrown `performance.mark` (e.g.
 *      Safari sometimes throws on duplicate marks) NEVER bubbles —
 *      `mark()` must always return `void` cleanly.
 *   4. `flush()` only removes entries scoped to the given leadId.
 *
 * We mock `performance.mark` + `performance.measure` directly (via
 * spy) so the test is independent of jsdom's perf timeline state.
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

let markSpy: ReturnType<typeof vi.spyOn>;
let measureSpy: ReturnType<typeof vi.spyOn>;
let clearMarksSpy: ReturnType<typeof vi.spyOn>;
let clearMeasuresSpy: ReturnType<typeof vi.spyOn>;
let getEntriesByNameSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  captureSpy.mockReset();
  performance.clearMarks();
  performance.clearMeasures();
  markSpy = vi.spyOn(performance, "mark");
  measureSpy = vi.spyOn(performance, "measure");
  clearMarksSpy = vi.spyOn(performance, "clearMarks");
  clearMeasuresSpy = vi.spyOn(performance, "clearMeasures");
  getEntriesByNameSpy = vi.spyOn(performance, "getEntriesByName");
});

afterEach(() => {
  markSpy.mockRestore();
  measureSpy.mockRestore();
  clearMarksSpy.mockRestore();
  clearMeasuresSpy.mockRestore();
  getEntriesByNameSpy.mockRestore();
  performance.clearMarks();
  performance.clearMeasures();
});

describe("perf-marks — performance.mark integration", () => {
  it("mark(leadId, label) writes the namespaced mark", () => {
    mark("lead_xyz", "mount");
    expect(markSpy).toHaveBeenCalledWith("lead_detail/lead_xyz/mount");
  });

  it("never throws when performance.mark throws (defensive)", () => {
    markSpy.mockImplementation(() => {
      throw new Error("safari-duplicate-mark");
    });
    expect(() => mark("lead_xyz", "preliminary")).not.toThrow();
  });

  it("mark(leadId, label) is idempotent at the helper level", () => {
    mark("lead_xyz", "mount");
    mark("lead_xyz", "mount");
    expect(markSpy).toHaveBeenCalledTimes(2);
    // The Performance Timeline natively dedupes by name when
    // `performance.mark` is called twice with the same name in
    // jsdom — we don't care about that here, only that the helper
    // forwards both invocations without raising.
  });
});

describe("perf-marks — performance.measure + track integration", () => {
  it("measure() calls performance.measure with the namespaced bounds + fires track()", () => {
    mark("lead_xyz", "mount");
    // Force a measurable delta so the synthetic duration is > 0.
    for (let i = 0; i < 5_000; i += 1) Math.sqrt(i);
    mark("lead_xyz", "preliminary");
    const ms = measure(
      "lead_xyz",
      "preliminary_to_paint",
      "mount",
      "preliminary",
    );
    expect(measureSpy).toHaveBeenCalledWith(
      "lead_detail/lead_xyz/preliminary_to_paint",
      "lead_detail/lead_xyz/mount",
      "lead_detail/lead_xyz/preliminary",
    );
    expect(ms).not.toBeNull();
    expect(ms!).toBeGreaterThanOrEqual(0);
    expect(captureSpy).toHaveBeenCalledTimes(1);
    expect(captureSpy).toHaveBeenCalledWith(
      "lead_detail.perf.preliminary_to_paint",
      expect.objectContaining({
        event: "preliminary_to_paint",
        leadId: "lead_xyz",
        durationMs: expect.any(Number),
      }),
    );
  });

  it("fires the typed event for each of the three perf catalog entries", () => {
    mark("lead_xyz", "mount");
    mark("lead_xyz", "preliminary");
    mark("lead_xyz", "final");
    mark("lead_xyz", "first_decision_surface");

    measure("lead_xyz", "preliminary_to_paint", "mount", "preliminary");
    measure("lead_xyz", "final_to_paint", "mount", "final");
    measure(
      "lead_xyz",
      "first_decision_surface",
      "mount",
      "first_decision_surface",
    );

    const events = captureSpy.mock.calls.map((c) => c[0] as string);
    expect(events).toEqual([
      "lead_detail.perf.preliminary_to_paint",
      "lead_detail.perf.final_to_paint",
      "lead_detail.perf.first_decision_surface",
    ]);
  });

  it("returns null and skips track() when a referenced mark is missing", () => {
    // No mark calls — measure must short-circuit (the helper catches
    // the `DOMException: Failed to execute 'measure'` jsdom throws).
    const ms = measure("lead_xyz", "final_to_paint", "mount", "final");
    expect(ms).toBeNull();
    expect(captureSpy).not.toHaveBeenCalled();
  });

  it("never throws when performance.measure throws (defensive)", () => {
    mark("lead_xyz", "mount");
    mark("lead_xyz", "preliminary");
    measureSpy.mockImplementation(() => {
      throw new Error("invalid-measure");
    });
    expect(() =>
      measure("lead_xyz", "preliminary_to_paint", "mount", "preliminary"),
    ).not.toThrow();
    expect(captureSpy).not.toHaveBeenCalled();
  });
});

describe("perf-marks — flush", () => {
  it("only clears entries scoped to the given leadId", () => {
    mark("lead_a", "mount");
    mark("lead_a", "preliminary");
    mark("lead_b", "mount");
    measure("lead_a", "preliminary_to_paint", "mount", "preliminary");

    flush("lead_a");

    expect(clearMarksSpy).toHaveBeenCalledWith(
      "lead_detail/lead_a/mount",
    );
    expect(clearMarksSpy).toHaveBeenCalledWith(
      "lead_detail/lead_a/preliminary",
    );
    expect(clearMeasuresSpy).toHaveBeenCalledWith(
      "lead_detail/lead_a/preliminary_to_paint",
    );
    // Critically, lead_b must NOT be cleared.
    const clearedNames = [
      ...clearMarksSpy.mock.calls.map((c) => c[0]),
      ...clearMeasuresSpy.mock.calls.map((c) => c[0]),
    ];
    expect(
      clearedNames.some((n) => typeof n === "string" && n.includes("lead_b")),
    ).toBe(false);
  });

  it("is a no-op when no entries exist for the leadId", () => {
    flush("lead_never_marked");
    expect(clearMarksSpy).not.toHaveBeenCalled();
    expect(clearMeasuresSpy).not.toHaveBeenCalled();
  });
});
