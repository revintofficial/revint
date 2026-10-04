// src/__tests__/agent-workers/watchdog-verdict.test.ts
import { describe, expect, it } from "vitest";
import { watchdogVerdict } from "@/lib/agent-workers/deadline";

const T0 = Date.parse("2026-10-04T10:00:00Z");
const at = (minutes: number) => new Date(T0 + minutes * 60_000);
const AUDITOR = { estimatedDurationMs: 60_000, deadlineMs: 300_000 };
const DEFAULT = { estimatedDurationMs: 30_000 };

describe("watchdogVerdict", () => {
  it("keeps the 3-minute rule for a worker without its own deadline", () => {
    const run = { createdAt: at(0), startedAt: at(0), inputsJson: null };
    expect(watchdogVerdict(run, DEFAULT, T0 + 2 * 60_000).expired).toBe(false);
    expect(watchdogVerdict(run, DEFAULT, T0 + 4 * 60_000)).toMatchObject({ expired: true, limitMs: 180_000, isAsync: false });
  });

  it("gives a worker with a 300 s deadline six minutes", () => {
    const run = { createdAt: at(0), startedAt: at(0), inputsJson: null };
    expect(watchdogVerdict(run, AUDITOR, T0 + 4 * 60_000).expired).toBe(false);
    expect(watchdogVerdict(run, AUDITOR, T0 + 7 * 60_000)).toMatchObject({ expired: true, limitMs: 360_000 });
  });

  it("counts from the last start, not from creation", () => {
    const run = { createdAt: at(0), startedAt: at(10), inputsJson: null };
    expect(watchdogVerdict(run, DEFAULT, T0 + 11 * 60_000).expired).toBe(false);
  });

  it("does not kill a run that was deferred a moment ago", () => {
    const run = { createdAt: at(0), startedAt: null, inputsJson: { deferCount: 4, deferredAt: at(19).toISOString() } };
    expect(watchdogVerdict(run, AUDITOR, T0 + 20 * 60_000).expired).toBe(false);
  });

  it("still fails a job that was never picked up", () => {
    const run = { createdAt: at(0), startedAt: null, inputsJson: {} };
    expect(watchdogVerdict(run, DEFAULT, T0 + 4 * 60_000).expired).toBe(true);
  });

  it("keeps ten minutes from creation for async Apify runs", () => {
    const run = { createdAt: at(0), startedAt: at(0), inputsJson: { mode: "async-apify", apifyRunId: "abc" } };
    expect(watchdogVerdict(run, DEFAULT, T0 + 9 * 60_000)).toMatchObject({ expired: false, isAsync: true, limitMs: 600_000 });
    expect(watchdogVerdict(run, DEFAULT, T0 + 11 * 60_000).expired).toBe(true);
  });

  it("accepts ISO strings for the timestamps", () => {
    const run = { createdAt: at(0).toISOString(), startedAt: at(0).toISOString(), inputsJson: null };
    expect(watchdogVerdict(run, DEFAULT, T0 + 4 * 60_000).expired).toBe(true);
  });
});
