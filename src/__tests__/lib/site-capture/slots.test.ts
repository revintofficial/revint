// src/__tests__/lib/site-capture/slots.test.ts
import { afterEach, describe, expect, it } from "vitest";
import { deepCaptureEnabled, deferDelayMs, maxCaptureSlots, tryAcquireCaptureSlot } from "@/lib/site-capture/slots";

afterEach(() => {
  delete process.env.SITE_CAPTURE_MAX_CONCURRENT;
  delete process.env.SITE_CAPTURE_DEEP;
});

describe("capture slots", () => {
  it("allows two captures at once by default and frees a slot on release", () => {
    const a = tryAcquireCaptureSlot();
    const b = tryAcquireCaptureSlot();
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(tryAcquireCaptureSlot()).toBeNull();
    a!();
    a!(); // releasing twice must not free a second slot
    const c = tryAcquireCaptureSlot();
    expect(c).not.toBeNull();
    expect(tryAcquireCaptureSlot()).toBeNull();
    b!();
    c!();
  });

  it("reads the limit from SITE_CAPTURE_MAX_CONCURRENT", () => {
    process.env.SITE_CAPTURE_MAX_CONCURRENT = "1";
    expect(maxCaptureSlots()).toBe(1);
    const a = tryAcquireCaptureSlot();
    expect(tryAcquireCaptureSlot()).toBeNull();
    a!();
    process.env.SITE_CAPTURE_MAX_CONCURRENT = "nonsense";
    expect(maxCaptureSlots()).toBe(2);
  });
});

describe("deferDelayMs", () => {
  it("backs off from 20 s to a 120 s ceiling, plus jitter", () => {
    const noJitter = () => 0;
    expect([0, 1, 2, 3, 9].map((n) => deferDelayMs(n, noJitter))).toEqual([20_000, 40_000, 80_000, 120_000, 120_000]);
    expect(deferDelayMs(0, () => 0.999)).toBeLessThan(25_000);
  });
});

describe("deepCaptureEnabled", () => {
  it("is on unless SITE_CAPTURE_DEEP is 0", () => {
    expect(deepCaptureEnabled()).toBe(true);
    process.env.SITE_CAPTURE_DEEP = "0";
    expect(deepCaptureEnabled()).toBe(false);
  });
});
