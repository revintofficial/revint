/**
 * Unit tests for REVIEW_ANALYST worker.
 *
 * Covers:
 *   - Happy path: analyzeReviewsWithGemini returns an analysis;
 *     prisma.reviewAnalysis.upsert is called with the expected shape
 *     (including weaknessKpis / strengthKpis in {label, percent, examples}
 *     shape as declared in ReviewAnalysisOutput).
 *   - Empty reviews: worker short-circuits with skipped=true and
 *     marks reviewAnalysisStatus=NO_REVIEWS without calling Gemini.
 *   - Gemini throws: worker flips reviewAnalysisStatus=FAILED and
 *     re-throws.
 *
 * Divergences from spec:
 *   - The output shape uses `weaknessKpis`/`strengthKpis` from
 *     ReviewAnalysisOutput, each element `{label, percent, examples}` -
 *     NOT `kpiBar` / `topComplaints` as the spec implied. Tests assert
 *     the real shape.
 *   - The worker calls `prisma.lead.findUniqueOrThrow` with the
 *     googleReviews relation eagerly included; it does NOT call
 *     `prisma.googleReview.findMany`. We mock findUniqueOrThrow.
 *   - The worker delegates the Gemini call to analyzeReviewsWithGemini
 *     (@/lib/gemini), so we mock that helper instead of the raw Gemini
 *     SDK.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentWorkerContext } from "@/lib/agent-workers/types";

const { analyzeReviewsWithGeminiMock } = vi.hoisted(() => ({
  analyzeReviewsWithGeminiMock: vi.fn(),
}));

vi.mock("@/lib/gemini", () => ({
  analyzeReviewsWithGemini: analyzeReviewsWithGeminiMock,
}));

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    lead: {
      update: vi.fn().mockResolvedValue({}),
      findUniqueOrThrow: vi.fn(),
    },
    reviewAnalysis: {
      upsert: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { run } from "@/lib/agent-workers/review-analyst";

function makeReview(overrides: Record<string, unknown> = {}) {
  return {
    id: `r_${Math.random().toString(36).slice(2, 8)}`,
    leadId: "lead_1",
    authorName: "Alice",
    rating: 5,
    text: "Great service!",
    relativeTime: "2 weeks ago",
    publishTime: new Date("2025-01-01"),
    createdAt: new Date(),
    ...overrides,
  };
}

function makeLeadRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "lead_1",
    workspaceId: "ws_1",
    businessName: "Acme HVAC",
    formattedAddress: "1 Main St, Brooklyn, NY",
    borough: "Brooklyn",
    phone: null,
    websiteUrl: null,
    hasWebsite: false,
    googleMapsUri: null,
    rating: 4.3,
    reviewCount: 40,
    businessStatus: "OPERATIONAL",
    primaryType: "hvac_contractor",
    sourceQuery: null,
    sourceLat: null,
    sourceLng: null,
    placeId: "p1",
    crawlStatus: "PENDING",
    analyzeStatus: "PENDING",
    reviewAnalysisStatus: "PENDING",
    createdAt: new Date(),
    updatedAt: new Date(),
    workspace: { offerName: "Local SEO", valueProposition: "Be found" },
    googleReviews: [
      makeReview({ rating: 2, text: "Slow response", authorName: "Bob" }),
      makeReview({ rating: 5, text: "Amazing!", authorName: "Alice" }),
    ],
    ...overrides,
  };
}

function makeCtx(overrides: Partial<AgentWorkerContext> = {}): AgentWorkerContext {
  return {
    runId: "run_1",
    workspaceId: "ws_1",
    workspacePlan: "PRO",
    leadId: "lead_1",
    userId: "user_1",
    lead: { id: "lead_1" } as never,
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
    },
    memory: [],
    plannerSessionId: null,
    emit: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  analyzeReviewsWithGeminiMock.mockReset();
  prismaMock.lead.update.mockReset().mockResolvedValue({});
  prismaMock.lead.findUniqueOrThrow.mockReset();
  prismaMock.reviewAnalysis.upsert.mockReset().mockResolvedValue({});
});

describe("REVIEW_ANALYST - happy path", () => {
  it("returns analysis output and upserts ReviewAnalysis with the right shape", async () => {
    prismaMock.lead.findUniqueOrThrow.mockResolvedValue(makeLeadRow());
    analyzeReviewsWithGeminiMock.mockResolvedValue({
      reviewsAnalyzedCount: 2,
      weaknessKpis: [
        { label: "slow_response", percent: 30, examples: ["Slow response"] },
      ],
      strengthKpis: [
        { label: "friendly_staff", percent: 60, examples: ["Amazing!"] },
      ],
      sentimentBreakdown: { positive: 60, neutral: 20, negative: 20 },
      painPhrases: ["slow response times"],
      strengthPhrases: ["friendly techs"],
      switchSignals: [{ from: "Competitor", to: "Acme", reason: "price" }],
      leadScore: 72,
      summary: "Mixed but improving",
    });

    const result = await run(makeCtx());

    expect(analyzeReviewsWithGeminiMock).toHaveBeenCalledTimes(1);
    expect(prismaMock.reviewAnalysis.upsert).toHaveBeenCalledTimes(1);

    const upsertArgs = prismaMock.reviewAnalysis.upsert.mock.calls[0][0];
    expect(upsertArgs.where).toEqual({ leadId: "lead_1" });
    expect(upsertArgs.create.reviewsAnalyzedCount).toBe(2);
    expect(upsertArgs.create.leadScore).toBe(72);
    expect(upsertArgs.create.summary).toBe("Mixed but improving");
    expect(Array.isArray(upsertArgs.create.weaknessKpis)).toBe(true);
    expect(upsertArgs.create.weaknessKpis[0]).toEqual({
      label: "slow_response",
      percent: 30,
      examples: ["Slow response"],
    });

    const out = result.output as {
      leadScore: number;
      painPhrases: string[];
      strengthPhrases: string[];
      summary: string;
      reviewsAnalyzedCount: number;
    };
    expect(out.leadScore).toBe(72);
    expect(out.painPhrases).toEqual(["slow response times"]);
    expect(out.strengthPhrases).toEqual(["friendly techs"]);
    expect(out.reviewsAnalyzedCount).toBe(2);
  });

  it("transitions reviewAnalysisStatus ANALYZING -> ANALYZED on success", async () => {
    prismaMock.lead.findUniqueOrThrow.mockResolvedValue(makeLeadRow());
    analyzeReviewsWithGeminiMock.mockResolvedValue({
      reviewsAnalyzedCount: 2,
      weaknessKpis: [],
      strengthKpis: [],
      sentimentBreakdown: { positive: 50, neutral: 30, negative: 20 },
      painPhrases: [],
      strengthPhrases: [],
      switchSignals: [],
      leadScore: 50,
      summary: "",
    });

    await run(makeCtx());
    const statuses = prismaMock.lead.update.mock.calls.map(
      (c) => (c[0] as { data: { reviewAnalysisStatus: string } }).data.reviewAnalysisStatus,
    );
    expect(statuses).toEqual(["ANALYZING", "ANALYZED"]);
  });

  it("verifies weaknessKpis shape (label, percent, examples) persists exactly", async () => {
    prismaMock.lead.findUniqueOrThrow.mockResolvedValue(makeLeadRow());
    const weakness = [
      { label: "wait_times", percent: 40, examples: ["took 3 hours"] },
      { label: "pricing", percent: 25, examples: ["too expensive"] },
    ];
    analyzeReviewsWithGeminiMock.mockResolvedValue({
      reviewsAnalyzedCount: 2,
      weaknessKpis: weakness,
      strengthKpis: [],
      sentimentBreakdown: { positive: 50, neutral: 30, negative: 20 },
      painPhrases: [],
      strengthPhrases: [],
      switchSignals: [],
      leadScore: 40,
      summary: "",
    });

    await run(makeCtx());

    const upsertArgs = prismaMock.reviewAnalysis.upsert.mock.calls[0][0];
    expect(upsertArgs.create.weaknessKpis).toEqual(weakness);
    for (const kpi of upsertArgs.create.weaknessKpis) {
      expect(kpi).toHaveProperty("label");
      expect(kpi).toHaveProperty("percent");
      expect(kpi).toHaveProperty("examples");
      expect(typeof kpi.label).toBe("string");
      expect(typeof kpi.percent).toBe("number");
      expect(Array.isArray(kpi.examples)).toBe(true);
    }
  });
});

describe("REVIEW_ANALYST - skip branches", () => {
  it("empty googleReviews: skips, marks NO_REVIEWS, does not call Gemini", async () => {
    prismaMock.lead.findUniqueOrThrow.mockResolvedValue(
      makeLeadRow({ googleReviews: [] }),
    );

    const result = await run(makeCtx());

    expect(analyzeReviewsWithGeminiMock).not.toHaveBeenCalled();
    expect(prismaMock.reviewAnalysis.upsert).not.toHaveBeenCalled();

    const statuses = prismaMock.lead.update.mock.calls.map(
      (c) => (c[0] as { data: { reviewAnalysisStatus: string } }).data.reviewAnalysisStatus,
    );
    expect(statuses).toEqual(["ANALYZING", "NO_REVIEWS"]);

    const out = result.output as { skipped: boolean; reason: string };
    expect(out.skipped).toBe(true);
    expect(out.reason).toMatch(/no_reviews/i);
  });

  it("throws 'requires a lead context' when ctx.lead is null", async () => {
    await expect(run(makeCtx({ lead: null }))).rejects.toThrow(/requires a lead/);
  });
});

describe("REVIEW_ANALYST - failure path", () => {
  it("re-throws Gemini errors and flips reviewAnalysisStatus to FAILED", async () => {
    prismaMock.lead.findUniqueOrThrow.mockResolvedValue(makeLeadRow());
    analyzeReviewsWithGeminiMock.mockRejectedValue(new Error("gemini 500"));

    await expect(run(makeCtx())).rejects.toThrow(/gemini 500/);

    const statuses = prismaMock.lead.update.mock.calls.map(
      (c) => (c[0] as { data: { reviewAnalysisStatus: string } }).data.reviewAnalysisStatus,
    );
    expect(statuses).toEqual(["ANALYZING", "FAILED"]);
    expect(prismaMock.reviewAnalysis.upsert).not.toHaveBeenCalled();
  });
});
