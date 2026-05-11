/**
 * Phase 8 — TRIGGER_DETECTOR review-volume rule (`REVIEW_VOLUME_SURGE`
 * and `REVIEW_VOLUME_DIP`).
 *
 * The rule reads the lead's `googleReviews` corpus and pipes it
 * through the SHARED `computeReviewVelocity` /
 * `classifyVelocityTrigger` helpers in
 * `src/lib/lead-detail/review-velocity.ts` — the SAME helpers the
 * Phase 3 `ReviewVelocityBadge` calls. This test asserts the
 * fixture matrix from PLAN §4 Phase 8:
 *
 *   recent=12, prior=6  → REVIEW_VOLUME_SURGE (+100%)
 *   recent=4,  prior=10 → REVIEW_VOLUME_DIP   (-60%)
 *   recent=7,  prior=6  → no trigger (under +50% threshold)
 *   recent=20, prior=4  → REVIEW_VOLUME_SURGE (+400%) but under prior=5 dip guard
 *   recent=5,  prior=4  → no trigger (prior < 5)
 *   total < 6 reviews   → no trigger (micro-volume guard)
 *
 * Plus integration assertions: the trigger-detector writes the
 * row into `prisma.leadTrigger.create` with the structured evidence
 * the queue-strip headline + EvidenceChip rely on.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const created: Array<{
  data: {
    workspaceId: string;
    type: string;
    severity: number;
    confidence: number;
    evidence: unknown;
    impactPrediction: string | null;
    urgencyWindowDays: number;
  };
}> = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    leadTrigger: {
      create: vi.fn(async (args: typeof created[number]) => {
        created.push(args);
        return { id: `t-${created.length}`, ...args.data };
      }),
    },
    lead: {
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/ai-core/providers", () => ({
  getStructuredInferenceProvider: () => ({
    structuredInfer: vi.fn(async () => ({ data: { triggers: [] } })),
  }),
}));

import { run as runTriggerDetector } from "@/lib/agent-workers/trigger-detector";
import type { AgentWorkerContext } from "@/lib/agent-workers/types";

interface FixtureReview {
  id: string;
  rating: number;
  publishTime: Date;
}

const DAY = 24 * 60 * 60 * 1000;

function makeReviews(args: {
  recentCount: number;
  priorCount: number;
  recentRating?: number;
  priorRating?: number;
}): FixtureReview[] {
  const now = Date.now();
  const reviews: FixtureReview[] = [];
  for (let i = 0; i < args.recentCount; i += 1) {
    reviews.push({
      id: `recent-${i}`,
      rating: args.recentRating ?? 4,
      publishTime: new Date(now - (5 + i) * DAY),
    });
  }
  for (let i = 0; i < args.priorCount; i += 1) {
    reviews.push({
      id: `prior-${i}`,
      rating: args.priorRating ?? 4,
      publishTime: new Date(now - (35 + i) * DAY),
    });
  }
  return reviews;
}

function makeCtx(reviews: FixtureReview[]): AgentWorkerContext {
  const lead = {
    id: "lead-rv",
    workspaceId: "ws-1",
    businessName: "Test Business",
    rating: 4.2,
    reviewCount: reviews.length,
    priceLevel: 2,
    hasWebsite: true,
    websiteUrl: null,
    icpFitScore: 60,
    icpVersion: 1,
    icpReasons: [],
    dnc: false,
    optedOutAt: null,
    timezone: "Europe/London",
    borough: null,
    nicheSlug: "fnb",
    subNicheSlug: null,
    primaryType: null,
    websiteAudit: null,
    salesOpportunity: null,
    reviewAnalysis: null,
    googleReviews: reviews as unknown,
    account: null,
    createdAt: new Date(),
  } as unknown as AgentWorkerContext["lead"];

  return {
    runId: "run-1",
    workspaceId: "ws-1",
    workspacePlan: "FREE",
    leadId: lead.id,
    userId: null,
    lead,
    workspace: {
      id: "ws-1",
      name: "Test",
      slug: "test",
      plan: "FREE",
      language: "EN",
      tone: "PROFESSIONAL",
      offerName: null,
      valueProposition: null,
      offerHook: null,
      objective: null,
      senderName: null,
      conversionLink: null,
      socialProof: null,
      branding: null,
      niche: "FNB",
    } as unknown as AgentWorkerContext["workspace"],
    memory: [],
    plannerSessionId: null,
    emit: async () => {},
    runInputs: {},
  };
}

beforeEach(() => {
  created.length = 0;
});

describe("TRIGGER_DETECTOR — REVIEW_VOLUME_SURGE rule", () => {
  it("fires when recent=12, prior=6 (delta +100%, recent >= 8)", async () => {
    await runTriggerDetector(
      makeCtx(makeReviews({ recentCount: 12, priorCount: 6 })),
    );
    const surge = created.filter(
      (c) => c.data.type === "REVIEW_VOLUME_SURGE",
    );
    expect(surge.length).toBe(1);
    const ev = surge[0]!.data.evidence as {
      recentCount: number;
      priorCount: number;
      deltaPct: number;
      source: string;
    };
    expect(ev.recentCount).toBe(12);
    expect(ev.priorCount).toBe(6);
    expect(ev.deltaPct).toBe(100);
    expect(ev.source).toBe("GoogleReview.velocity");
    expect(surge[0]!.data.urgencyWindowDays).toBe(30);
    expect(surge[0]!.data.impactPrediction).toMatch(/momentum/i);
  });

  it("does NOT fire when recent=7, prior=6 (under +50% threshold)", async () => {
    await runTriggerDetector(
      makeCtx(makeReviews({ recentCount: 7, priorCount: 6 })),
    );
    expect(
      created.filter((c) => c.data.type === "REVIEW_VOLUME_SURGE"),
    ).toHaveLength(0);
    expect(
      created.filter((c) => c.data.type === "REVIEW_VOLUME_DIP"),
    ).toHaveLength(0);
  });

  it("DOES fire on recent=20, prior=4 (delta +400%, recent >= 8 — surge guard met even though prior < 5 dip guard wouldn't be)", async () => {
    await runTriggerDetector(
      makeCtx(makeReviews({ recentCount: 20, priorCount: 4 })),
    );
    const surge = created.filter(
      (c) => c.data.type === "REVIEW_VOLUME_SURGE",
    );
    expect(surge.length).toBe(1);
    const ev = surge[0]!.data.evidence as { deltaPct: number };
    expect(ev.deltaPct).toBe(400);
  });
});

describe("TRIGGER_DETECTOR — REVIEW_VOLUME_DIP rule", () => {
  it("fires when recent=4, prior=10 (delta -60%, prior >= 5)", async () => {
    await runTriggerDetector(
      makeCtx(makeReviews({ recentCount: 4, priorCount: 10 })),
    );
    const dip = created.filter((c) => c.data.type === "REVIEW_VOLUME_DIP");
    expect(dip.length).toBe(1);
    const ev = dip[0]!.data.evidence as {
      recentCount: number;
      priorCount: number;
      deltaPct: number;
    };
    expect(ev.recentCount).toBe(4);
    expect(ev.priorCount).toBe(10);
    expect(ev.deltaPct).toBe(-60);
    // Dip carries the higher confidence per Phase 8 (operations-gap
    // signals are durable buying signals).
    expect(dip[0]!.data.confidence).toBeGreaterThanOrEqual(0.75);
    expect(dip[0]!.data.impactPrediction).toMatch(/operations|coverage/i);
  });

  it("does NOT fire when recent=5, prior=4 (prior bucket < 5 guard)", async () => {
    await runTriggerDetector(
      makeCtx(makeReviews({ recentCount: 5, priorCount: 4 })),
    );
    expect(
      created.filter((c) => c.data.type === "REVIEW_VOLUME_DIP"),
    ).toHaveLength(0);
  });
});

describe("TRIGGER_DETECTOR — review-volume micro-volume guard", () => {
  it("does NOT fire when total reviews < 6 (Rule A guard)", async () => {
    await runTriggerDetector(
      makeCtx(makeReviews({ recentCount: 2, priorCount: 2 })),
    );
    expect(
      created.filter(
        (c) =>
          c.data.type === "REVIEW_VOLUME_SURGE" ||
          c.data.type === "REVIEW_VOLUME_DIP",
      ),
    ).toHaveLength(0);
  });

  it("does NOT fire when there are no reviews at all", async () => {
    await runTriggerDetector(makeCtx([]));
    expect(
      created.filter(
        (c) =>
          c.data.type === "REVIEW_VOLUME_SURGE" ||
          c.data.type === "REVIEW_VOLUME_DIP",
      ),
    ).toHaveLength(0);
  });
});

describe("TRIGGER_DETECTOR — review-volume multi-tenant scope", () => {
  it("writes the trigger under the lead's workspaceId, never any other", async () => {
    const ctx = makeCtx(makeReviews({ recentCount: 12, priorCount: 6 }));
    await runTriggerDetector(ctx);
    for (const row of created) {
      expect(row.data.workspaceId).toBe("ws-1");
    }
  });
});
