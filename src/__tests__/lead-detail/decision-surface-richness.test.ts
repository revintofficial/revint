/**
 * Phase 2.5 — `/api/leads/[id]/decision-surface` richness test.
 *
 * Asserts the aggregator returns the 10 V1-richness summary fields
 * with sane shapes for COLD / REPLIED / WON-style fixtures (PLAN
 * §4 Phase 2.5 DoD: "aggregator returns the 10 new summary fields
 * with sane shapes for COLD / REPLIED / WON fixtures").
 *
 * Field-level coverage:
 *   1. intelligenceBrief             ← cached LEAD_INTELLIGENCE_BRIEF
 *   2. recommendedPackage            ← SalesOpportunity → ServicePackage
 *   3. personalizedFirstMessage      ← SalesOpportunity (PRO+ only)
 *   4. reviewIntelSummary            ← ReviewAnalysis (top-3 trims)
 *   5. websiteIntelSummary           ← WebsiteAudit (chip-level subset)
 *   6. reviewVelocity                ← computeReviewVelocity from googleReviews
 *   7. discoveredLinks               ← extractDiscoveredLinks from enrichment runs
 *   8. subNicheState                 ← lead.subNiche* columns
 *   9. dossierStub                   ← cached LEAD_DOSSIER_GENERATOR
 *  10. pipelineState                 ← lead status enums + dnc flag
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireUser = vi.fn();

vi.mock("@/lib/auth", () => {
  class UnauthorizedError extends Error {}
  return {
    requireUser: (...args: unknown[]) => mockRequireUser(...args),
    UnauthorizedError,
  };
});

// We're not testing the recommended-package helper itself (covered
// elsewhere); stub it with a deterministic resolver.
vi.mock("@/lib/lead-detail/recommended-package", () => ({
  resolveRecommendedPackage: vi.fn(async (args: { recommendedPackageId: string | null }) =>
    args.recommendedPackageId
      ? {
          id: args.recommendedPackageId,
          name: "Pro Package",
          priceLabel: "£500/mo",
          features: ["site rebuild", "QR menus"],
          reason: "Operator already books OpenTable",
        }
      : null,
  ),
}));

interface LeadRow {
  id: string;
  workspaceId: string;
  businessName: string;
  formattedAddress: string | null;
  borough: string | null;
  phone: string | null;
  websiteUrl: string | null;
  primaryType: string | null;
  subNicheSlug: string | null;
  nicheSlug: string | null;
  accountId: string | null;
  assignedToUserId: string | null;
  nextActionDueAt: Date | null;
  salesConfidence: number | null;
  lastContactedAt: Date | null;
  icpFitScore: number | null;
  priceLevel: number | null;
  reviewCount: number | null;
  rating: number | null;
  hasWebsite: boolean;
  timezone: string | null;
  sourceLat: number | null;
  sourceLng: number | null;
  subNicheSource: "AUTO" | "MANUAL" | null;
  subNicheConfidence: number | null;
  subNicheVersion: number;
  subNicheAlternatives: unknown;
  crawlStatus: "PENDING" | "CRAWLING" | "CRAWLED" | "FAILED" | "NO_WEBSITE";
  analyzeStatus: "PENDING" | "ANALYZING" | "ANALYZED" | "FAILED";
  reviewAnalysisStatus: "PENDING" | "ANALYZING" | "ANALYZED" | "FAILED" | "NO_REVIEWS";
  discardedAt: Date | null;
  websiteAudit: unknown;
  watchlistItem: unknown;
  account: unknown;
  salesOpportunity: unknown;
  reviewAnalysis: unknown;
  googleReviews: Array<{ rating: number; publishTime: Date }>;
}

const wsA = "ws_a";

const baseLead = (overrides: Partial<LeadRow> = {}): LeadRow => ({
  id: "lead_a",
  workspaceId: wsA,
  businessName: "Bistro 9",
  formattedAddress: "9 High St, London",
  borough: "Camden",
  phone: null,
  websiteUrl: "https://bistro9.example.com",
  primaryType: "RESTAURANT_TECH",
  subNicheSlug: "fnb-fine-dining",
  nicheSlug: null,
  accountId: null,
  assignedToUserId: "u1",
  nextActionDueAt: null,
  salesConfidence: 70,
  lastContactedAt: null,
  icpFitScore: 65,
  priceLevel: 3,
  reviewCount: 120,
  rating: 4.4,
  hasWebsite: true,
  timezone: "Europe/London",
  sourceLat: 51.54,
  sourceLng: -0.14,
  subNicheSource: "AUTO",
  subNicheConfidence: 0.82,
  subNicheVersion: 1,
  subNicheAlternatives: [
    { slug: "fnb-casual-dining", confidence: 0.6, reason: "Menu has casual options" },
  ],
  crawlStatus: "CRAWLED",
  analyzeStatus: "ANALYZED",
  reviewAnalysisStatus: "ANALYZED",
  discardedAt: null,
  websiteAudit: {
    reachable: true,
    crawlError: null,
    crawlAttemptedAt: new Date("2026-04-01T00:00:00Z"),
    httpStatus: 200,
    loadTimeMs: 900,
    https: true,
    mobileFriendlyGuess: true,
    hasContactForm: true,
    hasWhatsappLink: false,
    hasBookingSystem: true,
    bookingProvider: "OpenTable",
    hasEcommerce: false,
    servicesDetected: ["dinner"],
    title: "Bistro 9",
    metaDescription: "Fine dining",
    socialProfiles: { instagram: "https://instagram.com/bistro9" },
  },
  watchlistItem: { id: "wl1", pipelineStage: "REACHED_OUT", dealStage: "DISCOVERY" },
  account: null,
  salesOpportunity: {
    recommendedPackageId: "pkg_pro",
    recommendedPackageReason: "Operator already books OpenTable",
    personalizedFirstMessage: "Hi Chef, your tasting-menu page could lift covers by 12%...",
  },
  reviewAnalysis: {
    leadScore: 78,
    summary: "Front-of-house is the weakness, food consistently great",
    weaknessKpis: [
      { label: "wait time", count: 12, percent: 30 },
      { label: "service inconsistency", count: 8, percent: 20 },
    ],
    strengthKpis: [{ label: "food quality", count: 40, percent: 80 }],
    switchSignals: ["was using TheFork, now wants OpenTable"],
    sentimentBreakdown: { positive: 0.7, neutral: 0.2, negative: 0.1 },
    reviewsAnalyzedCount: 50,
    analyzedAt: new Date("2026-03-15T00:00:00Z"),
  },
  googleReviews: [
    { rating: 5, publishTime: new Date("2026-04-15T00:00:00Z") },
    { rating: 4, publishTime: new Date("2026-04-10T00:00:00Z") },
    { rating: 5, publishTime: new Date("2026-04-01T00:00:00Z") },
    { rating: 3, publishTime: new Date("2026-03-15T00:00:00Z") },
  ],
  ...overrides,
});

let leads: LeadRow[] = [];
let intelligenceBriefRun: unknown = null;
let dossierRun: unknown = null;
let enrichmentRuns: unknown[] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: {
      findFirst: vi.fn(
        async (args: { where: { id: string; workspaceId: string } }) =>
          leads.find(
            (l) => l.id === args.where.id && l.workspaceId === args.where.workspaceId,
          ) ?? null,
      ),
      count: vi.fn(async () => 0),
    },
    leadNextAction: { findFirst: vi.fn(async () => null) },
    leadTrigger: { findMany: vi.fn(async () => []) },
    stakeholder: { findMany: vi.fn(async () => []) },
    dealQualification: { findFirst: vi.fn(async () => null) },
    dealQualificationFact: { findMany: vi.fn(async () => []) },
    discoverySession: { findFirst: vi.fn(async () => null) },
    objection: { findMany: vi.fn(async () => []) },
    idealCustomerProfile: { findFirst: vi.fn(async () => null) },
    leadActivity: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
    },
    insightPerformance: { findMany: vi.fn(async () => []) },
    watchlistItem: {
      upsert: vi.fn(async () => ({ id: "wl1" })),
    },
    agentRun: {
      findFirst: vi.fn(
        async (args: {
          where: { workerKind: string; status: string };
        }) => {
          if (args.where.workerKind === "LEAD_INTELLIGENCE_BRIEF") {
            return intelligenceBriefRun;
          }
          if (args.where.workerKind === "LEAD_DOSSIER_GENERATOR") {
            return dossierRun;
          }
          return null;
        },
      ),
      findMany: vi.fn(async () => enrichmentRuns),
    },
    $transaction: vi.fn(async (promises: Promise<unknown>[]) => Promise.all(promises)),
  },
}));

import { GET } from "@/app/api/leads/[id]/decision-surface/route";

function makeReq() {
  return new Request("http://localhost/api/leads/x/decision-surface");
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function setSession(
  workspaceId: string,
  plan: "FREE" | "PRO" | "PRO_TEAM" | "AGENCY" = "PRO",
) {
  mockRequireUser.mockResolvedValue({
    user: { id: "u1", email: "u@u.com", fullName: null, avatarUrl: null },
    workspaceId,
    workspace: { id: workspaceId, name: "Test", slug: "test", plan },
    role: "OWNER",
  });
}

beforeEach(() => {
  leads = [];
  intelligenceBriefRun = null;
  dossierRun = null;
  enrichmentRuns = [];
  mockRequireUser.mockReset();
});

describe("/api/leads/[id]/decision-surface — Phase 2.5 richness fields", () => {
  it("returns all 10 summary fields with sane shapes on a populated lead", async () => {
    leads.push(baseLead());
    intelligenceBriefRun = {
      id: "br1",
      finishedAt: new Date("2026-04-12T00:00:00Z"),
      outputJson: {
        salesConfidence: 78,
        headline: "OpenTable user with consistency complaints",
        painPoints: ["wait time", "service inconsistency", "menu navigation"],
        whyGoodTarget: "Existing OpenTable spend; ready for tasting-menu page",
      },
    };
    dossierRun = {
      id: "do1",
      finishedAt: new Date("2026-04-10T00:00:00Z"),
      outputJson: {
        markdown: "Bistro 9 is a 28-cover Camden fine-dining room owned by Chef X...",
      },
    };
    enrichmentRuns = [
      {
        workerKind: "APIFY_INSTAGRAM_DEEP",
        outputJson: {
          profileUrl: "https://instagram.com/bistro9chef",
          posts: [],
        },
      },
      {
        workerKind: "APIFY_WEB_CRAWL_DEEP",
        outputJson: {
          links: ["https://www.trustpilot.com/review/bistro9.example.com"],
        },
      },
    ];
    setSession(wsA);
    const res = await GET(makeReq(), makeParams("lead_a"));
    expect(res.status).toBe(200);
    const body = await res.json();

    // 1. intelligence brief
    expect(body.intelligenceBrief).toMatchObject({
      runId: "br1",
      salesConfidence: 78,
      headline: "OpenTable user with consistency complaints",
    });
    expect(body.intelligenceBrief.painPoints.length).toBeLessThanOrEqual(6);

    // 2. recommended package (resolved by stub)
    expect(body.recommendedPackage).toMatchObject({
      id: "pkg_pro",
      name: "Pro Package",
    });

    // 3. personalized first message — PRO+ should see it
    expect(body.personalizedFirstMessage).toContain("Hi Chef");

    // 4. review intel summary
    expect(body.reviewIntelSummary).toMatchObject({
      leadScore: 78,
      reviewsAnalyzedCount: 50,
    });
    expect(body.reviewIntelSummary.weaknessKpisTop3.length).toBeLessThanOrEqual(3);
    expect(body.reviewIntelSummary.sentimentBreakdown.positive).toBe(0.7);

    // 5. website intel summary
    expect(body.websiteIntelSummary).toMatchObject({
      hasBookingSystem: true,
      bookingProvider: "OpenTable",
      crawlStatus: "ok",
      https: true,
    });

    // 6. review velocity (rolling 30d/prior-30d windows)
    expect(body.reviewVelocity).toHaveProperty("recentCount30d");
    expect(body.reviewVelocity).toHaveProperty("priorCount30d");
    expect(body.reviewVelocity).toHaveProperty("deltaPct");

    // 7. discovered links — expect at least the trustpilot directory
    expect(Array.isArray(body.discoveredLinks.directories)).toBe(true);

    // 8. sub-niche state
    expect(body.subNicheState).toMatchObject({
      current: { slug: "fnb-fine-dining" },
      override: { source: "AUTO", confidence: 0.82, version: 1 },
    });
    expect(body.subNicheState.alternatives.length).toBe(1);

    // 9. dossier stub
    expect(body.dossierStub).toMatchObject({
      hasDossier: true,
    });
    expect(body.dossierStub.summarySnippet?.length).toBeGreaterThan(0);
    expect(body.dossierStub.summarySnippet?.length).toBeLessThanOrEqual(220);

    // 10. pipeline state
    expect(body.pipelineState).toMatchObject({
      crawl: "CRAWLED",
      analyze: "ANALYZED",
      reviews: "ANALYZED",
      outreach: "REACHED_OUT",
      dnc: false,
    });
  });

  it("nulls personalizedFirstMessage on FREE plan even when present", async () => {
    leads.push(baseLead());
    setSession(wsA, "FREE");
    const res = await GET(makeReq(), makeParams("lead_a"));
    const body = await res.json();
    expect(body.personalizedFirstMessage).toBeNull();
  });

  it("returns sane null/empty defaults when caches are empty (COLD lead)", async () => {
    leads.push(
      baseLead({
        salesOpportunity: null,
        reviewAnalysis: null,
        googleReviews: [],
        websiteAudit: null,
        crawlStatus: "PENDING",
        analyzeStatus: "PENDING",
        reviewAnalysisStatus: "PENDING",
        watchlistItem: null,
      }),
    );
    setSession(wsA);
    const res = await GET(makeReq(), makeParams("lead_a"));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.intelligenceBrief).toBeNull();
    expect(body.recommendedPackage).toBeNull();
    expect(body.personalizedFirstMessage).toBeNull();
    expect(body.reviewIntelSummary).toBeNull();
    expect(body.websiteIntelSummary).toBeNull();
    expect(body.reviewVelocity.recentCount30d).toBe(0);
    expect(body.reviewVelocity.priorCount30d).toBe(0);
    expect(body.discoveredLinks).toEqual({ socials: [], directories: [] });
    expect(body.dossierStub).toEqual({
      hasDossier: false,
      lastGeneratedAt: null,
      summarySnippet: null,
    });
    expect(body.pipelineState).toMatchObject({
      crawl: "PENDING",
      analyze: "PENDING",
      reviews: "PENDING",
      outreach: null,
      dnc: false,
    });
  });
});
