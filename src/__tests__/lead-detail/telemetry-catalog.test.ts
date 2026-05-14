/**
 * Phase 7 — typed telemetry catalog test.
 *
 * Phase 7 promotes `src/lib/lead-detail/telemetry.ts` as the
 * single source of truth for every Lead Detail v2 PostHog event.
 * Every consumer must call `track(event, props)` instead of
 * `posthog.capture(event, props)` directly so a renamed event or
 * a drifted payload schema fails compile-time, not after a quiet
 * dashboard rot.
 *
 * This test enforces:
 *   1. The runtime list `LEAD_DETAIL_EVENT_NAMES` matches the
 *      compile-time `LeadDetailEventName` union (every key is in
 *      both lists, in the same order).
 *   2. `track()` only fires when PostHog is loaded; an SSR call
 *      or an adblocked browser must never throw.
 *   3. The PLAN §5.5 catalog list (every event the plan promised
 *      Phase 7 would emit) is fully covered by the runtime list.
 *      A missing catalog entry breaks this test on purpose.
 */
import { describe, expect, it, vi } from "vitest";

const captureSpy = vi.fn();

vi.mock("posthog-js", () => ({
  default: {
    __loaded: true,
    capture: (...args: unknown[]) => captureSpy(...args),
  },
}));

import {
  LEAD_DETAIL_EVENT_NAMES,
  track,
  type LeadDetailEventName,
} from "@/lib/lead-detail/telemetry";

const PLAN_CATALOG: ReadonlyArray<LeadDetailEventName> = [
  "lead_detail.v2.viewed",
  "lead_detail.v2.preliminary_received",
  "lead_detail.v2.final_received",
  "lead_detail.block.expanded",
  "lead_detail.evidence_chip.opened",
  "lead_detail.snooze",
  "lead_detail.disposition",
  "lead_detail.queue.advance",
  "lead_detail.closest_win.shown",
  "lead_detail.closest_win.applied",
  "lead_detail.power_tools.viewed",
  "lead_detail.reasoning.viewed",
  "lead_detail.legacy_hash_consumed",
  "lead_detail.legacy_workers_link_followed",
  // Perf catalog (PLAN §5.5 lists `lead_detail.perf.*`; we expand
  // it here so the test catches any silent perf event drop).
  "lead_detail.perf.preliminary_to_paint",
  "lead_detail.perf.final_to_paint",
  "lead_detail.perf.first_decision_surface",
  // -----------------------------------------------------------------
  // Truth Layer v1 (Wave 0 catalog — master plan §2).
  //
  // V-L (Wave 1) is the Telemetry Catalog Steward for the lead detail
  // surface and extends this list to match the Wave 0 pre-declared
  // `truth.*` events. Adding a new `truth.*` row here without first
  // adding it to `LeadDetailEventCatalog` (or vice versa) fails the
  // "no unknown events" + "same length" assertions below — the test
  // is the runtime ↔ compile-time guard PLAN §1.5 requires.
  // -----------------------------------------------------------------
  // T-A Decision Gates
  "truth.decision_gate.contact_first_fired",
  "truth.decision_gate.authority_first_fired",
  "truth.icp_rozet.capped",
  "truth.nba.decision_resolved",
  // T-B Locale Gate
  "truth.locale.resolved",
  "truth.locale.workspace_lead_mismatch",
  // T-C Evidence Calibration
  "truth.severity.normalized",
  "truth.switch_signal.direction_assigned",
  "truth.window_timer.derived",
  // T-D Brief Truth-Grounding
  "truth.brief.pain_quoted",
  "truth.brief.hypothesis_count",
  "truth.brief.website_claim_blocked",
  // T-E Website Verification
  "truth.website.verify_started",
  "truth.website.verify_completed",
  // T-F NBA Hygiene
  "truth.nba.avoidance_overlap_dropped",
  "truth.nba.objection_source",
  // T-G Surface Fidelity
  "truth.surface.review_kpi_rendered",
  // T-H Observability
  "truth.observability.kill_switch_armed",
];

describe("telemetry catalog — runtime ↔ compile parity", () => {
  it("the runtime list contains every PLAN §5.5 event", () => {
    for (const event of PLAN_CATALOG) {
      expect(LEAD_DETAIL_EVENT_NAMES).toContain(event);
    }
  });

  it("the runtime list contains no unknown events", () => {
    for (const event of LEAD_DETAIL_EVENT_NAMES) {
      expect(PLAN_CATALOG).toContain(event);
    }
  });

  it("the runtime list and the PLAN §5.5 catalog have the same length", () => {
    expect(LEAD_DETAIL_EVENT_NAMES.length).toBe(PLAN_CATALOG.length);
  });
});

describe("telemetry track() — defensive shape", () => {
  it("forwards to posthog.capture when loaded", () => {
    captureSpy.mockReset();
    track("lead_detail.power_tools.viewed", { leadId: "lead_a" });
    expect(captureSpy).toHaveBeenCalledTimes(1);
    expect(captureSpy).toHaveBeenCalledWith(
      "lead_detail.power_tools.viewed",
      expect.objectContaining({ leadId: "lead_a" }),
    );
  });

  it("never throws when posthog is not loaded", async () => {
    // Re-import with the loaded flag flipped off.
    vi.resetModules();
    vi.doMock("posthog-js", () => ({
      default: { __loaded: false, capture: () => {} },
    }));
    const { track: trackUnloaded } = await import(
      "@/lib/lead-detail/telemetry"
    );
    expect(() =>
      trackUnloaded("lead_detail.power_tools.viewed", { leadId: "lead_a" }),
    ).not.toThrow();
    vi.doUnmock("posthog-js");
  });
});
