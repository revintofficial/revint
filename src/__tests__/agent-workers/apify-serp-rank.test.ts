/**
 * Unit tests for APIFY_SERP_RANK worker.
 *
 * SERP rank is mode="async-apify": the production path is
 * `start(ctx)` -> Apify webhook -> `finalize(ctx, payload)`. A sync
 * `run(ctx)` adapter still exists for local dev without a public
 * webhook ingress. We exercise:
 *
 *   - start() schedules `runAsync` with the right webhook URL and
 *     short-circuits with `{ skipped: true }` when Apify is not
 *     configured or the lead has no usable queries.
 *   - finalize() and run() both produce identical post-processed
 *     output (snapshots, harvested socials, audit-row merge) given
 *     the same Apify items - because they share processItems().
 *   - memoryWrites() turns snapshots into SERP_SNAPSHOT memory
 *     rows.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as ApifyMock from "../_helpers/mock-apify";
import type {
  AgentWorkerContext,
  ApifyFinalizePayload,
} from "@/lib/agent-workers/types";

vi.mock("@/lib/apify", () => ApifyMock);

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    websiteAudit: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
// SERP rank reads getAppBaseUrl() to compute the webhook URL passed
// to runAsync. Stub to a known production-like value so the assertion
// on the webhook URL stays stable across CI environments where
// NEXT_PUBLIC_APP_URL / VERCEL_URL may or may not be set.
vi.mock("@/lib/email/from", () => ({
  getAppBaseUrl: () => "https://app.example.com",
}));

import {
  run,
  start,
  finalize,
  memoryWrites,
} from "@/lib/agent-workers/apify/serp-rank";

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

function makeFinalizePayload(
  items: unknown[],
  costUsdCents = 0,
): ApifyFinalizePayload {
  return {
    apifyRunId: "apify_run_mock",
    items,
    costUsdCents,
    status: "SUCCEEDED",
  };
}

beforeEach(() => {
  ApifyMock.resetApifyMock();
  prismaMock.websiteAudit.findUnique.mockReset();
  prismaMock.websiteAudit.upsert.mockReset();
  // Default: audit row exists with no socials yet. Individual tests
  // can override when they want to exercise the "already has socials"
  // or "no audit row yet" branches.
  prismaMock.websiteAudit.findUnique.mockResolvedValue({ socialProfiles: {} });
  prismaMock.websiteAudit.upsert.mockResolvedValue({ id: "audit_1" });
});

describe("APIFY_SERP_RANK - start (async kickoff)", () => {
  it("returns skipped when Apify is not configured (no actor scheduled)", async () => {
    ApifyMock.setConfigured(false);
    const result = await start(makeCtx());
    expect(result).toMatchObject({ skipped: true, reason: "apify_not_configured" });
    expect(ApifyMock.runAsync).not.toHaveBeenCalled();
  });

  it("schedules runAsync with the correct webhook URL + agentRunId on the happy path", async () => {
    const result = await start(makeCtx());
    expect("apifyRunId" in result && result.apifyRunId).toBe("apify_run_mock");
    expect(ApifyMock.runAsync).toHaveBeenCalledTimes(1);
    const [actorId, input, opts] = ApifyMock.runAsync.mock.calls[0];
    expect(actorId).toBe("apify/google-search-scraper");
    expect(input).toMatchObject({
      resultsPerPage: 10,
      maxPagesPerQuery: 1,
      languageCode: "en",
      countryCode: "gb",
    });
    expect(opts).toMatchObject({
      webhookUrl: "https://app.example.com/api/webhooks/apify",
      agentRunId: "run_1",
      timeoutSec: 180,
    });
  });
});

describe("APIFY_SERP_RANK - finalize (webhook callback)", () => {
  it("happy path returns snapshots[] and propagates costUsdCents", async () => {
    const out = await finalize(
      makeCtx(),
      makeFinalizePayload(
        [
          {
            searchQuery: { term: "Test Biz" },
            organicResults: [
              { position: 1, url: "https://competitor.example/", title: "Comp" },
              { position: 2, url: "https://testbiz.example/", title: "Test Biz" },
              { position: 3, url: "https://another.example/", title: "Other" },
            ],
          },
        ],
        25,
      ),
    );
    expect(out.costUsdCents).toBe(25);
    const o = out.output as { snapshots: Array<{ rank: number | null }>; costUsdCents: number };
    expect(o.snapshots[0].rank).toBe(2);
    expect(o.costUsdCents).toBe(25);
  });

  it("rank is null when lead's domain is not in top 10", async () => {
    const out = await finalize(
      makeCtx(),
      makeFinalizePayload(
        [
          {
            searchQuery: { term: "Test Biz" },
            organicResults: [
              { position: 1, url: "https://a.example/", title: "A" },
              { position: 2, url: "https://b.example/", title: "B" },
            ],
          },
        ],
        5,
      ),
    );
    const o = out.output as { snapshots: Array<{ rank: number | null }> };
    expect(o.snapshots[0].rank).toBeNull();
  });

  it("empty Apify response returns empty snapshots", async () => {
    const out = await finalize(makeCtx(), makeFinalizePayload([], 0));
    const o = out.output as { snapshots: unknown[] };
    expect(o.snapshots).toEqual([]);
  });

  it("malformed Apify response does not throw, filters out invalid entries", async () => {
    const out = await finalize(
      makeCtx(),
      makeFinalizePayload([{ garbage: "payload" }], 1),
    );
    const o = out.output as { snapshots: unknown[] };
    expect(o.snapshots).toEqual([]);
  });
});

describe("APIFY_SERP_RANK - run (sync fallback for local dev)", () => {
  it("skips when Apify is not configured", async () => {
    ApifyMock.setConfigured(false);
    const result = await run(makeCtx());
    expect(result.output).toMatchObject({ skipped: true });
    expect(ApifyMock.runSync).not.toHaveBeenCalled();
  });

  it("happy path returns the same shape finalize would for the same items", async () => {
    ApifyMock.setRunSyncResponse(
      [
        {
          searchQuery: { term: "Test Biz" },
          organicResults: [
            { position: 1, url: "https://competitor.example/", title: "Comp" },
            { position: 2, url: "https://testbiz.example/", title: "Test Biz" },
          ],
        },
      ],
      25,
    );
    const result = await run(makeCtx());
    expect(result.costUsdCents).toBe(25);
    const out = result.output as { snapshots: Array<{ rank: number | null }>; costUsdCents: number };
    expect(out.snapshots[0].rank).toBe(2);
    expect(out.costUsdCents).toBe(25);
  });
});

describe("APIFY_SERP_RANK - social profile harvesting (via finalize)", () => {
  it("extracts Instagram, Facebook, LinkedIn URLs from organic results and upserts into WebsiteAudit", async () => {
    const result = await finalize(
      makeCtx(),
      makeFinalizePayload(
        [
          {
            searchQuery: { term: "Test Biz" },
            organicResults: [
              { position: 1, url: "https://testbiz.example/", title: "Test Biz" },
              { position: 2, url: "https://www.instagram.com/testbiz/", title: "Instagram" },
              { position: 3, url: "https://www.facebook.com/testbiz", title: "Facebook" },
              { position: 4, url: "https://uk.linkedin.com/company/testbiz", title: "LinkedIn" },
            ],
          },
        ],
        30,
      ),
    );
    expect(prismaMock.websiteAudit.upsert).toHaveBeenCalledTimes(1);
    const upsertArg = prismaMock.websiteAudit.upsert.mock.calls[0][0];
    expect(upsertArg.where).toEqual({ leadId: "lead_1" });
    expect(upsertArg.update.socialProfiles).toMatchObject({
      instagram: "https://www.instagram.com/testbiz/",
      facebook: "https://www.facebook.com/testbiz",
      linkedin: "https://uk.linkedin.com/company/testbiz",
    });
    const out = result.output as {
      socialProfilesFound: Record<string, string>;
      socialProfilesMerged: number;
    };
    expect(out.socialProfilesMerged).toBe(3);
    expect(out.socialProfilesFound).toMatchObject({
      instagram: "https://www.instagram.com/testbiz/",
      facebook: "https://www.facebook.com/testbiz",
      linkedin: "https://uk.linkedin.com/company/testbiz",
    });
  });

  it("does NOT overwrite existing audit socials - crawler-scraped profiles win", async () => {
    prismaMock.websiteAudit.findUnique.mockResolvedValue({
      socialProfiles: { instagram: "https://instagram.com/canonical_handle" },
    });
    const result = await finalize(
      makeCtx(),
      makeFinalizePayload(
        [
          {
            searchQuery: { term: "Test Biz" },
            organicResults: [
              { position: 1, url: "https://instagram.com/wrong_account/", title: "IG" },
              { position: 2, url: "https://facebook.com/testbiz", title: "FB" },
            ],
          },
        ],
        10,
      ),
    );
    const upsertArg = prismaMock.websiteAudit.upsert.mock.calls[0][0];
    expect(upsertArg.update.socialProfiles.instagram).toBe("https://instagram.com/canonical_handle");
    expect(upsertArg.update.socialProfiles.facebook).toBe("https://facebook.com/testbiz");
    const out = result.output as { socialProfilesMerged: number };
    expect(out.socialProfilesMerged).toBe(1);
  });

  it("creates the WebsiteAudit row with empty url when the lead has no website", async () => {
    prismaMock.websiteAudit.findUnique.mockResolvedValue(null);
    await finalize(
      makeCtx({
        lead: {
          id: "lead_1",
          workspaceId: "ws_1",
          businessName: "Test Biz",
          formattedAddress: "1 Test St",
          websiteUrl: null,
          hasWebsite: false,
          websiteAudit: null,
          salesOpportunity: null,
          reviewAnalysis: null,
          placeId: "p1",
          borough: null,
          phone: null,
          googleMapsUri: null,
          primaryType: "electrician",
          rating: null,
          reviewCount: null,
          businessStatus: "OPERATIONAL",
          sourceQuery: null,
          sourceLat: null,
          sourceLng: null,
          crawlStatus: "NO_WEBSITE",
          analyzeStatus: "PENDING",
          reviewAnalysisStatus: "PENDING",
          createdAt: new Date(),
          updatedAt: new Date(),
        } as never,
      }),
      makeFinalizePayload(
        [
          {
            searchQuery: { term: "Test Biz" },
            organicResults: [
              { position: 1, url: "https://instagram.com/testbiz/", title: "IG" },
            ],
          },
        ],
        5,
      ),
    );
    const upsertArg = prismaMock.websiteAudit.upsert.mock.calls[0][0];
    expect(upsertArg.create).toMatchObject({
      leadId: "lead_1",
      url: "",
      socialProfiles: { instagram: "https://instagram.com/testbiz/" },
    });
  });

  it("skips the audit write entirely when no socials were surfaced", async () => {
    await finalize(
      makeCtx(),
      makeFinalizePayload(
        [
          {
            searchQuery: { term: "Test Biz" },
            organicResults: [
              { position: 1, url: "https://testbiz.example/", title: "Test Biz" },
              { position: 2, url: "https://yelp.com/biz/testbiz", title: "Yelp" },
            ],
          },
        ],
        3,
      ),
    );
    expect(prismaMock.websiteAudit.upsert).not.toHaveBeenCalled();
  });

  it("handles x.com and youtu.be aliases", async () => {
    await finalize(
      makeCtx(),
      makeFinalizePayload(
        [
          {
            searchQuery: { term: "Test Biz" },
            organicResults: [
              { position: 1, url: "https://x.com/testbiz", title: "X" },
              { position: 2, url: "https://youtu.be/abc123", title: "YouTube video" },
            ],
          },
        ],
        5,
      ),
    );
    const upsertArg = prismaMock.websiteAudit.upsert.mock.calls[0][0];
    expect(upsertArg.update.socialProfiles).toMatchObject({
      twitter: "https://x.com/testbiz",
      youtube: "https://youtu.be/abc123",
    });
  });
});

describe("APIFY_SERP_RANK - memoryWrites", () => {
  it("returns SERP_SNAPSHOT kind entries", () => {
    const writes = memoryWrites(
      {
        snapshots: [
          { query: "x", rank: 2, topResults: [{ position: 1, url: "u", title: "t" }] },
        ],
      },
      makeCtx(),
    );
    expect(writes).toHaveLength(1);
    expect(writes[0].kind).toBe("SERP_SNAPSHOT");
    expect(writes[0].metadata?.rank).toBe(2);
  });

  it("returns empty array when no snapshots", () => {
    expect(memoryWrites({}, makeCtx())).toEqual([]);
  });
});
