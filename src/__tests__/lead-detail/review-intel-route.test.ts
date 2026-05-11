/**
 * Phase 2.5 — `/api/leads/[id]/review-intel` integration test.
 *
 * NON-NEGOTIABLE: workspace A may NOT read workspace B's reviews.
 * The route returns 404 (not 200, not 403) when the caller's
 * workspace does not own the lead.
 *
 * Also covers (PLAN §4 Phase 2.5 DoD):
 *   - query-count budget ≤ 4 (1 pre-check + 1 transaction = 2).
 *   - response shape matches `ReviewIntelResponse`:
 *     `{ status, analysis, reviewsByMonth, recentReviews, totalReviews }`.
 *   - in-process monthly bucketing returns sorted UTC first-of-month
 *     keys with avgRating rounded to 2dp.
 *   - empty review set returns `status: "NO_REVIEWS"` and an empty
 *     `recentReviews` slice (cap = 20).
 *   - non-empty set returns `recentReviews` capped at 20 even when
 *     500 reviews exist.
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

interface LeadRow {
  id: string;
  workspaceId: string;
  reviewAnalysisStatus:
    | "PENDING"
    | "ANALYZING"
    | "ANALYZED"
    | "FAILED"
    | "NO_REVIEWS";
}

interface AnalysisRow {
  id: string;
  leadId: string;
  leadScore: number;
  summary: string | null;
  weaknessKpis: unknown;
  strengthKpis: unknown;
  switchSignals: unknown;
  sentimentBreakdown: unknown;
  painPhrases: unknown;
  strengthPhrases: unknown;
  reviewsAnalyzedCount: number;
  analyzedAt: Date;
}

interface ReviewRow {
  id: string;
  leadId: string;
  authorName: string;
  authorPhoto: string | null;
  rating: number;
  text: string | null;
  relativeTime: string;
  publishTime: Date;
}

const wsA = "ws_a";
const wsB = "ws_b";

let leads: LeadRow[] = [];
let analyses: AnalysisRow[] = [];
let reviews: ReviewRow[] = [];
let txCallCount = 0;
let analysisQueryCount = 0;
let reviewQueryCount = 0;

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: {
      findFirst: vi.fn(
        async (args: { where: { id: string; workspaceId: string } }) =>
          leads.find(
            (l) => l.id === args.where.id && l.workspaceId === args.where.workspaceId,
          ) ?? null,
      ),
    },
    reviewAnalysis: {
      findUnique: vi.fn(async (args: { where: { leadId: string } }) => {
        analysisQueryCount += 1;
        return analyses.find((a) => a.leadId === args.where.leadId) ?? null;
      }),
    },
    googleReview: {
      findMany: vi.fn(async (args: { where: { leadId: string }; take?: number }) => {
        reviewQueryCount += 1;
        return reviews
          .filter((r) => r.leadId === args.where.leadId)
          .sort((a, b) => b.publishTime.getTime() - a.publishTime.getTime())
          .slice(0, args.take ?? Infinity);
      }),
    },
    $transaction: vi.fn(async (promises: Promise<unknown>[]) => {
      txCallCount += 1;
      return Promise.all(promises);
    }),
  },
}));

import { GET } from "@/app/api/leads/[id]/review-intel/route";

function makeReq() {
  return new Request("http://localhost/api/leads/x/review-intel");
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
  analyses = [];
  reviews = [];
  txCallCount = 0;
  analysisQueryCount = 0;
  reviewQueryCount = 0;
  mockRequireUser.mockReset();
});

describe("/api/leads/[id]/review-intel — multi-tenant guard", () => {
  it("returns 404 when workspace A asks for a lead in workspace B", async () => {
    leads.push({ id: "lead_b", workspaceId: wsB, reviewAnalysisStatus: "ANALYZED" });
    setSession(wsA);
    const res = await GET(makeReq(), makeParams("lead_b"));
    expect(res.status).toBe(404);
  });

  it("returns 200 when workspace A reads its own lead", async () => {
    leads.push({ id: "lead_a", workspaceId: wsA, reviewAnalysisStatus: "ANALYZED" });
    setSession(wsA);
    const res = await GET(makeReq(), makeParams("lead_a"));
    expect(res.status).toBe(200);
  });
});

describe("/api/leads/[id]/review-intel — query-count budget", () => {
  it("performs ≤ 4 round-trips (1 pre-check + 1 transaction of 2)", async () => {
    leads.push({ id: "lead_a", workspaceId: wsA, reviewAnalysisStatus: "ANALYZED" });
    setSession(wsA);
    await GET(makeReq(), makeParams("lead_a"));
    // The pre-check is `lead.findFirst` (1 round-trip). The
    // transaction wraps `reviewAnalysis.findUnique` +
    // `googleReview.findMany` so it counts as 1 round-trip.
    // Effective budget: 1 + 1 = 2 round-trips, well under 4.
    expect(txCallCount).toBe(1);
    expect(analysisQueryCount).toBe(1);
    expect(reviewQueryCount).toBe(1);
  });
});

describe("/api/leads/[id]/review-intel — response shape", () => {
  it("returns NO_REVIEWS status when the review set is empty", async () => {
    leads.push({ id: "lead_a", workspaceId: wsA, reviewAnalysisStatus: "ANALYZED" });
    setSession(wsA);
    const res = await GET(makeReq(), makeParams("lead_a"));
    const body = await res.json();
    expect(body.status).toBe("NO_REVIEWS");
    expect(body.totalReviews).toBe(0);
    expect(body.reviewsByMonth).toEqual([]);
    expect(body.recentReviews).toEqual([]);
  });

  it("buckets reviews by UTC first-of-month with avgRating rounded to 2dp", async () => {
    leads.push({ id: "lead_a", workspaceId: wsA, reviewAnalysisStatus: "ANALYZED" });
    reviews.push(
      {
        id: "r1",
        leadId: "lead_a",
        authorName: "Alice",
        authorPhoto: null,
        rating: 5,
        text: "Great",
        relativeTime: "2 weeks ago",
        publishTime: new Date(Date.UTC(2026, 3, 14, 12, 0, 0)), // Apr 2026
      },
      {
        id: "r2",
        leadId: "lead_a",
        authorName: "Bob",
        authorPhoto: null,
        rating: 4,
        text: "Good",
        relativeTime: "3 weeks ago",
        publishTime: new Date(Date.UTC(2026, 3, 7, 8, 0, 0)), // Apr 2026
      },
      {
        id: "r3",
        leadId: "lead_a",
        authorName: "Carol",
        authorPhoto: null,
        rating: 3,
        text: "Meh",
        relativeTime: "2 months ago",
        publishTime: new Date(Date.UTC(2026, 1, 1, 0, 0, 0)), // Feb 2026
      },
    );
    setSession(wsA);
    const res = await GET(makeReq(), makeParams("lead_a"));
    const body = await res.json();
    expect(body.totalReviews).toBe(3);
    expect(body.reviewsByMonth).toEqual([
      { month: "2026-02-01", count: 1, avgRating: 3 },
      { month: "2026-04-01", count: 2, avgRating: 4.5 },
    ]);
  });

  it("caps recentReviews at 20 even when 30 reviews exist", async () => {
    leads.push({ id: "lead_a", workspaceId: wsA, reviewAnalysisStatus: "ANALYZED" });
    for (let i = 0; i < 30; i += 1) {
      reviews.push({
        id: `r${i}`,
        leadId: "lead_a",
        authorName: `Reviewer ${i}`,
        authorPhoto: null,
        rating: ((i % 5) + 1) as number,
        text: null,
        relativeTime: `${i} days ago`,
        publishTime: new Date(Date.UTC(2026, 3, 1) + i * 86400000),
      });
    }
    setSession(wsA);
    const res = await GET(makeReq(), makeParams("lead_a"));
    const body = await res.json();
    expect(body.recentReviews.length).toBe(20);
    expect(body.totalReviews).toBe(30);
  });

  it("returns the analysis row when present", async () => {
    leads.push({ id: "lead_a", workspaceId: wsA, reviewAnalysisStatus: "ANALYZED" });
    analyses.push({
      id: "an1",
      leadId: "lead_a",
      leadScore: 78,
      summary: "Great service",
      weaknessKpis: [{ label: "wait time", percent: 30 }],
      strengthKpis: [{ label: "food quality", percent: 65 }],
      switchSignals: ["was using X, now Y"],
      sentimentBreakdown: { positive: 0.7, neutral: 0.2, negative: 0.1 },
      painPhrases: [],
      strengthPhrases: [],
      reviewsAnalyzedCount: 25,
      analyzedAt: new Date("2026-04-01T00:00:00Z"),
    });
    reviews.push({
      id: "r1",
      leadId: "lead_a",
      authorName: "A",
      authorPhoto: null,
      rating: 5,
      text: null,
      relativeTime: "1d",
      publishTime: new Date(),
    });
    setSession(wsA);
    const res = await GET(makeReq(), makeParams("lead_a"));
    const body = await res.json();
    expect(body.analysis).toMatchObject({
      id: "an1",
      leadScore: 78,
      summary: "Great service",
      reviewsAnalyzedCount: 25,
    });
    expect(body.status).toBe("ANALYZED");
  });
});
