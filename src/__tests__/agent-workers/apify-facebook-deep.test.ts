/**
 * Unit tests for APIFY_FACEBOOK_DEEP worker.
 *
 * Handle is pulled from WebsiteAudit.socialProfiles.facebook.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as ApifyMock from "../_helpers/mock-apify";
import type { AgentWorkerContext } from "@/lib/agent-workers/types";

vi.mock("@/lib/apify", () => ApifyMock);

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { websiteAudit: { findUnique: vi.fn() } },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { run, memoryWrites } from "@/lib/agent-workers/apify/facebook-deep";

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
  prismaMock.websiteAudit.findUnique.mockReset();
  prismaMock.websiteAudit.findUnique.mockResolvedValue({
    socialProfiles: { facebook: "https://facebook.com/testbiz" },
  });
});

describe("APIFY_FACEBOOK_DEEP - common matrix", () => {
  it("skips when Apify is not configured", async () => {
    ApifyMock.setConfigured(false);
    const result = await run(makeCtx());
    expect(result.output).toMatchObject({ skipped: true });
    expect(ApifyMock.runSync).not.toHaveBeenCalled();
  });

  it("skips when the audit row has no facebook handle", async () => {
    prismaMock.websiteAudit.findUnique.mockResolvedValue({ socialProfiles: {} });
    const result = await run(makeCtx());
    expect(result.output).toMatchObject({ skipped: true, reason: /facebook/ });
    expect(ApifyMock.runSync).not.toHaveBeenCalled();
  });

  it("happy path returns posts[] and propagates costUsdCents", async () => {
    ApifyMock.setRunSyncResponse(
      [
        { postId: "p1", text: "Hello world", likesCount: 3, commentsCount: 1, sharesCount: 0, time: "2025-01-01" },
      ],
      14,
    );
    const result = await run(makeCtx());
    expect(result.costUsdCents).toBe(14);
    const out = result.output as { count: number; costUsdCents: number };
    expect(out.count).toBe(1);
    expect(out.costUsdCents).toBe(14);
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

describe("APIFY_FACEBOOK_DEEP - memoryWrites", () => {
  it("returns SOCIAL_POST kind entries (platform=facebook)", () => {
    const writes = memoryWrites(
      { posts: [{ id: "p1", text: "Hello" }, { id: "p2", text: "World" }] },
      makeCtx(),
    );
    expect(writes).toHaveLength(2);
    expect(writes[0].kind).toBe("SOCIAL_POST");
    expect(writes[0].metadata?.platform).toBe("facebook");
  });

  it("returns empty array when posts missing", () => {
    expect(memoryWrites({}, makeCtx())).toEqual([]);
  });
});
