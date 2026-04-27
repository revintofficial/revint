/**
 * Unit tests for APIFY_INSTAGRAM_DEEP worker.
 *
 * The worker pulls the instagram handle from the WebsiteAudit row via
 * prisma.websiteAudit.findUnique (NOT from ctx.lead.websiteAudit).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as ApifyMock from "../_helpers/mock-apify";
import type { AgentWorkerContext } from "@/lib/agent-workers/types";

vi.mock("@/lib/apify", () => ApifyMock);

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    websiteAudit: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { run, memoryWrites } from "@/lib/agent-workers/apify/instagram-deep";

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
});

describe("APIFY_INSTAGRAM_DEEP - common matrix", () => {
  it("skips when Apify is not configured", async () => {
    ApifyMock.setConfigured(false);
    const result = await run(makeCtx());
    expect(result.output).toMatchObject({ skipped: true });
    expect(ApifyMock.runSync).not.toHaveBeenCalled();
  });

  it("skips when the audit row has no instagram handle", async () => {
    prismaMock.websiteAudit.findUnique.mockResolvedValue({ socialProfiles: {} });
    const result = await run(makeCtx());
    expect(result.output).toMatchObject({ skipped: true, reason: /instagram/ });
    expect(ApifyMock.runSync).not.toHaveBeenCalled();
  });

  it("happy path returns posts[] and propagates costUsdCents", async () => {
    prismaMock.websiteAudit.findUnique.mockResolvedValue({
      socialProfiles: { instagram: "https://instagram.com/testbiz" },
    });
    ApifyMock.setRunSyncResponse(
      [
        { id: "p1", url: "https://ig.com/p1", caption: "New reel!", likesCount: 100, commentsCount: 10, timestamp: "2025-01-01" },
        { id: "p2", url: "https://ig.com/p2", caption: "Another post", likesCount: 50, commentsCount: 4 },
      ],
      33,
    );
    const result = await run(makeCtx());
    expect(result.costUsdCents).toBe(33);
    const out = result.output as { posts: unknown[]; count: number; costUsdCents: number };
    expect(out.count).toBe(2);
    expect(out.costUsdCents).toBe(33);
  });

  it("empty Apify response returns count=0, no crash", async () => {
    prismaMock.websiteAudit.findUnique.mockResolvedValue({
      socialProfiles: { instagram: "https://instagram.com/testbiz" },
    });
    ApifyMock.setRunSyncResponse([], 0);
    const result = await run(makeCtx());
    const out = result.output as { count: number };
    expect(out.count).toBe(0);
  });

  it("malformed Apify response does not throw and filters out invalid entries", async () => {
    prismaMock.websiteAudit.findUnique.mockResolvedValue({
      socialProfiles: { instagram: "https://instagram.com/testbiz" },
    });
    ApifyMock.setRunSyncResponse([{ garbage: "payload" }], 2);
    const result = await run(makeCtx());
    const out = result.output as { count: number };
    expect(out.count).toBe(0);
  });
});

describe("APIFY_INSTAGRAM_DEEP - memoryWrites", () => {
  it("returns SOCIAL_POST kind entries when posts present", () => {
    const writes = memoryWrites(
      {
        posts: [
          { id: "p1", caption: "Hello world", likes: 1, comments: 0, url: "u", timestamp: "t" },
          { id: "p2", caption: "Another", likes: 2, comments: 1 },
        ],
      },
      makeCtx(),
    );
    expect(writes).toHaveLength(2);
    expect(writes[0].kind).toBe("SOCIAL_POST");
    expect(writes[0].metadata?.platform).toBe("instagram");
  });

  it("returns empty array when posts missing", () => {
    expect(memoryWrites({}, makeCtx())).toEqual([]);
  });
});
