// src/__tests__/lib/crawler-visible-text.test.ts
/**
 * The deep path reads the homepage's rendered text where it reads the
 * homepage HTML; the shallow path (crawlWebsite) makes no new browser call.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  evaluated: [] as string[],
  visibleText: "Welcome to Bistro" as unknown,
}));

const HTML =
  `<html><head><title>Bistro</title><meta name="viewport" content="width=device-width"></head>` +
  `<body><p>Welcome to Bistro</p><div style="display:none">A deposit is required for every booking.</div></body></html>`;

vi.mock("playwright", () => {
  const page = {
    on: () => {},
    mainFrame: () => ({}),
    route: async () => {},
    goto: async () => ({ status: () => 200, headers: () => ({}), url: () => "https://bistro.test/" }),
    waitForTimeout: async () => {},
    content: async () => HTML,
    evaluate: async (fn: unknown) => {
      if (typeof fn === "function") return false; // the service-worker probe
      state.evaluated.push(String(fn));
      if (state.visibleText instanceof Error) throw state.visibleText;
      return state.visibleText;
    },
    setViewportSize: async () => {},
    close: async () => {},
  };
  return { chromium: { launch: async () => ({ isConnected: () => true, newPage: async () => page, close: async () => {} }) } };
});
vi.mock("@/lib/url-guard", () => ({ assertSafeFetchUrl: async (url: string) => new URL(url) }));

import { crawlHomepage, crawlWebsite } from "@/lib/crawler";

beforeEach(() => {
  state.evaluated = [];
  state.visibleText = "Welcome to Bistro";
});

describe("homepage rendered text", () => {
  it("crawlHomepage hands the homepage's rendered text to the deep capture", async () => {
    const { features, home } = await crawlHomepage("https://bistro.test/", "restaurant");
    expect(features.reachable).toBe(true);
    expect(home).toMatchObject({ html: HTML, visibleText: "Welcome to Bistro" });
    expect(state.evaluated).toHaveLength(1);
    expect(state.evaluated[0]).toContain("innerText");
  });

  it("crawlHomepage keeps the homepage with a null rendered text when the read fails", async () => {
    state.visibleText = new Error("Execution context was destroyed");
    const { features, home } = await crawlHomepage("https://bistro.test/", "restaurant");
    expect(features.reachable).toBe(true);
    expect(home).toMatchObject({ html: HTML, visibleText: null });
  });

  it("crawlWebsite (shallow) runs no rendered-text read", async () => {
    const features = await crawlWebsite("https://bistro.test/", "restaurant");
    expect(features.reachable).toBe(true);
    expect(state.evaluated).toEqual([]);
  });
});
