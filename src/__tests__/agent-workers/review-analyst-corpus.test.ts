/**
 * Task 2 — review corpus threshold + sellable pain phrases.
 *
 * Dishoom had 29,744 reviews on Google but only 5 in our corpus; the
 * worker still printed KPI bars and a 0–100 lead score off those 5.
 * Below MIN_REVIEW_CORPUS (30) the worker must not call Gemini, must
 * not upsert ReviewAnalysis, and returns `{ skipped: "thin_corpus", count }`.
 * Above it, pain phrases carry `sellable` (taste / food poisoning are
 * never a sales angle; waiting, reservation, order errors, bill are),
 * and the worker no longer persists Gemini's 0–100 lead score.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentWorkerContext } from "@/lib/agent-workers/types";

const { analyzeReviewsWithGeminiMock } = vi.hoisted(() => ({
  analyzeReviewsWithGeminiMock: vi.fn(),
}));
vi.mock("@/lib/gemini", () => ({ analyzeReviewsWithGemini: analyzeReviewsWithGeminiMock }));

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    lead: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findFirstOrThrow: vi.fn(),
    },
    reviewAnalysis: {
      upsert: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { loggerMock } = vi.hoisted(() => ({
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/logger", () => ({ logger: loggerMock }));

import {
  MIN_REVIEW_CORPUS,
  memoryWrites,
  run,
  shouldAnalyzeReviews,
} from "@/lib/agent-workers/review-analyst";
import { EmbeddingError } from "@/lib/ai-core/embed";
import { isSellablePainText, normalizePainPhrases } from "@/lib/review-analysis/pain-phrases";

function review(i: number, rating: number, text: string) {
  return {
    id: `r_${i}`,
    leadId: "lead_1",
    authorName: `U${i}`,
    rating,
    text,
    relativeTime: "",
    publishTime: new Date("2026-01-01"),
    createdAt: new Date(),
  };
}

function corpus(n: number) {
  const out = [
    review(0, 1, "we waited forty minutes for a table even with a booking"),
    review(1, 2, "the food was bland and overpriced for what it was"),
    review(2, 1, "they got our order wrong twice and nobody apologised"),
  ];
  for (let i = out.length; i < n; i++) out.push(review(i, 3, `an ordinary visit number ${i}`));
  return out.slice(0, n);
}

function leadRow(n: number) {
  return {
    id: "lead_1",
    workspaceId: "ws_1",
    businessName: "Dishoom",
    formattedAddress: "Covent Garden",
    rating: 4.7,
    reviewCount: 29744,
    workspace: { offerName: null, valueProposition: null, niche: "RESTAURANT_TECH" },
    googleReviews: corpus(n),
  };
}

function ctx(): AgentWorkerContext {
  return {
    runId: "run_1",
    workspaceId: "ws_1",
    workspacePlan: "PRO",
    leadId: "lead_1",
    userId: "user_1",
    lead: { id: "lead_1" } as never,
    workspace: { id: "ws_1", niche: "RESTAURANT_TECH" } as never,
    memory: [],
    plannerSessionId: null,
    emit: vi.fn().mockResolvedValue(undefined),
  } as AgentWorkerContext;
}

function geminiAnalysis() {
  return {
    reviewsAnalyzedCount: 30,
    weaknessKpis: [],
    strengthKpis: [],
    sentimentBreakdown: { positive: 0.5, neutral: 0.3, negative: 0.2 },
    painPhrases: [
      { text: "waited forty minutes for a table", sellable: true },
      { text: "the food was bland", sellable: true }, // model got it wrong; taste is never sellable
      { text: "got our order wrong twice", sellable: true },
    ],
    strengthPhrases: [],
    switchSignals: [],
    leadScore: 88,
    summary: "Waits and order errors.",
  };
}

beforeEach(() => {
  analyzeReviewsWithGeminiMock.mockReset();
  prismaMock.lead.updateMany.mockClear();
  prismaMock.lead.findFirstOrThrow.mockReset();
  prismaMock.reviewAnalysis.upsert.mockClear();
  prismaMock.reviewAnalysis.deleteMany.mockClear();
  loggerMock.warn.mockClear();
});

describe("shouldAnalyzeReviews", () => {
  it("does not write KPI bars below 30 reviews", () => {
    expect(MIN_REVIEW_CORPUS).toBe(30);
    expect(shouldAnalyzeReviews(5)).toBe(false);
    expect(shouldAnalyzeReviews(29)).toBe(false);
    expect(shouldAnalyzeReviews(30)).toBe(true);
  });
});

describe("REVIEW_ANALYST thin corpus", () => {
  it("skips Gemini and the ReviewAnalysis upsert on a five-review sample", async () => {
    prismaMock.lead.findFirstOrThrow.mockResolvedValue(leadRow(5));
    const out = await run(ctx());
    expect(out.output).toMatchObject({ skipped: "thin_corpus", count: 5 });
    expect((out.output as Record<string, unknown>).leadScore).toBeUndefined();
    expect(analyzeReviewsWithGeminiMock).not.toHaveBeenCalled();
    expect(prismaMock.reviewAnalysis.upsert).not.toHaveBeenCalled();
    // Stale KPI bars from an earlier thin-sample run are cleared, scoped to the tenant.
    expect(prismaMock.reviewAnalysis.deleteMany).toHaveBeenCalledWith({
      where: { leadId: "lead_1", lead: { workspaceId: "ws_1" } },
    });
    expect(memoryWrites(out.output, ctx())).toEqual([]);
  });

  it("scopes every lead query by workspaceId", async () => {
    prismaMock.lead.findFirstOrThrow.mockResolvedValue(leadRow(5));
    await run(ctx());
    expect(prismaMock.lead.findFirstOrThrow.mock.calls[0][0].where).toEqual({
      id: "lead_1",
      workspaceId: "ws_1",
    });
    for (const call of prismaMock.lead.updateMany.mock.calls) {
      expect(call[0].where).toEqual({ id: "lead_1", workspaceId: "ws_1" });
    }
  });
});

describe("REVIEW_ANALYST full corpus", () => {
  it("analyses 30 reviews, flags sellable pains, and does not persist a lead score", async () => {
    prismaMock.lead.findFirstOrThrow.mockResolvedValue(leadRow(30));
    analyzeReviewsWithGeminiMock.mockResolvedValue(geminiAnalysis());
    const out = await run(ctx());

    expect(analyzeReviewsWithGeminiMock).toHaveBeenCalledTimes(1);
    const upsert = prismaMock.reviewAnalysis.upsert.mock.calls[0][0];
    expect(upsert.create.leadScore).toBe(0);
    expect(upsert.update.leadScore).toBe(0);
    expect(upsert.create.painPhrases).toEqual([
      { text: "waited forty minutes for a table", sellable: true, quotes: [], mentions: 0 },
      { text: "the food was bland", sellable: false, quotes: [], mentions: 0 },
      { text: "got our order wrong twice", sellable: true, quotes: [], mentions: 0 },
    ]);

    const o = out.output as { leadScore?: number; painPhrases: Array<{ text: string; sellable: boolean }> };
    expect(o.leadScore).toBeUndefined();
    expect(o.painPhrases.map((p) => p.sellable)).toEqual([true, false, true]);

    const writes = memoryWrites(out.output, ctx());
    const pains = writes.filter((w) => w.refType === "pain_phrase");
    expect(pains.map((w) => w.text)).toEqual([
      "waited forty minutes for a table",
      "the food was bland",
      "got our order wrong twice",
    ]);
    expect(pains[1].metadata).toMatchObject({ sellable: false });
  });

  it("logs an EmbeddingError and does not fail the run", async () => {
    prismaMock.lead.findFirstOrThrow.mockResolvedValue(leadRow(30));
    analyzeReviewsWithGeminiMock.mockRejectedValue(new EmbeddingError("Failed to embed after 3 attempts"));
    const out = await run(ctx());
    expect(out.output).toMatchObject({ skipped: true, reason: "embedding_unavailable" });
    const statuses = prismaMock.lead.updateMany.mock.calls.map((c) => c[0].data.reviewAnalysisStatus);
    expect(statuses).not.toContain("FAILED");
    expect(loggerMock.warn).toHaveBeenCalledWith(
      "agent_workers.review_analyst.embedding_failed",
      expect.objectContaining({ leadId: "lead_1" }),
    );
  });
});

describe("pain phrase sellable rules", () => {
  it("never sells taste or food poisoning", () => {
    expect(isSellablePainText("the food was bland", true)).toBe(false);
    expect(isSellablePainText("got food poisoning after the chicken", true)).toBe(false);
    expect(isSellablePainText("yemek tatsızdı", true)).toBe(false);
  });

  it("keeps waiting, reservation, order errors and the bill sellable", () => {
    expect(isSellablePainText("waited an hour for our food", false)).toBe(true);
    expect(isSellablePainText("they lost our reservation", false)).toBe(true);
    expect(isSellablePainText("got our order wrong", false)).toBe(true);
    expect(isSellablePainText("took ages to get the bill", false)).toBe(true);
  });

  it("reads legacy string rows with unknown sellability", () => {
    expect(normalizePainPhrases(["slow service", { text: "bland", sellable: false }, 3, null])).toEqual([
      { text: "slow service", sellable: null },
      { text: "bland", sellable: false },
    ]);
  });
});
