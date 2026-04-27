/**
 * Unit tests for WEBSITE_AUDITOR worker.
 *
 * Covers:
 *   - Happy path: crawler returns features, worker upserts WebsiteAudit
 *     and flips the lead's crawlStatus to CRAWLED.
 *   - lead.websiteUrl === null: worker short-circuits with skipped=true
 *     and marks crawlStatus=NO_WEBSITE without invoking the crawler.
 *   - Crawler throws: worker flips crawlStatus to FAILED and re-throws.
 *   - Unreachable result (reachable=false) is returned but still goes
 *     through upsert (code path in crawler treats it as a normal audit).
 *
 * Divergences from spec:
 *   - This worker does NOT call Gemini. It uses `crawlWebsite` from
 *     `@/lib/crawler` for DOM feature extraction. The spec's "Gemini
 *     returns malformed JSON" and "Gemini returns structured JSON"
 *     scenarios do not map to this worker's code path; we instead
 *     assert what happens when `crawlWebsite` throws or returns an
 *     unreachable shape.
 *   - The worker's skip branch is gated only on `lead.websiteUrl`;
 *     `lead.hasWebsite` is not consulted directly. A lead with
 *     hasWebsite=false and a websiteUrl would still be crawled (odd
 *     but that's the code). We only test the websiteUrl branch.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentWorkerContext } from "@/lib/agent-workers/types";
import type { WebsiteFeatures } from "@/types";

const { crawlWebsiteMock } = vi.hoisted(() => ({
  crawlWebsiteMock: vi.fn(),
}));

vi.mock("@/lib/crawler", () => ({
  crawlWebsite: crawlWebsiteMock,
}));

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    lead: {
      update: vi.fn().mockResolvedValue({}),
    },
    websiteAudit: {
      upsert: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { run } from "@/lib/agent-workers/website-auditor";

function makeFeatures(overrides: Partial<WebsiteFeatures> = {}): WebsiteFeatures {
  const base = {
    url: "https://acme.example",
    reachable: true,
    loadTimeMs: 1200,
    https: true,
    mobileFriendlyGuess: true,
    title: "Acme HVAC",
    metaDescription: "Brooklyn HVAC",
    h1: "Acme HVAC",
    hasContactForm: true,
    hasWhatsappLink: false,
    hasBookingSystem: false,
    hasEcommerce: false,
    servicesDetected: ["repair", "installation"],
    navItems: [{ text: "Services", href: "/services" }],
    ctaLinks: [],
    brokenLinksCount: 0,
    structuredDataPresent: true,
    hasOpenGraph: true,
    hasTwitterCards: false,
    hasFavicon: true,
    hasManifest: false,
    hasServiceWorker: false,
    hasGoogleAnalytics: true,
    hasCookieConsent: false,
    hasResponsiveImages: true,
    hasFontDisplay: false,
    securityHeaders: {
      contentSecurityPolicy: false,
      strictTransportSecurity: true,
      xFrameOptions: true,
      xContentTypeOptions: true,
      referrerPolicy: false,
      permissionsPolicy: false,
    },
    schemaTypes: ["LocalBusiness"],
    ...overrides,
  };
  return base as unknown as WebsiteFeatures;
}

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
      businessName: "Acme HVAC",
      formattedAddress: "1 Main St",
      googleMapsUri: null,
      primaryType: null,
      websiteUrl: "https://acme.example",
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
      crawlStatus: "PENDING",
      analyzeStatus: "PENDING",
      reviewAnalysisStatus: "PENDING",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never,
    workspace: {
      id: "ws_1",
      name: "Test",
      slug: "test",
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
  crawlWebsiteMock.mockReset();
  prismaMock.lead.update.mockReset().mockResolvedValue({});
  prismaMock.websiteAudit.upsert.mockReset().mockResolvedValue({});
});

describe("WEBSITE_AUDITOR - happy path", () => {
  it("persists the audit via upsert and returns core fields in output", async () => {
    const features = makeFeatures();
    crawlWebsiteMock.mockResolvedValue({
      ...features,
      contactEmails: ["hi@acme.example"],
      socialProfiles: { facebook: "https://fb.com/acme" },
    });

    const result = await run(makeCtx());

    expect(crawlWebsiteMock).toHaveBeenCalledWith("https://acme.example");
    expect(prismaMock.websiteAudit.upsert).toHaveBeenCalledTimes(1);
    const upsertArgs = prismaMock.websiteAudit.upsert.mock.calls[0][0];
    expect(upsertArgs.where).toEqual({ leadId: "lead_1" });
    expect(upsertArgs.create.leadId).toBe("lead_1");
    expect(upsertArgs.create.url).toBe("https://acme.example");
    expect(upsertArgs.create.reachable).toBe(true);
    expect(upsertArgs.create.contactEmails).toEqual(["hi@acme.example"]);
    expect(upsertArgs.update.reachable).toBe(true);

    const out = result.output as {
      reachable: boolean;
      url: string;
      hasContactForm: boolean;
      hasBookingSystem: boolean;
      servicesDetected: string[];
      contactEmails: string[];
      socialProfiles: Record<string, string>;
    };
    expect(out).toMatchObject({
      reachable: true,
      url: "https://acme.example",
      hasContactForm: true,
      hasBookingSystem: false,
      servicesDetected: ["repair", "installation"],
      contactEmails: ["hi@acme.example"],
      socialProfiles: { facebook: "https://fb.com/acme" },
    });
  });

  it("transitions crawlStatus CRAWLING -> CRAWLED across the happy path", async () => {
    crawlWebsiteMock.mockResolvedValue(makeFeatures());
    await run(makeCtx());

    const statuses = prismaMock.lead.update.mock.calls.map(
      (c) => (c[0] as { data: { crawlStatus: string } }).data.crawlStatus,
    );
    expect(statuses).toEqual(["CRAWLING", "CRAWLED"]);
  });

  it("defaults contactEmails and socialProfiles when the crawler omits them", async () => {
    crawlWebsiteMock.mockResolvedValue(makeFeatures());
    const result = await run(makeCtx());
    const out = result.output as { contactEmails: string[]; socialProfiles: Record<string, string> };
    expect(out.contactEmails).toEqual([]);
    expect(out.socialProfiles).toEqual({});
  });
});

describe("WEBSITE_AUDITOR - skip branches", () => {
  it("lead.websiteUrl === null: returns skipped + no crawl + marks crawlStatus=NO_WEBSITE", async () => {
    const ctx = makeCtx({
      lead: { ...makeCtx().lead!, websiteUrl: null } as never,
    });

    const result = await run(ctx);

    expect(crawlWebsiteMock).not.toHaveBeenCalled();
    expect(prismaMock.websiteAudit.upsert).not.toHaveBeenCalled();
    expect(prismaMock.lead.update).toHaveBeenCalledTimes(1);
    const updateArgs = prismaMock.lead.update.mock.calls[0][0];
    expect(updateArgs.data.crawlStatus).toBe("NO_WEBSITE");

    const out = result.output as { skipped: boolean; reason: string };
    expect(out.skipped).toBe(true);
    expect(out.reason).toMatch(/no_website/i);
  });

  it("throws 'requires a lead context' when ctx.lead is null", async () => {
    const ctx = makeCtx({ lead: null });
    await expect(run(ctx)).rejects.toThrow(/requires a lead/);
  });
});

describe("WEBSITE_AUDITOR - failure path", () => {
  it("re-throws crawler errors after flipping crawlStatus to FAILED", async () => {
    crawlWebsiteMock.mockRejectedValue(new Error("dns failure"));

    await expect(run(makeCtx())).rejects.toThrow(/dns failure/);

    const statuses = prismaMock.lead.update.mock.calls.map(
      (c) => (c[0] as { data: { crawlStatus: string } }).data.crawlStatus,
    );
    // CRAWLING -> FAILED; no CRAWLED transition.
    expect(statuses).toEqual(["CRAWLING", "FAILED"]);
    expect(prismaMock.websiteAudit.upsert).not.toHaveBeenCalled();
  });

  it("unreachable crawl result still persists (audit records the failed fetch)", async () => {
    // The crawler's own unreachable shape is still passed through
    // upsert so the UI can surface "site unreachable". There is no
    // malformed-JSON branch in this worker; this is the closest path.
    crawlWebsiteMock.mockResolvedValue(
      makeFeatures({ reachable: false, loadTimeMs: null, title: null, h1: null }),
    );

    const result = await run(makeCtx());

    expect(prismaMock.websiteAudit.upsert).toHaveBeenCalledTimes(1);
    const upsertArgs = prismaMock.websiteAudit.upsert.mock.calls[0][0];
    expect(upsertArgs.create.reachable).toBe(false);
    const out = result.output as { reachable: boolean };
    expect(out.reachable).toBe(false);
  });
});
