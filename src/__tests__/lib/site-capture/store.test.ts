// src/__tests__/lib/site-capture/store.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SiteCaptureResult } from "@/lib/site-capture/types";

const mocks = vi.hoisted(() => ({
  deleteMany: vi.fn(),
  create: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    siteCapture: { deleteMany: mocks.deleteMany, create: mocks.create },
    $transaction: mocks.transaction,
  },
}));

import { saveSiteCapture } from "@/lib/site-capture/store";

const capture: SiteCaptureResult = {
  rootUrl: "https://bistro.test/",
  status: "complete",
  startedAt: "2026-10-04T10:00:00.000Z",
  durationMs: 12_345.6,
  sitemapUrlCount: 7,
  ledger: [{ url: "https://bistro.test/", finalUrl: "https://bistro.test/", type: "home", source: "home_link", outcome: "opened", reason: null, httpStatus: 200 }],
  pages: [
    {
      url: "https://bistro.test/",
      finalUrl: "https://bistro.test/",
      type: "home",
      httpStatus: 200,
      title: "Bistro",
      text: "Welcome",
      links: [{ text: "Menu", href: "https://bistro.test/menu" }],
      embeds: [],
      jsonLd: [{ name: "Bis\u0000tro" }],
      thirdPartyRequests: ["https://www.sevenrooms.com/widget/embed.js"],
      source: "browser",
      needsOcr: false,
      html: "<html>raw</html>",
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.deleteMany.mockReturnValue("delete-op");
  mocks.create.mockReturnValue("create-op");
  mocks.transaction.mockResolvedValue([]);
});

describe("saveSiteCapture", () => {
  it("replaces the lead's capture in one transaction, scoped by workspace", async () => {
    await saveSiteCapture({ workspaceId: "ws_1", leadId: "lead_1", capture });

    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { leadId: "lead_1", workspaceId: "ws_1" } });
    expect(mocks.transaction).toHaveBeenCalledWith(["delete-op", "create-op"]);
    const data = mocks.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      workspaceId: "ws_1",
      leadId: "lead_1",
      rootUrl: "https://bistro.test/",
      status: "complete",
      durationMs: 12_346,
      pageCount: 1,
      sitemapUrlCount: 7,
    });
    expect(data.startedAt).toEqual(new Date("2026-10-04T10:00:00.000Z"));
    expect(data.ledger).toHaveLength(1);
  });

  it("stores every page with the workspace id and without raw HTML", async () => {
    await saveSiteCapture({ workspaceId: "ws_1", leadId: "lead_1", capture });
    const [page] = mocks.create.mock.calls[0][0].data.pages.create;
    expect(page).toMatchObject({ workspaceId: "ws_1", url: "https://bistro.test/", type: "home", source: "browser", text: "Welcome" });
    expect(page).not.toHaveProperty("html");
  });

  // Review Focus 5: jsonb rejects \u0000 just like text does.
  it("strips NUL characters from JSON values", async () => {
    await saveSiteCapture({ workspaceId: "ws_1", leadId: "lead_1", capture });
    const [page] = mocks.create.mock.calls[0][0].data.pages.create;
    expect(page.jsonLd).toEqual([{ name: "Bistro" }]);
  });

  it("keeps a literal backslash-u0000 text sequence unchanged", async () => {
    const literals = ["x\\u0000y", "x\\u0000", "x\\u0000bc"];
    const withLiterals: SiteCaptureResult = {
      ...capture,
      pages: [{ ...capture.pages[0], jsonLd: literals.map((name) => ({ name })), links: literals.map((text) => ({ text, href: "https://bistro.test/" })) }],
    };
    await expect(saveSiteCapture({ workspaceId: "ws_1", leadId: "lead_1", capture: withLiterals })).resolves.toBeUndefined();
    const [page] = mocks.create.mock.calls[0][0].data.pages.create;
    expect(page.jsonLd).toEqual(literals.map((name) => ({ name })));
    expect(page.links.map((l: { text: string }) => l.text)).toEqual(literals);
  });

  it("strips NUL from nested object keys and array elements", async () => {
    const nested: SiteCaptureResult = {
      ...capture,
      pages: [{ ...capture.pages[0], jsonLd: [{ outer: { "na\u0000me": "ok" }, list: ["a\u0000b", ["c\u0000"]] }] }],
    };
    await saveSiteCapture({ workspaceId: "ws_1", leadId: "lead_1", capture: nested });
    const [page] = mocks.create.mock.calls[0][0].data.pages.create;
    expect(page.jsonLd).toEqual([{ outer: { name: "ok" }, list: ["ab", ["c"]] }]);
  });

  it("strips NUL from page text and title", async () => {
    const dirty: SiteCaptureResult = {
      ...capture,
      pages: [{ ...capture.pages[0], text: "Wel\u0000come", title: "Bis\u0000tro" }],
    };
    await saveSiteCapture({ workspaceId: "ws_1", leadId: "lead_1", capture: dirty });
    const [page] = mocks.create.mock.calls[0][0].data.pages.create;
    expect(page.text).toBe("Welcome");
    expect(page.title).toBe("Bistro");
  });
});
