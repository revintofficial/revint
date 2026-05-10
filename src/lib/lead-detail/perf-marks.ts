/**
 * lead-detail/perf-marks — Phase 7 perf instrumentation helper.
 *
 * Pure wrapper around `performance.mark` / `performance.measure`
 * that reports to PostHog as `lead_detail.perf.{event}`. The wrapper
 * exists so we can:
 *   1. Assert the perf budget in CI without spinning up a browser
 *      (synthetic test in `perf-budget.test.ts`).
 *   2. Stub the global `performance` API in jsdom — vitest ships
 *      it, but the marks we set must be deterministic.
 *   3. Enforce the typed event catalog for the perf namespace; any
 *      new perf event MUST be added to `telemetry.ts`.
 *
 * Naming convention:
 *   - `mark(leadId, "preliminary")` writes a mark
 *     `lead_detail/<leadId>/preliminary` so multiple leads in one
 *     SPA session don't collide.
 *   - `measure(leadId, "preliminary_to_paint", "preliminary",
 *     "paint")` resolves both marks and emits the perf event.
 *
 * Polling impact: marks are stored in the Performance Timeline by
 * default; we never call `clearMarks` on the hot path because the
 * typical lead detail session has < 10 marks total. `flush(leadId)`
 * is exposed for tests + page unmount so the timeline never leaks
 * across SPA route changes.
 */

import { track, type LeadDetailEventName } from "./telemetry";

type PerfEventName = Extract<
  LeadDetailEventName,
  `lead_detail.perf.${string}`
>;

type PerfShortName = PerfEventName extends `lead_detail.perf.${infer T}`
  ? T
  : never;

const PERF_EVENT_BY_SHORT: Record<PerfShortName, PerfEventName> = {
  preliminary_to_paint: "lead_detail.perf.preliminary_to_paint",
  final_to_paint: "lead_detail.perf.final_to_paint",
  first_decision_surface: "lead_detail.perf.first_decision_surface",
};

function hasPerformance(): boolean {
  if (typeof performance === "undefined") return false;
  if (typeof performance.mark !== "function") return false;
  return true;
}

function markName(leadId: string, label: string): string {
  return `lead_detail/${leadId}/${label}`;
}

/**
 * Set a performance mark scoped to a lead + label. Idempotent: if
 * the mark already exists we leave it (the first observation wins).
 */
export function mark(leadId: string, label: string): void {
  if (!hasPerformance()) return;
  try {
    performance.mark(markName(leadId, label));
  } catch {
    // Some browsers throw when the mark already exists; safe to
    // ignore — we deliberately emit the perf event from the first
    // observation, not the last.
  }
}

/**
 * Measure between two marks and emit the typed perf event. Returns
 * the duration in milliseconds, or `null` if either mark is missing
 * (callers can use this to bail out of derived telemetry without
 * special-casing the no-op).
 */
export function measure(
  leadId: string,
  shortEvent: PerfShortName,
  startLabel: string,
  endLabel: string,
): number | null {
  if (!hasPerformance() || typeof performance.measure !== "function") {
    return null;
  }
  const start = markName(leadId, startLabel);
  const end = markName(leadId, endLabel);
  let durationMs: number | null = null;
  try {
    const measureName = `lead_detail/${leadId}/${shortEvent}`;
    performance.measure(measureName, start, end);
    const entries = performance.getEntriesByName(measureName, "measure");
    const last = entries[entries.length - 1];
    durationMs = last ? Math.round(last.duration) : null;
  } catch {
    durationMs = null;
  }
  if (durationMs == null) return null;
  const eventName = PERF_EVENT_BY_SHORT[shortEvent];
  // The event payload signature is the same across all perf
  // events; the `event` discriminator is redundant but keeps
  // PostHog dashboards searchable by the short name.
  track(eventName, {
    event: shortEvent,
    leadId,
    durationMs,
  } as never);
  return durationMs;
}

/**
 * Clear every mark + measure scoped to this lead. Call on page
 * unmount so a long SPA session doesn't accumulate stale entries
 * in `performance.getEntries()`.
 */
export function flush(leadId: string): void {
  if (!hasPerformance()) return;
  try {
    const prefix = `lead_detail/${leadId}/`;
    for (const entry of performance.getEntries()) {
      if (entry.name.startsWith(prefix)) {
        if (entry.entryType === "mark" && typeof performance.clearMarks === "function") {
          performance.clearMarks(entry.name);
        } else if (
          entry.entryType === "measure" &&
          typeof performance.clearMeasures === "function"
        ) {
          performance.clearMeasures(entry.name);
        }
      }
    }
  } catch {
    // best-effort cleanup
  }
}

export const PERF_EVENTS = Object.freeze(PERF_EVENT_BY_SHORT);
