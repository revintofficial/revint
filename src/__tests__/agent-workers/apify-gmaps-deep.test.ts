/**
 * Unit tests for APIFY_GMAPS_DEEP worker.
 *
 * Covers:
 *   - Common matrix (skip-when-not-configured, happy path, costUsdCents
 *     propagation, memoryWrites kind, empty response, malformed response)
 *   - Review dedup: deleteMany invoked before createMany.
 *   - Email + social merge into WebsiteAudit preserves existing values.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as ApifyMock from "../_helpers/mock-apify";
import type { AgentWorkerContext } from "@/lib/agent-workers/types";

vi.mock("@/lib/apify", () => ApifyMock);

const { prismaMock } = vi.hoisted(() => {
  return {
    prismaMock: {
      googleReview: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      websiteAudit: {
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
    },
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { run, memoryWrites } from "@/lib/agent-workers/apify/gmaps-deep";

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
    },
    memory: [],
    plannerSessionId: null,
    emit: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  ApifyMock.resetApifyMock();
  prismaMock.googleReview.deleteMany.mockClear().mockResolvedValue({ count: 0 });
  prismaMock.googleReview.createMany.mockClear().mockResolvedValue({ count: 0 });
  prismaMock.websiteAudit.findUnique.mockReset();
  prismaMock.websiteAudit.update.mockReset().mockResolvedValue({});
});

describe("APIFY_GMAPS_DEEP - common matrix", () => {
  it("skips when Apify is not configured", async () => {
    ApifyMock.setConfigured(false);
    const result = await run(makeCtx());
    expect(result.output).toMatchObject({ skipped: true });
    expect(ApifyMock.runSync).not.toHaveBeenCalled();
  });

  it("happy path returns placeId + counts and propagates costUsdCents", async () => {
    ApifyMock.setRunSyncResponse(
      [
        {
          placeId: "ChIJabc",
          title: "Test Biz",
          reviews: [
            { reviewId: "r1", name: "Alice", stars: 5, text: "Great!", publishedAtDate: "2025-01-01" },
            { reviewId: "r2", name: "Bob", stars: 4, text: "Good service", publishedAtDate: "2025-02-01" },
          ],
          emails: [],
        },
      ],
      42,
    );
    const result = await run(makeCtx());
    expect(result.costUsdCents).toBe(42);
    const out = result.output as { placeId: string; reviewsCount: number; costUsdCents: number };
    expect(out.placeId).toBe("ChIJabc");
    expect(out.reviewsCount).toBe(2);
    expect(out.costUsdCents).toBe(42);
  });

  it("review dedup: deleteMany is invoked BEFORE createMany", async () => {
    ApifyMock.setRunSyncResponse(
      [
        {
          placeId: "p",
          reviews: [
            { name: "a", stars: 5, text: "one", publishedAtDate: "2025-01-01" },
            { name: "b", stars: 4, text: "two", publishedAtDate: "2025-02-01" },
            { name: "c", stars: 3, text: "three", publishedAtDate: "2025-03-01" },
          ],
        },
      ],
      10,
    );
    await run(makeCtx());
    expect(prismaMock.googleReview.deleteMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.googleReview.createMany).toHaveBeenCalledTimes(1);
    const delOrder = prismaMock.googleReview.deleteMany.mock.invocationCallOrder[0];
    const createOrder = prismaMock.googleReview.createMany.mock.invocationCallOrder[0];
    expect(delOrder).toBeLessThan(createOrder);
  });

  it("email + social merge into WebsiteAudit preserves existing emails and adds facebook", async () => {
    prismaMock.websiteAudit.findUnique.mockResolvedValue({
      id: "audit_1",
      contactEmails: ["b@x.com"],
      socialProfiles: {},
    });
    ApifyMock.setRunSyncResponse(
      [
        {
          placeId: "p",
          reviews: [],
          emails: ["a@x.com"],
          facebooks: ["https://fb.com/biz"],
        },
      ],
      5,
    );
    await run(makeCtx());
    expect(prismaMock.websiteAudit.update).toHaveBeenCalledTimes(1);
    const args = prismaMock.websiteAudit.update.mock.calls[0][0] as {
      where: { id: string };
      data: { contactEmails: string[]; socialProfiles: Record<string, string | null> };
    };
    expect(args.where.id).toBe("audit_1");
    expect(args.data.contactEmails).toEqual(["b@x.com", "a@x.com"]);
    expect(args.data.socialProfiles.facebook).toBe("https://fb.com/biz");
  });

  it("empty Apify response returns skipped (no place found)", async () => {
    ApifyMock.setRunSyncResponse([], 0);
    const result = await run(makeCtx());
    expect(result.output).toMatchObject({ skipped: true });
    expect(prismaMock.googleReview.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.googleReview.createMany).not.toHaveBeenCalled();
  });

  it("malformed Apify response does not throw, returns zero counts", async () => {
    ApifyMock.setRunSyncResponse([{ garbage: "payload" }], 3);
    const result = await run(makeCtx());
    const out = result.output as { reviewsCount: number; emailsFound: number; socialsFound: number };
    expect(out.reviewsCount).toBe(0);
    expect(out.emailsFound).toBe(0);
    expect(out.socialsFound).toBe(0);
    expect(prismaMock.googleReview.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.websiteAudit.update).not.toHaveBeenCalled();
  });
});

describe("APIFY_GMAPS_DEEP - memoryWrites", () => {
  it("returns a LEAD_PROFILE entry when reviewsCount > 0", () => {
    const writes = memoryWrites({ reviewsCount: 5, placeId: "p1" }, makeCtx());
    expect(writes).toHaveLength(1);
    expect(writes[0].kind).toBe("LEAD_PROFILE");
    expect(writes[0].leadId).toBe("lead_1");
  });

  it("returns empty array when reviewsCount is 0", () => {
    const writes = memoryWrites({ reviewsCount: 0 }, makeCtx());
    expect(writes).toEqual([]);
  });
});
