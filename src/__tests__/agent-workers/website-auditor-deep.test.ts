// src/__tests__/agent-workers/website-auditor-deep.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentWorkerContext } from "@/lib/agent-workers/types";
import type { SiteCaptureResult } from "@/lib/site-capture/types";
import type { WebsiteFeatures } from "@/types";

const mocks = vi.hoisted(() => ({
  crawlWebsite: vi.fn(),
  crawlWebsiteDeep: vi.fn(),
  saveSiteCapture: vi.fn(),
  leadUpdate: vi.fn(),
  leadUpdateMany: vi.fn(),
  auditUpsert: vi.fn(),
  warn: vi.fn(),
  truthLayerOn: vi.fn(() => false),
  multiVerifyWebsite: vi.fn(),
}));

vi.mock("@/lib/crawler", () => ({ crawlWebsite: mocks.crawlWebsite }));
vi.mock("@/lib/site-capture/deep", () => ({ crawlWebsiteDeep: mocks.crawlWebsiteDeep }));
vi.mock("@/lib/site-capture/store", () => ({ saveSiteCapture: mocks.saveSiteCapture }));
vi.mock("@/lib/prisma", () => ({
  prisma: { lead: { update: mocks.leadUpdate, updateMany: mocks.leadUpdateMany }, websiteAudit: { upsert: mocks.auditUpsert } },
}));
vi.mock("@/lib/feature-flags", () => ({ isTruthLayerFlagEnabled: mocks.truthLayerOn }));
vi.mock("@/lib/agent-workers/website-multi-verify", () => ({ multiVerifyWebsite: mocks.multiVerifyWebsite }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: mocks.warn, error: vi.fn(), debug: vi.fn() } }));

import { DeferError } from "@/lib/agent-workers/errors";
import { run } from "@/lib/agent-workers/website-auditor";
import { tryAcquireCaptureSlot } from "@/lib/site-capture/slots";

const URL_ = "https://acme.example";
const COVERAGE = { status: "complete", opened: 6, skipped: 1, failed: 0, durationMs: 21_000, notOpened: [] };

function features(overrides: Record<string, unknown> = {}): WebsiteFeatures {
  return {
    url: URL_,
    reachable: true,
    crawlError: null,
    httpStatus: 200,
    loadTimeMs: 900,
    https: true,
    mobileFriendlyGuess: true,
    title: "Acme",
    metaDescription: null,
    h1: null,
    hasContactForm: true,
    hasWhatsappLink: false,
    hasBookingSystem: false,
    hasEcommerce: false,
    servicesDetected: [],
    navItems: [],
    ctaLinks: [],
    brokenLinksCount: 0,
    structuredDataPresent: false,
    siteFacts: { coverage: COVERAGE },
    ...overrides,
  } as unknown as WebsiteFeatures;
}

const CAPTURE: SiteCaptureResult = {
  rootUrl: URL_,
  status: "complete",
  startedAt: "2026-10-04T10:00:00.000Z",
  durationMs: 21_000,
  pages: [],
  ledger: [],
  sitemapUrlCount: 0,
  candidateOverflow: 0,
};

function ctx(overrides: Partial<AgentWorkerContext> = {}, leadOverrides: Record<string, unknown> = {}): AgentWorkerContext {
  return {
    runId: "run_1",
    workspaceId: "ws_1",
    workspacePlan: "PRO",
    leadId: "lead_1",
    userId: "user_1",
    lead: {
      id: "lead_1",
      workspaceId: "ws_1",
      businessName: "Acme",
      formattedAddress: "1 Main St",
      primaryType: null,
      websiteUrl: URL_,
      websiteAudit: null,
      salesOpportunity: null,
      reviewAnalysis: null,
      ...leadOverrides,
    },
    workspace: { id: "ws_1", name: "Test", slug: "test", plan: "PRO" },
    memory: [],
    plannerSessionId: null,
    emit: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as AgentWorkerContext;
}

/** Takes every free capture slot; returns a function that gives them back. */
function occupyAllSlots(): () => void {
  const held: Array<() => void> = [];
  for (let r = tryAcquireCaptureSlot(); r; r = tryAcquireCaptureSlot()) held.push(r);
  return () => held.forEach((release) => release());
}
function freeSlots(): number {
  const held: Array<() => void> = [];
  for (let r = tryAcquireCaptureSlot(); r; r = tryAcquireCaptureSlot()) held.push(r);
  held.forEach((release) => release());
  return held.length;
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.SITE_CAPTURE_DEEP;
  mocks.leadUpdate.mockResolvedValue({});
  mocks.leadUpdateMany.mockResolvedValue({ count: 1 });
  mocks.truthLayerOn.mockReturnValue(false);
  mocks.auditUpsert.mockResolvedValue({});
  mocks.saveSiteCapture.mockResolvedValue(undefined);
  mocks.crawlWebsite.mockResolvedValue(features({ siteFacts: undefined }));
  mocks.crawlWebsiteDeep.mockResolvedValue({ features: features(), capture: CAPTURE });
});

