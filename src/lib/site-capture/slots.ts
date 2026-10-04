// src/lib/site-capture/slots.ts
/**
 * How many sites one process captures at once. A capture holds a browser
 * context with up to three pages, so the limit protects memory; a run that
 * finds no slot is deferred (see DeferError), it does not wait.
 */

let active = 0;

export function maxCaptureSlots(): number {
  const n = Number(process.env.SITE_CAPTURE_MAX_CONCURRENT);
  return Number.isInteger(n) && n > 0 ? n : 2;
}

/** A release function, or `null` when every slot is taken. Releasing twice is harmless. */
export function tryAcquireCaptureSlot(): (() => void) | null {
  if (active >= maxCaptureSlots()) return null;
  active++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    active--;
  };
}

/** 20 s, 40 s, 80 s, then 120 s between attempts, plus up to 5 s of jitter. */
export function deferDelayMs(deferCount: number, random: () => number = Math.random): number {
  return Math.min(120_000, 20_000 * 2 ** Math.min(Math.max(deferCount, 0), 3)) + Math.floor(random() * 5_000);
}

/** After this long in the queue the audit runs shallow instead of waiting for a slot. */
export const MAX_DEFER_WAIT_MS = 30 * 60_000;

/** Kill switch: SITE_CAPTURE_DEEP=0 returns the auditor to the shallow crawl. */
export function deepCaptureEnabled(): boolean {
  return process.env.SITE_CAPTURE_DEEP !== "0";
}
