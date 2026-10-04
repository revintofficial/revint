// src/__tests__/lib/site-capture/opener-visible-text.test.ts
import { describe, expect, it, vi } from "vitest";
import type { Browser } from "playwright";

// The fake pages live on made-up hosts; the guard's DNS lookup is not what is under test.
vi.mock("@/lib/url-guard", () => ({ assertSafeFetchUrl: async (url: string) => new URL(url) }));

import { createPlaywrightOpener } from "@/lib/site-capture/opener";
import { VISIBLE_TEXT_SCRIPT } from "@/lib/site-capture/rendered";

const HTML = `<html><body><p>Book a table</p><div style="display:none">Card details are required.</div></body></html>`;

/**
 * A browser whose one page answers 200 with HTML and runs `evaluate` through `onEvaluate`.
 * `calls` records the order of `content` and string `evaluate` calls.
 */
function fakeBrowser(onEvaluate: (script: string, page: { setUrl(u: string): void }) => Promise<unknown>) {
  const calls: string[] = [];
  let url = "about:blank";
  const control = { setUrl: (u: string) => void (url = u) };
  const locator: Record<string, unknown> = {};
  Object.assign(locator, {
    and: () => locator,
    first: () => locator,
    click: async () => {
      throw new Error("no cookie banner");
    },
  });
  const page = {
    on: () => {},
    mainFrame: () => ({}),
    goto: async (u: string) => {
      url = u;
      return { status: () => 200, request: () => ({ url: () => u, redirectedFrom: () => null }) };
    },
    url: () => url,
    waitForLoadState: async () => {},
    getByRole: () => locator,
    locator: () => locator,
    waitForTimeout: async () => {},
    evaluate: async (script: unknown) => {
      const s = String(script);
      calls.push(s.includes("innerText") ? "visibleText" : "other-evaluate");
      return onEvaluate(s, control);
    },
    content: async () => {
      calls.push("content");
      return HTML;
    },
    close: async () => {},
  };
  const context = { route: async () => {}, close: async () => {}, newPage: async () => page };
  return { browser: { newContext: async () => context } as unknown as Browser, calls };
}

const URL_ = "https://bistro.test/book";

describe("openOnce: the rendered text", () => {
  it("returns the page's rendered text next to its HTML, read after the HTML", async () => {
    const { browser, calls } = fakeBrowser(async (s) => (s.includes("innerText") ? "Book a table" : undefined));
    const opener = await createPlaywrightOpener(browser, "https://bistro.test/");
    const r = await opener.open(URL_, { timeoutMs: 15_000 });
    expect(r).toMatchObject({ error: null, html: HTML, visibleText: "Book a table", source: "browser" });
    expect(calls.filter((c) => c !== "other-evaluate")).toEqual(["content", "visibleText"]);
    await opener.close();
  });

  it("caps the rendered text at 200,000 characters", async () => {
    const { browser } = fakeBrowser(async (s) => (s.includes("innerText") ? "x".repeat(250_000) : undefined));
    const opener = await createPlaywrightOpener(browser, "https://bistro.test/");
    const r = await opener.open(URL_, { timeoutMs: 15_000 });
    expect(r.visibleText).toHaveLength(200_000);
    await opener.close();
  });

  it("keeps the page with a null rendered text when the read fails", async () => {
    const { browser } = fakeBrowser(async (s) => {
      if (s.includes("innerText")) throw new Error("Execution context was destroyed");
      return undefined;
    });
    const opener = await createPlaywrightOpener(browser, "https://bistro.test/");
    const r = await opener.open(URL_, { timeoutMs: 15_000 });
    expect(r).toMatchObject({ error: null, html: HTML, visibleText: null });
    await opener.close();
  });

  it("keeps the page with a null rendered text when the read never answers", async () => {
    const { browser } = fakeBrowser((s) => (s.includes("innerText") ? new Promise(() => {}) : Promise.resolve(undefined)));
    const opener = await createPlaywrightOpener(browser, "https://bistro.test/");
    const t0 = Date.now();
    const r = await opener.open(URL_, { timeoutMs: 1_500 });
    expect(Date.now() - t0).toBeLessThan(4_000);
    expect(r).toMatchObject({ error: null, html: HTML, visibleText: null });
    await opener.close();
  });

  it("refuses the page when it navigated while the rendered text was read", async () => {
    const { browser } = fakeBrowser(async (s, page) => {
      if (!s.includes("innerText")) return undefined;
      page.setUrl("https://elsewhere.test/");
      return "Elsewhere";
    });
    const opener = await createPlaywrightOpener(browser, "https://bistro.test/");
    const r = await opener.open(URL_, { timeoutMs: 15_000 });
    expect(r).toMatchObject({ error: "unsafe_url", html: null });
    expect(r.visibleText ?? null).toBeNull();
    await opener.close();
  });
});

describe("VISIBLE_TEXT_SCRIPT", () => {
  it("opens <details>, un-hides aria-controls panels (at most 300) and reads body.innerText", () => {
    expect(VISIBLE_TEXT_SCRIPT).toContain("details");
    expect(VISIBLE_TEXT_SCRIPT).toContain('[aria-expanded="false"][aria-controls]');
    expect(VISIBLE_TEXT_SCRIPT).toContain("300");
    expect(VISIBLE_TEXT_SCRIPT).toContain("document.body.innerText");
    // No clicks: a click can navigate.
    expect(VISIBLE_TEXT_SCRIPT).not.toMatch(/\.click\(/);
  });
});
