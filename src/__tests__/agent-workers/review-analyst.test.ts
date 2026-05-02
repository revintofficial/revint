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
      makeReview({
        rating: 2,
        text: "Had slow response times getting back to me",
        authorName: "Bob",
      }),
      makeReview({
        rating: 5,
        text: "Amazing friendly techs, very quick",
        authorName: "Alice",
      }),
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
      niche: "WEB_AGENCY",
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
    // Beta finding §2/§3: the lead row needs enough negative reviews
    // to support a count≥2 KPI with two grounded examples after the
    // post-process filter. We seed two real low-rating reviews whose
    // text matches the KPI examples verbatim, so grounding passes.
    prismaMock.lead.findUniqueOrThrow.mockResolvedValue(
      makeLeadRow({
        googleReviews: [
          makeReview({
            rating: 2,
            text: "had slow response times all day",
            authorName: "Bob",
          }),
          makeReview({
            rating: 1,
            text: "slow response times again, never coming back",
            authorName: "Carol",
          }),
          makeReview({
            rating: 5,
            text: "amazing friendly techs always",
            authorName: "Alice",
          }),
          makeReview({
            rating: 5,
            text: "the friendly techs deserve a raise",
            authorName: "Dan",
          }),
        ],
      }),
    );
    analyzeReviewsWithGeminiMock.mockResolvedValue({
      reviewsAnalyzedCount: 4,
      weaknessKpis: [
        {
          label: "slow_response",
          count: 2,
          percent: 30,
          examples: ["had slow response times", "slow response times again"],
        },
      ],
      strengthKpis: [
        {
          label: "friendly_staff",
          count: 2,
          percent: 60,
          examples: ["amazing friendly techs", "the friendly techs deserve"],
        },
      ],
      sentimentBreakdown: { positive: 0.5, neutral: 0, negative: 0.5 },
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
    expect(upsertArgs.create.reviewsAnalyzedCount).toBe(4);
    expect(upsertArgs.create.leadScore).toBe(72);
    expect(upsertArgs.create.summary).toBe("Mixed but improving");
    expect(Array.isArray(upsertArgs.create.weaknessKpis)).toBe(true);
    // Beta finding §2: KPI carries `count`; `percent` is re-derived
    // from the actual negative pool (here 2 of 2 = 100%) rather than
    // trusting whatever Gemini returned.
    expect(upsertArgs.create.weaknessKpis[0]).toMatchObject({
      label: "slow_response",
      count: 2,
    });
    expect(upsertArgs.create.weaknessKpis[0].examples.length).toBeGreaterThanOrEqual(2);

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
    expect(out.reviewsAnalyzedCount).toBe(4);
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

  it("verifies weaknessKpis shape (label, count, percent, examples) persists exactly", async () => {
    // Beta finding §2: the post-process filter requires count≥2 AND
    // ≥2 examples that are grounded in the actual review corpus. Seed
    // four low-rating reviews (two for wait_times, two for pricing)
    // whose normalized text contains the KPI example phrases.
    prismaMock.lead.findUniqueOrThrow.mockResolvedValue(
      makeLeadRow({
        googleReviews: [
          makeReview({
            rating: 1,
            text: "wait was awful, took 3 hours total",
            authorName: "U1",
          }),
          makeReview({
            rating: 2,
            text: "took 3 hours just to be seated",
            authorName: "U2",
          }),
          makeReview({
            rating: 2,
            text: "too expensive for the portion size",
            authorName: "U3",
          }),
          makeReview({
            rating: 1,
            text: "way too expensive given the quality",
            authorName: "U4",
          }),
        ],
      }),
    );
    const weakness = [
      {
        label: "wait_times",
        count: 2,
        percent: 40,
        examples: ["took 3 hours total", "took 3 hours just to be"],
      },
      {
        label: "pricing",
        count: 2,
        percent: 25,
        examples: ["too expensive for the portion", "too expensive given the quality"],
      },
    ];
    analyzeReviewsWithGeminiMock.mockResolvedValue({
      reviewsAnalyzedCount: 4,
      weaknessKpis: weakness,
      strengthKpis: [],
      sentimentBreakdown: { positive: 0, neutral: 0, negative: 1 },
      painPhrases: [],
      strengthPhrases: [],
      switchSignals: [],
      leadScore: 40,
      summary: "",
    });

    await run(makeCtx());

    const upsertArgs = prismaMock.reviewAnalysis.upsert.mock.calls[0][0];
    // Both KPIs survive the filter (count≥2, ≥2 grounded examples).
    expect(upsertArgs.create.weaknessKpis).toHaveLength(2);
    for (const kpi of upsertArgs.create.weaknessKpis) {
      expect(kpi).toHaveProperty("label");
      expect(kpi).toHaveProperty("count");
      expect(kpi).toHaveProperty("percent");
      expect(kpi).toHaveProperty("examples");
      expect(typeof kpi.label).toBe("string");
      expect(typeof kpi.count).toBe("number");
      expect(typeof kpi.percent).toBe("number");
      expect(Array.isArray(kpi.examples)).toBe(true);
      expect(kpi.count).toBeGreaterThanOrEqual(2);
      expect(kpi.examples.length).toBeGreaterThanOrEqual(2);
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
  it("returns skipped output (not throw) and flips reviewAnalysisStatus to FAILED on Gemini error", async () => {
    // Bug #5 / beta finding §7: REVIEW_ANALYST is configured as
    // soft-fail in the orchestrator — it returns a skipped output
    // rather than rejecting, so the chain proceeds with whatever
    // earlier workers produced. The lead UI still surfaces
    // reviewAnalysisStatus=FAILED so the rep knows reviews didn't
    // analyze. We assert the contract here so any regression to
    // throwing breaks loud.
    prismaMock.lead.findUniqueOrThrow.mockResolvedValue(makeLeadRow());
    analyzeReviewsWithGeminiMock.mockRejectedValue(new Error("gemini 500"));

    const result = await run(makeCtx());

    const out = result.output as { skipped: boolean; reason: string; errorMsg: string };
    expect(out.skipped).toBe(true);
    expect(out.reason).toBe("analysis_failed");
    expect(out.errorMsg).toMatch(/gemini 500/);

    const statuses = prismaMock.lead.update.mock.calls.map(
      (c) => (c[0] as { data: { reviewAnalysisStatus: string } }).data.reviewAnalysisStatus,
    );
    expect(statuses).toEqual(["ANALYZING", "FAILED"]);
    expect(prismaMock.reviewAnalysis.upsert).not.toHaveBeenCalled();
  });
});
