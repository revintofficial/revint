/**
 * Unit tests for APIFY_COMPETITOR_ADS worker.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as ApifyMock from "../_helpers/mock-apify";
import type { AgentWorkerContext } from "@/lib/agent-workers/types";

vi.mock("@/lib/apify", () => ApifyMock);
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { run, memoryWrites } from "@/lib/agent-workers/apify/competitor-ads";

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

describe("APIFY_COMPETITOR_ADS - common matrix", () => {
  it("skips when Apify is not configured", async () => {
    ApifyMock.setConfigured(false);
    const result = await run(makeCtx());
    expect(result.output).toMatchObject({ skipped: true });
    expect(ApifyMock.runSync).not.toHaveBeenCalled();
  });

  it("skips when lead.primaryType is null", async () => {
    const ctx = makeCtx();
    (ctx.lead as unknown as { primaryType: string | null }).primaryType = null;
    const result = await run(ctx);
    expect(result.output).toMatchObject({ skipped: true, reason: "no_primary_type" });
    expect(ApifyMock.runSync).not.toHaveBeenCalled();
  });

  it("happy path returns ads[] and propagates costUsdCents", async () => {
    ApifyMock.setRunSyncResponse(
      [
        { ad_archive_id: "ad_1", page_name: "Comp Co", body_text: "Best deals", title: "Save 20%", cta_text: "Buy" },
      ],
      18,
    );
    const result = await run(makeCtx());
    expect(result.costUsdCents).toBe(18);
    const out = result.output as { count: number; costUsdCents: number };
    expect(out.count).toBe(1);
    expect(out.costUsdCents).toBe(18);
  });

  it("empty Apify response returns count=0", async () => {
    ApifyMock.setRunSyncResponse([], 0);
    const result = await run(makeCtx());
    const out = result.output as { count: number };
    expect(out.count).toBe(0);
  });

  it("malformed Apify response does not throw", async () => {
    ApifyMock.setRunSyncResponse([{ garbage: "payload" }], 1);
    const result = await run(makeCtx());
    const out = result.output as { count: number };
    expect(out.count).toBe(0);
  });
});

describe("APIFY_COMPETITOR_ADS - memoryWrites", () => {
  it("returns COMPETITOR_AD kind entries", () => {
    const writes = memoryWrites(
      { ads: [{ id: "a1", pageName: "X", body: "Hello", title: "T", cta: "Buy" }] },
      makeCtx(),
    );
    expect(writes).toHaveLength(1);
    expect(writes[0].kind).toBe("COMPETITOR_AD");
  });

  it("returns empty array when no ads", () => {
    expect(memoryWrites({}, makeCtx())).toEqual([]);
  });
});
