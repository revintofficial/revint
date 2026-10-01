/**
 * Task 2 — Apify concurrency lock + quota classification.
 *
 * - `withApifySlot` caps in-process concurrent Apify calls at 2 so a
 *   burst of leads cannot trip Apify's `concurrent-runs-limit-exceeded`
 *   / `actor-memory-limit-exceeded` 402s (15 runs died that way).
 * - Quota responses (402, and 403 with a quota type) no longer mark the
 *   run FAILED: `apifyQuotaSkipFor(err)` maps them to
 *   `{ skipped: "apify_quota", statusCode }`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  APIFY_MAX_CONCURRENT,
  ApifyQuotaError,
  ApifyRunError,
  apifyQuotaSkipFor,
  runSync,
  withApifySlot,
} from "@/lib/apify";

describe("withApifySlot", () => {
  it("runs at most two apify calls at once", async () => {
    let active = 0;
    let max = 0;
    await Promise.all(
      Array.from({ length: 5 }, () =>
        withApifySlot(async () => {
          active += 1;
          max = Math.max(max, active);
          await new Promise((r) => setTimeout(r, 20));
          active -= 1;
        }),
      ),
    );
    expect(APIFY_MAX_CONCURRENT).toBe(2);
    expect(max).toBeLessThanOrEqual(2);
    expect(max).toBe(2);
  });

  it("releases the slot when the call throws", async () => {
    const boom = () =>
      withApifySlot(async () => {
        throw new Error("boom");
      });
    await expect(boom()).rejects.toThrow("boom");
    await expect(boom()).rejects.toThrow("boom");
    await expect(boom()).rejects.toThrow("boom");
    // If slots leaked, this would hang forever.
    await expect(withApifySlot(async () => "ok")).resolves.toBe("ok");
  });

  it("returns the wrapped value", async () => {
    await expect(withApifySlot(async () => 42)).resolves.toBe(42);
  });
});

describe("Apify quota classification", () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    process.env.APIFY_TOKEN = "test-token";
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.APIFY_TOKEN;
  });

  function mockFetchOnce(status: number, body: unknown) {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(typeof body === "string" ? body : JSON.stringify(body), { status }),
    ) as unknown as typeof fetch;
  }

  it("turns HTTP 402 into an ApifyQuotaError", async () => {
    mockFetchOnce(402, { error: { type: "not-enough-usage-to-run-paid-actor", message: "x" } });
    const err = await runSync("a/b", {}).catch((e) => e);
    expect(err).toBeInstanceOf(ApifyQuotaError);
    expect(apifyQuotaSkipFor(err)).toEqual({
      skipped: "apify_quota",
      reason: "apify_quota",
      statusCode: 402,
    });
  });

  for (const type of [
    "platform-feature-disabled",
    "actor-memory-limit-exceeded",
    "concurrent-runs-limit-exceeded",
  ]) {
    it(`turns 403 ${type} into a quota skip`, async () => {
      mockFetchOnce(403, { error: { type, message: "limit" } });
      const err = await runSync("a/b", {}).catch((e) => e);
      expect(apifyQuotaSkipFor(err)).toEqual({
        skipped: "apify_quota",
        reason: "apify_quota",
        statusCode: 403,
      });
    });
  }

  it("keeps an unrelated 403 (bad token) as a real failure", async () => {
    mockFetchOnce(403, { error: { type: "insufficient-permissions", message: "nope" } });
    const err = await runSync("a/b", {}).catch((e) => e);
    expect(err).toBeInstanceOf(ApifyRunError);
    expect(err).not.toBeInstanceOf(ApifyQuotaError);
    expect(apifyQuotaSkipFor(err)).toBeNull();
  });

  it("keeps a 500 as a real failure", async () => {
    mockFetchOnce(500, "internal");
    const err = await runSync("a/b", {}).catch((e) => e);
    expect(apifyQuotaSkipFor(err)).toBeNull();
  });

  it("ignores non-Apify errors", () => {
    expect(apifyQuotaSkipFor(new Error("x"))).toBeNull();
    expect(apifyQuotaSkipFor("x")).toBeNull();
  });
});
