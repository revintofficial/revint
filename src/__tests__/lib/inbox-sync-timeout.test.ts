/**
 * M22 regression - the inbox sync worker calls Gemini's
 * `model.generateContent` to classify replies. The bare call has no
 * wall-clock deadline, so a stuck Gemini region would freeze the
 * worker slot forever and back up downstream sequence ticks.
 *
 * The fix wraps the call in `generateWithTimeout(model, prompt,
 * { timeoutMs: 30_000, label: "inbox_sync.classify" })`. We can't
 * easily exercise the full inbox-sync worker without standing up
 * Redis + Postgres + a real OAuth flow, so we verify two things:
 *
 *   1. Source-presence - inbox-sync.ts imports + calls
 *      generateWithTimeout (regression catch if someone reverts it).
 *   2. Behavior of the helper itself - generateWithTimeout actually
 *      enforces the deadline against a hung model promise.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateWithTimeout } from "@/lib/gemini-client";

describe("M22 - inbox sync uses generateWithTimeout", () => {
  it("inbox-sync.ts imports generateWithTimeout from @/lib/gemini-client", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/lib/sequence-engine/inbox-sync.ts"),
      "utf-8",
    );
    expect(src).toMatch(
      /import\s+\{[^}]*generateWithTimeout[^}]*\}\s+from\s+["']@\/lib\/gemini-client["']/,
    );
  });

  it("inbox-sync.ts uses generateWithTimeout with a 30s deadline labelled inbox_sync.classify", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/lib/sequence-engine/inbox-sync.ts"),
      "utf-8",
    );
    expect(src).toMatch(/generateWithTimeout\s*\(/);
    expect(src).toMatch(/timeoutMs\s*:\s*30_?000/);
    expect(src).toMatch(/label\s*:\s*["']inbox_sync\.classify["']/);
  });

  it("inbox-sync.ts no longer calls bare model.generateContent in code", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/lib/sequence-engine/inbox-sync.ts"),
      "utf-8",
    );
    const codeLines = src
      .split("\n")
      .filter((line) => {
        const t = line.trim();
        return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
      });
    const codeOnly = codeLines.join("\n");
    expect(codeOnly).not.toMatch(/model\.generateContent\s*\(/);
  });
});

describe("M22 - generateWithTimeout enforces the deadline", () => {
  it("rejects with a timeout-shaped error when the model promise hangs longer than timeoutMs", async () => {
    // Mirror the real SDK contract: the helper passes a signal in the
    // options bag and expects the SDK to reject on abort. The mock
    // listens for the signal and rejects accordingly so the helper's
    // catch branch fires (otherwise the test would deadlock).
    const hangingModel = {
      generateContent: (
        _req: unknown,
        opts?: { signal?: AbortSignal },
      ) =>
        new Promise<never>((_resolve, reject) => {
          opts?.signal?.addEventListener("abort", () => {
            reject(new Error("aborted"));
          });
        }),
    } as unknown as Parameters<typeof generateWithTimeout>[0];

    const start = Date.now();
    let caught: unknown = null;
    try {
      await generateWithTimeout(hangingModel, "noop", {
        timeoutMs: 100,
        label: "test",
      });
    } catch (err) {
      caught = err;
    }
    const elapsed = Date.now() - start;
    expect(caught).not.toBeNull();
    expect((caught as Error).message).toMatch(/timeout/i);
    expect(elapsed).toBeLessThan(2000);
    expect(elapsed).toBeGreaterThanOrEqual(80);
  });

  it("returns the model result when it resolves before the deadline", async () => {
    const fastModel = {
      generateContent: () =>
        Promise.resolve({ response: { text: () => "ok" } }),
    } as unknown as Parameters<typeof generateWithTimeout>[0];

    const result = await generateWithTimeout(fastModel, "noop", {
      timeoutMs: 1000,
      label: "test",
    });
    expect(result.response.text()).toBe("ok");
  });
});
