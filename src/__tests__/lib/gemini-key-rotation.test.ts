/**
 * Beta finding §7 — Gemini API key rotation + cooldown.
 *
 * Pins down the four behaviours the worker boot path relies on:
 *
 *   1. With multiple `GEMINI_API_KEY_*` env vars, `getGeminiKey()`
 *      hands them out in least-recently-used order. Two consecutive
 *      calls must return DIFFERENT keys so a single-tenant burst
 *      doesn't sit on one quota bucket.
 *
 *   2. `markGeminiKeyCool` puts a key on a 5-minute cooldown — the
 *      pool then prefers other keys until the timer expires. When
 *      EVERY key is cool, `getGeminiKey()` still returns one (the
 *      caller will produce a useful 403 error, which is better than
 *      a "no keys available" config error).
 *
 *   3. `isGeminiAuthFailure` accepts the surface forms the SDK
 *      actually throws (403, "Forbidden", "PERMISSION_DENIED",
 *      "API key …", "unauthorized") and rejects the transient ones
 *      (429, 5xx, ECONNRESET) so the rotation wrapper retries only
 *      auth failures.
 *
 *   4. `callWithKeyRotation` rotates through keys on 403 up to
 *      maxAttempts and surfaces the last error, but propagates
 *      non-403 errors immediately (the call-site owns 429/5xx retry).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  _resetGeminiKeysForTests,
  allGeminiKeysCool,
  callWithKeyRotation,
  getGeminiKey,
  isGeminiAuthFailure,
  markGeminiKeyCool,
} from "@/lib/gemini-keys";

const ORIGINAL_ENV = { ...process.env };

function setKeyEnv(...keys: string[]) {
  // Wipe any existing GEMINI_API_KEY* before assigning the test set.
  for (const name of Object.keys(process.env)) {
    if (name.startsWith("GEMINI_API_KEY")) delete process.env[name];
  }
  keys.forEach((k, i) => {
    process.env[`GEMINI_API_KEY_${i + 1}`] = k;
  });
  _resetGeminiKeysForTests();
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  _resetGeminiKeysForTests();
});

describe("Beta §7 — getGeminiKey() round-robin", () => {
  it("returns a key when one is configured", () => {
    setKeyEnv("AAAAkey-1");
    expect(getGeminiKey()).toBe("AAAAkey-1");
  });

  it("rotates LRU between two configured keys", () => {
    setKeyEnv("AAAAkey-1", "BBBBkey-2");
    const first = getGeminiKey();
    const second = getGeminiKey();
    expect(first).not.toBe(second);
    expect(new Set([first, second])).toEqual(new Set(["AAAAkey-1", "BBBBkey-2"]));
  });

  it("falls back to legacy GEMINI_API_KEY when no numbered keys are set", () => {
    for (const name of Object.keys(process.env)) {
      if (name.startsWith("GEMINI_API_KEY")) delete process.env[name];
    }
    process.env.GEMINI_API_KEY = "LEGACYkey-Z";
    _resetGeminiKeysForTests();
    expect(getGeminiKey()).toBe("LEGACYkey-Z");
  });

  it("throws when no keys are configured at all", () => {
    for (const name of Object.keys(process.env)) {
      if (name.startsWith("GEMINI_API_KEY")) delete process.env[name];
    }
    _resetGeminiKeysForTests();
    expect(() => getGeminiKey()).toThrow(/No GEMINI_API_KEY set/);
  });
});

describe("Beta §7 — cooldown", () => {
  beforeEach(() => {
    setKeyEnv("AAAAkey-1", "BBBBkey-2", "CCCCkey-3");
  });

  it("skips a key after markGeminiKeyCool", () => {
    markGeminiKeyCool("AAAAkey-1", "test_cooldown");
    const picks = new Set<string>([
      getGeminiKey(),
      getGeminiKey(),
      getGeminiKey(),
      getGeminiKey(),
    ]);
    expect(picks.has("AAAAkey-1")).toBe(false);
    expect(picks.has("BBBBkey-2")).toBe(true);
    expect(picks.has("CCCCkey-3")).toBe(true);
  });

  it("allGeminiKeysCool flips true when every key is on cooldown", () => {
    expect(allGeminiKeysCool()).toBe(false);
    markGeminiKeyCool("AAAAkey-1", "x");
    markGeminiKeyCool("BBBBkey-2", "x");
    expect(allGeminiKeysCool()).toBe(false);
    markGeminiKeyCool("CCCCkey-3", "x");
    expect(allGeminiKeysCool()).toBe(true);
  });

  it("still returns a key (one of the cool ones) when every key is cool", () => {
    markGeminiKeyCool("AAAAkey-1", "x");
    markGeminiKeyCool("BBBBkey-2", "x");
    markGeminiKeyCool("CCCCkey-3", "x");
    // Caller can still try; they will likely fail loud with a real
    // upstream 403 instead of a config-shaped error from the pool.
    expect(["AAAAkey-1", "BBBBkey-2", "CCCCkey-3"]).toContain(getGeminiKey());
  });
});

describe("Beta §7 — isGeminiAuthFailure", () => {
  it.each([
    "Got 403 Forbidden from Gemini",
    "PERMISSION_DENIED: API key not valid",
    "Invalid api key",
    "401 Unauthorized",
    "INVALID_ARGUMENT: API key expired",
  ])("recognises %j as auth failure", (msg) => {
    expect(isGeminiAuthFailure(new Error(msg))).toBe(true);
  });

  it.each([
    "429 Too Many Requests",
    "Internal Server Error 500",
    "ECONNRESET",
    "fetch failed",
    "DEADLINE_EXCEEDED",
  ])("does NOT classify %j as auth failure", (msg) => {
    expect(isGeminiAuthFailure(new Error(msg))).toBe(false);
  });

  it("handles non-Error throwables gracefully", () => {
    expect(isGeminiAuthFailure("403 forbidden")).toBe(true);
    expect(isGeminiAuthFailure(null)).toBe(false);
    expect(isGeminiAuthFailure(undefined)).toBe(false);
  });
});

describe("Beta §7 — callWithKeyRotation", () => {
  beforeEach(() => {
    setKeyEnv("AAAAkey-1", "BBBBkey-2");
  });

  it("returns the result on first success", async () => {
    const result = await callWithKeyRotation(async (key) => {
      expect(key).toMatch(/AAAAkey-1|BBBBkey-2/);
      return "ok";
    });
    expect(result).toBe("ok");
  });

  it("rotates to the next key on a 403 and succeeds", async () => {
    let attempts = 0;
    const result = await callWithKeyRotation(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("403 Forbidden");
      return "ok-after-rotate";
    });
    expect(result).toBe("ok-after-rotate");
    expect(attempts).toBe(2);
  });

  it("propagates non-403 errors immediately (no retry)", async () => {
    let attempts = 0;
    await expect(
      callWithKeyRotation(async () => {
        attempts += 1;
        throw new Error("429 Too Many Requests");
      }),
    ).rejects.toThrow(/429/);
    expect(attempts).toBe(1);
  });

  it("gives up after maxAttempts on persistent 403s", async () => {
    let attempts = 0;
    await expect(
      callWithKeyRotation(
        async () => {
          attempts += 1;
          throw new Error("PERMISSION_DENIED");
        },
        { maxAttempts: 2 },
      ),
    ).rejects.toThrow(/PERMISSION_DENIED/);
    expect(attempts).toBeGreaterThan(0);
    expect(attempts).toBeLessThanOrEqual(2);
  });
});