afterEach(() => {
  delete process.env.SITE_CAPTURE_DEEP;
});

describe("WEBSITE_AUDITOR: deep capture", () => {
  it("runs the deep crawl with the run's abort signal and stores the capture under the lead's workspace", async () => {
    const signal = new AbortController().signal;
    const result = await run(ctx({ signal }));

    expect(mocks.crawlWebsiteDeep).toHaveBeenCalledWith(URL_, undefined, { signal });
    expect(mocks.crawlWebsite).not.toHaveBeenCalled();
    expect(mocks.saveSiteCapture).toHaveBeenCalledWith({ workspaceId: "ws_1", leadId: "lead_1", capture: CAPTURE });
    expect(mocks.auditUpsert).toHaveBeenCalledTimes(1);
    expect(result.output).toMatchObject({ reachable: true, coverage: COVERAGE });
    expect(freeSlots()).toBe(2);
  });

  it("defers without writing anything when every capture slot is taken", async () => {
    const release = occupyAllSlots();
    try {
      const attempt = run(ctx({ canDefer: true, deferCount: 1, queuedAt: new Date() }));
      await expect(attempt).rejects.toBeInstanceOf(DeferError);
      await attempt.catch((err: DeferError) => {
        expect(err.delayMs).toBeGreaterThanOrEqual(40_000);
        expect(err.delayMs).toBeLessThan(45_000);
      });
      expect(mocks.leadUpdate).not.toHaveBeenCalled();
      expect(mocks.crawlWebsiteDeep).not.toHaveBeenCalled();
      expect(mocks.crawlWebsite).not.toHaveBeenCalled();
    } finally {
      release();
    }
  });

  it("falls back to the shallow crawl once the run has waited thirty minutes", async () => {
    const release = occupyAllSlots();
    try {
      const queuedAt = new Date(Date.now() - 31 * 60_000);
      const result = await run(ctx({ canDefer: true, deferCount: 9, queuedAt }));
      expect(mocks.crawlWebsite).toHaveBeenCalledWith(URL_, undefined);
      expect(mocks.crawlWebsiteDeep).not.toHaveBeenCalled();
      expect(mocks.saveSiteCapture).not.toHaveBeenCalled();
      expect(result.output).toMatchObject({ reachable: true });
      expect(mocks.warn).toHaveBeenCalledWith("agent_workers.website_auditor.deep_skipped_capacity", expect.any(Object));
    } finally {
      release();
    }
  });

  it("runs shallow instead of deferring on the inline path", async () => {
    const release = occupyAllSlots();
    try {
      await run(ctx({ canDefer: false }));
      expect(mocks.crawlWebsite).toHaveBeenCalledTimes(1);
    } finally {
      release();
    }
  });

  it("honours the kill switch", async () => {
    process.env.SITE_CAPTURE_DEEP = "0";
    await run(ctx());
    expect(mocks.crawlWebsite).toHaveBeenCalledTimes(1);
    expect(mocks.crawlWebsiteDeep).not.toHaveBeenCalled();
  });

  it("does not take a slot for a social profile", async () => {
    mocks.crawlWebsite.mockResolvedValue(features({ reachable: false, crawlError: "SOCIAL_MEDIA_ONLY", siteFacts: undefined }));
    await run(ctx({}, { websiteUrl: "https://www.instagram.com/acme" }));
    expect(mocks.crawlWebsiteDeep).not.toHaveBeenCalled();
    expect(mocks.crawlWebsite).toHaveBeenCalledTimes(1);
  });

  // Review Focus 4: a failed or aborted capture must give its slot back.
  it("frees the slot when the deep crawl throws", async () => {
    mocks.crawlWebsiteDeep.mockRejectedValue(new Error("browser crashed"));
    const result = await run(ctx());
    expect(result.output).toMatchObject({ skipped: true, reason: "crawl_failed" });
    expect(freeSlots()).toBe(2);
  });

  it("writes nothing after the executor's deadline aborted the run", async () => {
    const controller = new AbortController();
    mocks.crawlWebsiteDeep.mockImplementation(async () => {
      controller.abort();
      return { features: features(), capture: { ...CAPTURE, status: "partial" } };
    });
    const result = await run(ctx({ signal: controller.signal }));
    expect(result.output).toEqual({ skipped: true, reason: "deadline_aborted" });
    expect(mocks.auditUpsert).not.toHaveBeenCalled();
    expect(mocks.saveSiteCapture).not.toHaveBeenCalled();
    expect(mocks.leadUpdate).toHaveBeenCalledTimes(1); // only the CRAWLING stamp before the crawl
    expect(freeSlots()).toBe(2);
  });

  it("writes nothing after the audit row when the deadline fires during its upsert", async () => {
    const controller = new AbortController();
    mocks.auditUpsert.mockImplementation(async () => {
      controller.abort();
      return {};
    });
    const result = await run(ctx({ signal: controller.signal }));
    expect(result.output).toEqual({ skipped: true, reason: "deadline_aborted" });
    expect(mocks.auditUpsert).toHaveBeenCalledTimes(1);
    expect(mocks.saveSiteCapture).not.toHaveBeenCalled();
    expect(mocks.leadUpdate).toHaveBeenCalledTimes(1); // only the CRAWLING stamp before the crawl
    expect(mocks.leadUpdate.mock.calls[0][0].data).toEqual({ crawlStatus: "CRAWLING" });
    expect(freeSlots()).toBe(2);
  });

  it("neither crawls nor writes when the signal is already aborted at entry", async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await run(ctx({ signal: controller.signal }));
    expect(result.output).toEqual({ skipped: true, reason: "deadline_aborted" });
    expect(mocks.leadUpdate).not.toHaveBeenCalled();
    expect(mocks.crawlWebsiteDeep).not.toHaveBeenCalled();
    expect(mocks.crawlWebsite).not.toHaveBeenCalled();
    expect(freeSlots()).toBe(2);
  });

  it("writes nothing when the deadline fires during website verification of a lead without a website", async () => {
    mocks.truthLayerOn.mockReturnValue(true);
    const controller = new AbortController();
    mocks.multiVerifyWebsite.mockImplementation(async () => {
      controller.abort();
      return { status: "confirmed_absent", sources: [] };
    });
    const result = await run(ctx({ signal: controller.signal }, { websiteUrl: null }));
    expect(mocks.multiVerifyWebsite).toHaveBeenCalledTimes(1);
    expect(result.output).toEqual({ skipped: true, reason: "deadline_aborted" });
    expect(mocks.leadUpdate).not.toHaveBeenCalled();
    expect(mocks.leadUpdateMany).not.toHaveBeenCalled();
  });

  it("does not start website verification when the signal is already aborted at entry", async () => {
    mocks.truthLayerOn.mockReturnValue(true);
    const controller = new AbortController();
    controller.abort();
    const result = await run(ctx({ signal: controller.signal }, { websiteUrl: null }));
    expect(result.output).toEqual({ skipped: true, reason: "deadline_aborted" });
    expect(mocks.multiVerifyWebsite).not.toHaveBeenCalled();
    expect(mocks.leadUpdate).not.toHaveBeenCalled();
    expect(mocks.leadUpdateMany).not.toHaveBeenCalled();
  });

  it("still verifies and writes the verdict and NO_WEBSITE when nothing aborted", async () => {
    mocks.truthLayerOn.mockReturnValue(true);
    mocks.multiVerifyWebsite.mockResolvedValue({ status: "confirmed_absent", sources: [] });
    const result = await run(ctx({ signal: new AbortController().signal }, { websiteUrl: null }));
    expect(result.output).toMatchObject({ skipped: true, reason: "no_website" });
    expect(mocks.leadUpdateMany).toHaveBeenCalledWith({
      where: { id: "lead_1", workspaceId: "ws_1" },
      data: { websiteVerificationStatus: "confirmed_absent" },
    });
    expect(mocks.leadUpdate).toHaveBeenCalledWith({ where: { id: "lead_1" }, data: { crawlStatus: "NO_WEBSITE" } });
  });

  it("keeps the audit when storing the capture fails", async () => {
    mocks.saveSiteCapture.mockRejectedValue(new Error("db down"));
    const result = await run(ctx());
    expect(mocks.auditUpsert).toHaveBeenCalledTimes(1);
    expect(result.output).toMatchObject({ reachable: true });
    expect(mocks.warn).toHaveBeenCalledWith("agent_workers.website_auditor.capture_save_failed", expect.any(Object));
  });
});
