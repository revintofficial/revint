/**
 * Unit tests for APIFY_WEB_CRAWL_DEEP worker.
 *
 * Covers:
 *   - Common matrix
 *   - Chunk boundary: long pages split into <=2000-char chunks.
 *   - Title prefix: chunk text starts with the page title.
 *   - Paragraph boundary split: no chunk begins mid-word when paragraphs
 *     separate the source text.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as ApifyMock from "../_helpers/mock-apify";
import type { AgentWorkerContext } from "@/lib/agent-workers/types";

vi.mock("@/lib/apify", () => ApifyMock);
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { run, memoryWrites } from "@/lib/agent-workers/apify/web-crawl-deep";

function makeCtx(overrides: Partial<AgentWorkerContext> = {}): AgentWorkerContext {
  return {
    runId: "run_1",
    workspaceId: "ws_1",
    workspacePlan: "PRO",
    leadId: "lead_1",
    userId: "user_1",
    lead: {
      id: "lead_1",
      workspaceId: "ws_1",
      businessName: "Test Biz",
      formattedAddress: "1 Test St",
      googleMapsUri: "https://maps.google.com/?q=Test+Biz",
      primaryType: "electrician",
      websiteUrl: "https://testbiz.example",
      websiteAudit: null,
      salesOpportunity: null,
      reviewAnalysis: null,
      placeId: "p1",
      borough: null,
      phone: null,
      hasWebsite: true,
      rating: 4.5,
      reviewCount: 10,
      businessStatus: "OPERATIONAL",
      sourceQuery: null,
      sourceLat: null,
      sourceLng: null,
      crawlStatus: "CRAWLED",
      analyzeStatus: "ANALYZED",
      reviewAnalysisStatus: "ANALYZED",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never,
    workspace: {
      id: "ws_1",
      name: "Test WS",
      slug: "test-ws",
      plan: "PRO",
      language: "en",
      tone: null,
      offerName: null,
      valueProposition: null,
      offerHook: null,
      objective: null,
      senderName: null,
      conversionLink: null,
      socialProof: null,
      branding: null,
      niche: "WEB_AGENCY",
    },
    memory: [],
    plannerSessionId: null,
    emit: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  ApifyMock.resetApifyMock();
});

describe("APIFY_WEB_CRAWL_DEEP - common matrix", () => {
  it("skips when Apify is not configured", async () => {
    ApifyMock.setConfigured(false);
    const result = await run(makeCtx());
    expect(result.output).toMatchObject({ skipped: true });
    expect(ApifyMock.runSync).not.toHaveBeenCalled();
  });

  it("skips when lead has no websiteUrl", async () => {
    const ctx = makeCtx();
    (ctx.lead as unknown as { websiteUrl: string | null }).websiteUrl = null;
    const result = await run(ctx);
    expect(result.output).toMatchObject({ skipped: true, reason: "no_website" });
    expect(ApifyMock.runSync).not.toHaveBeenCalled();
  });

  it("happy path returns pages[] and propagates costUsdCents", async () => {
    ApifyMock.setRunSyncResponse(
      [
        { url: "https://testbiz.example/", title: "Home", markdown: "# Home\n\nWelcome!" },
        { url: "https://testbiz.example/about", title: "About", text: "About us." },
      ],
      77,
    );
    const result = await run(makeCtx());
    expect(result.costUsdCents).toBe(77);
    const out = result.output as { pages: Array<{ url: string; title: string; text: string }>; pageCount: number };
    expect(out.pageCount).toBe(2);
    expect(out.pages[0].title).toBe("Home");
  });

  it("empty Apify response returns pageCount=0, no crash", async () => {
    ApifyMock.setRunSyncResponse([], 0);
    const result = await run(makeCtx());
    const out = result.output as { pageCount: number };
    expect(out.pageCount).toBe(0);
  });

  it("malformed Apify response does not throw, filters out invalid entries", async () => {
    ApifyMock.setRunSyncResponse([{ garbage: "payload" }], 1);
    const result = await run(makeCtx());
    const out = result.output as { pageCount: number };
    expect(out.pageCount).toBe(0);
  });
});

describe("APIFY_WEB_CRAWL_DEEP - memoryWrites chunking", () => {
  it("every chunk is <= 2000 chars and returns PROSPECT_KB_CHUNK kind", () => {
    const para = "word ".repeat(300).trim();
    const text = `${para}\n\n${para}\n\n${para}`;
    const output = {
      pages: [{ url: "https://x.example/p", title: "Big Page", text }],
    };
    const writes = memoryWrites(output, makeCtx());
    expect(writes.length).toBeGreaterThan(1);
    for (const w of writes) {
      expect(w.kind).toBe("PROSPECT_KB_CHUNK");
      expect(w.text.length).toBeLessThanOrEqual(2000 + "Big Page\n\n".length + 10);
    }
  });

  it("chunk text starts with the page title prefix", () => {
    const para = "word ".repeat(300).trim();
    const text = `${para}\n\n${para}`;
    const output = {
      pages: [{ url: "https://x.example/p", title: "Big Page", text }],
    };
    const writes = memoryWrites(output, makeCtx());
    for (const w of writes) {
      expect(w.text.startsWith("Big Page\n\n")).toBe(true);
    }
  });

  it("paragraph-boundary splits do not start in the middle of a word", () => {
    const para1 = "Alpha ".repeat(300).trim();
    const para2 = "Bravo ".repeat(300).trim();
    const text = `${para1}\n\n${para2}`;
    const output = {
      pages: [{ url: "https://x.example/p", title: "P", text }],
    };
    const writes = memoryWrites(output, makeCtx());
    for (const w of writes) {
      const body = w.text.replace(/^P\n\n/, "");
      // Each chunk should start with one of our known paragraph words.
      expect(/^(Alpha|Bravo)/.test(body)).toBe(true);
    }
  });

  it("returns empty array when output has no pages", () => {
    expect(memoryWrites({}, makeCtx())).toEqual([]);
  });
});
