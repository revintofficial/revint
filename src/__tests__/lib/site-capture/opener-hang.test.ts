// src/__tests__/lib/site-capture/opener-hang.test.ts
import { describe, expect, it } from "vitest";
import type { Browser } from "playwright";
import { createPlaywrightOpener } from "@/lib/site-capture/opener";

const never = <T>() => new Promise<T>(() => {});
const STEP_MS = 50;

/** A browser whose contexts hang where `hang` says. */
function fakeBrowser(hang: { close?: boolean; newPage?: boolean }) {
  const context = {
    route: async () => {},
    close: () => (hang.close ? never<void>() : Promise.resolve()),
    newPage: () => (hang.newPage ? never<unknown>() : Promise.reject(new Error("no page in this fake"))),
  };
  return { newContext: async () => context } as unknown as Browser;
}

describe("createPlaywrightOpener with a hung browser", () => {
  it("close() returns within the bound when the context never closes", async () => {
    const opener = await createPlaywrightOpener(fakeBrowser({ close: true }), "https://bistro.test/", undefined, {
      stepTimeoutMs: STEP_MS,
    });
    const t0 = Date.now();
    await opener.close();
    expect(Date.now() - t0).toBeLessThan(STEP_MS * 4);
  });

  it("open() fails with nav_error within the bound when newPage never resolves", async () => {
    const opener = await createPlaywrightOpener(fakeBrowser({ newPage: true }), "https://bistro.test/", undefined, {
      stepTimeoutMs: STEP_MS,
    });
    const t0 = Date.now();
    const r = await opener.open("https://bistro.test/menu", { timeoutMs: 15_000 });
    expect(Date.now() - t0).toBeLessThan(STEP_MS * 4);
    expect(r).toMatchObject({ html: null, error: "nav_error" });
    await opener.close();
  });
});
