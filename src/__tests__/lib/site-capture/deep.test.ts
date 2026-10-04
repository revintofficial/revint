// src/__tests__/lib/site-capture/deep.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenedPage } from "@/lib/site-capture/types";
import type { WebsiteFeatures } from "@/types";

const mocks = vi.hoisted(() => ({
  crawlHomepage: vi.fn(),
  createOpener: vi.fn(),
  open: vi.fn(),
  close: vi.fn(),
}));

vi.mock("@/lib/crawler", () => ({
  crawlHomepage: mocks.crawlHomepage,
  getBrowser: async () => ({}),
  CRAWLER_USER_AGENT: "test-agent",
}));
vi.mock("@/lib/site-capture/opener", () => ({
  createPlaywrightOpener: mocks.createOpener,
  fetchTextSafe: async () => null,
}));
vi.mock("@/lib/site-capture/documents", () => ({
  fetchPdfText: async () => ({ ok: false, reason: "not_pdf", httpStatus: 200 }),
}));

import { crawlWebsiteDeep } from "@/lib/site-capture/deep";

const HOME = "https://bistro.test/";
const html = (body: string) => `<html><head><title>Bistro</title></head><body>${body}</body></html>`;

function feat(overrides: Partial<WebsiteFeatures> = {}): WebsiteFeatures {
  return {
    url: HOME,
    reachable: true,
    crawlError: null,
    httpStatus: 200,
    loadTimeMs: 900,
    securityHeaders: {},
    consoleErrors: [],
    ...overrides,
  } as unknown as WebsiteFeatures;
}

const opened = (url: string, body: string, source: OpenedPage["source"] = "browser"): OpenedPage => ({
  finalUrl: url,
  status: 200,
  html: html(body),
  thirdPartyRequests: [],
  source,
  error: null,
});
const notFound = (url: string): OpenedPage => ({ finalUrl: url, status: 404, html: null, thirdPartyRequests: [], source: "browser", error: "http_error" });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.close.mockResolvedValue(undefined);
  mocks.createOpener.mockResolvedValue({ open: mocks.open, close: mocks.close });
  mocks.open.mockImplementation(async (url: string) => notFound(url));
});

describe("crawlWebsiteDeep", () => {
  it("captures the site, reads today's subpages from the capture and attaches coverage", async () => {
    mocks.crawlHomepage.mockResolvedValue({
      features: feat(),
      home: { finalUrl: HOME, html: html(`<a href="/menu">Menu</a>`), thirdPartyRequests: [] },
    });
    mocks.open.mockImplementation(async (url: string) => (url.endsWith("/menu") ? opened(url, "Starters and mains") : notFound(url)));

    const { features, capture } = await crawlWebsiteDeep(HOME, "restaurant");

    expect(capture?.status).toBe("complete");
    expect(features.siteFacts?.menuPageSeen).toBe(true);
    expect(features.siteFacts?.coverage?.opened).toBe(2);
    expect(mocks.close).toHaveBeenCalledTimes(1);
  });

  it("does not capture a social profile", async () => {
    mocks.crawlHomepage.mockResolvedValue({ features: feat({ reachable: false, crawlError: "SOCIAL_MEDIA_ONLY" }), home: null });
    const { capture } = await crawlWebsiteDeep("https://instagram.com/bistro");
    expect(capture).toBeNull();
    expect(mocks.createOpener).not.toHaveBeenCalled();
  });

  it("recovers a bot-blocked homepage through the opener's fallbacks", async () => {
    mocks.crawlHomepage.mockResolvedValue({ features: feat({ reachable: false, crawlError: "BOT_BLOCKED_4XX", httpStatus: 403 }), home: null });
    mocks.open.mockImplementation(async (url: string) => (url === HOME ? opened(url, "Welcome to Bistro", "http") : notFound(url)));

    const { features, capture } = await crawlWebsiteDeep(HOME, "restaurant");

    expect(features.reachable).toBe(true);
    expect(features.crawlError).toBeNull();
    expect(features.loadTimeMs).toBe(900);
    expect(capture?.status).toBe("complete");
    expect(features.siteFacts?.coverage).toBeDefined();
  });

  it("hands the homepage's rendered text to the capture as the homepage's text", async () => {
    mocks.crawlHomepage.mockResolvedValue({
      features: feat(),
      home: {
        finalUrl: HOME,
        html: html(`<a href="/menu">Menu</a><div style="display:none">A deposit is required for every booking.</div>`),
        thirdPartyRequests: [],
        visibleText: "Menu\nWelcome to Bistro",
      },
    });

    const { capture } = await crawlWebsiteDeep(HOME, "restaurant");

    expect(capture?.pages[0]).toMatchObject({ type: "home", text: "Menu Welcome to Bistro" });
  });

  it("uses the opener's rendered text for a recovered (bot-blocked) homepage", async () => {
    mocks.crawlHomepage.mockResolvedValue({ features: feat({ reachable: false, crawlError: "BOT_BLOCKED_4XX", httpStatus: 403 }), home: null });
    mocks.open.mockImplementation(async (url: string) =>
      url === HOME ? { ...opened(url, "Welcome to Bistro <div hidden>Hidden state</div>"), visibleText: "Welcome to Bistro" } : notFound(url),
    );

    const { capture } = await crawlWebsiteDeep(HOME, "restaurant");

    expect(capture?.pages[0]).toMatchObject({ type: "home", text: "Welcome to Bistro" });
  });

  it("records a homepage that stays blocked", async () => {
    mocks.crawlHomepage.mockResolvedValue({ features: feat({ reachable: false, crawlError: "BOT_BLOCKED_4XX", httpStatus: 403 }), home: null });
    mocks.open.mockResolvedValue({ finalUrl: HOME, status: 403, html: null, thirdPartyRequests: [], source: "browser", error: "blocked" });

    const { features, capture } = await crawlWebsiteDeep(HOME);

    expect(features.reachable).toBe(false);
    expect(capture).toMatchObject({ status: "blocked", pages: [] });
    expect(capture?.ledger).toEqual([
      { url: HOME, finalUrl: null, type: "home", source: "home_link", outcome: "failed", reason: "blocked", httpStatus: 403 },
    ]);
    expect(mocks.close).toHaveBeenCalledTimes(1);
  });

  it("records an unreachable homepage without opening anything", async () => {
    mocks.crawlHomepage.mockResolvedValue({ features: feat({ reachable: false, crawlError: "TIMEOUT", httpStatus: null }), home: null });
    const { capture } = await crawlWebsiteDeep(HOME);
    expect(capture).toMatchObject({ status: "failed" });
    expect(capture?.ledger[0]).toMatchObject({ outcome: "failed", reason: "timeout" });
    expect(mocks.open).not.toHaveBeenCalled();
  });
});
