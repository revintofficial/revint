/**
 * Unit tests for the SDR-Brain v2 Phase 2 deterministic rules added
 * to `TRIGGER_DETECTOR`. We mock the Prisma client at the module
 * boundary so the worker runs pure-in-memory and we can assert on
 * the trigger types it would have created without spinning up a DB.
 *
 * Coverage matrix (one positive + one negative test per rule):
 *   - RATING_DROP via 30d rolling window
 *   - COMPETITOR_PRESSURE from SalesOpportunity.reasonCodes
 *   - BAD_SERVICE_REVIEWS from weaknessKpis
 *   - MENU_REDESIGN_SIGNAL
 *   - DELIVERY_EXPANSION
 *   - SEASONAL_TOURISM
 *   - REBRANDING
 *   - NEW_LOCATION_OPENING via Account
 *   - CHAIN_EXPANSION via Account
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma at the module boundary — every leadTrigger.create + the
// snooze-clear updateMany is captured so we can read back what the
// worker would have written.
const created: Array<{ data: { type: string; severity: number; confidence: number; evidence: unknown; impactPrediction: string | null } }> = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    leadTrigger: {
      // Phase 6 soft-dedup adds a findFirst lookup keyed on
      // `evidence.refId` (or `.source`) before write. Returning null
      // takes the path that creates a fresh row — what these tests
      // are validating. Dedup-specific behaviour gets its own
      // dedicated spec.
      findFirst: vi.fn(async () => null),
      update: vi.fn(async (args: { where: { id: string }; data: unknown }) => ({
        id: args.where.id,
        ...(args.data as Record<string, unknown>),
      })),
      create: vi.fn(async (args: { data: { type: string; severity: number; confidence: number; evidence: unknown; impactPrediction: string | null } }) => {
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
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Block any real Gemini call in case the bucketer branch happens to
// fire. The test fixtures keep detected.length > 0 so it should be
// skipped, but defense in depth.
vi.mock("@/lib/ai-core/providers", () => ({
  getStructuredInferenceProvider: () => ({
    structuredInfer: vi.fn(async () => ({ data: { triggers: [] } })),
  }),
}));

import { run as runTriggerDetector } from "@/lib/agent-workers/trigger-detector";
import type { AgentWorkerContext } from "@/lib/agent-workers/types";

function makeCtx(overrides: {
  lead: Partial<AgentWorkerContext["lead"]> & { id: string; createdAt?: Date };
  memory?: AgentWorkerContext["memory"];
}): AgentWorkerContext {
  const lead = {
    // Reasonable defaults so every test starts from the same neutral
    // baseline and only the fields it cares about diverge.
    id: overrides.lead.id,
    workspaceId: "ws-1",
    businessName: "Test Business",
    rating: 4.5,
    reviewCount: 100,
    priceLevel: 2,
    hasWebsite: true,
    websiteUrl: "https://example.com",
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
    googleReviews: undefined,
    account: null,
    createdAt: new Date(),
    ...overrides.lead,
  } as unknown as AgentWorkerContext["lead"];

  return {
    runId: "run-1",
    workspaceId: "ws-1",
    workspacePlan: "FREE",
    leadId: lead!.id,
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
    memory: overrides.memory ?? [],
    plannerSessionId: null,
    emit: async () => {},
    runInputs: {},
  };
}

beforeEach(() => {
  created.length = 0;
});

describe("TRIGGER_DETECTOR — RATING_DROP rolling-window rule", () => {
  it("fires when last-30d avg is >= 0.4 stars below prior-30d", async () => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const reviews = [
      // Last 30 days — avg 3.0
      { id: "r1", rating: 3, publishTime: new Date(now - 5 * day) },
      { id: "r2", rating: 3, publishTime: new Date(now - 10 * day) },
      { id: "r3", rating: 3, publishTime: new Date(now - 15 * day) },
      { id: "r4", rating: 3, publishTime: new Date(now - 20 * day) },
      // Prior 30 days — avg 4.5
      { id: "r5", rating: 5, publishTime: new Date(now - 35 * day) },
      { id: "r6", rating: 4, publishTime: new Date(now - 40 * day) },
      { id: "r7", rating: 5, publishTime: new Date(now - 50 * day) },
      { id: "r8", rating: 4, publishTime: new Date(now - 55 * day) },
    ];
    await runTriggerDetector(
      makeCtx({
        lead: {
          id: "lead-1",
          googleReviews: reviews as unknown as never,
        },
      }),
    );
    const ratingDrop = created.filter((c) => c.data.type === "RATING_DROP");
    expect(ratingDrop.length).toBeGreaterThan(0);
  });

  it("does not fire when buckets have <3 reviews each", async () => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const reviews = [
      { id: "r1", rating: 3, publishTime: new Date(now - 5 * day) },
      { id: "r2", rating: 3, publishTime: new Date(now - 10 * day) },
      { id: "r3", rating: 5, publishTime: new Date(now - 35 * day) },
      { id: "r4", rating: 5, publishTime: new Date(now - 40 * day) },
    ];
    await runTriggerDetector(
      makeCtx({
        lead: {
          id: "lead-2",
          googleReviews: reviews as unknown as never,
        },
      }),
    );
    expect(created.filter((c) => c.data.type === "RATING_DROP")).toHaveLength(0);
  });
});

describe("TRIGGER_DETECTOR — COMPETITOR_PRESSURE", () => {
  it("fires when SalesOpportunity.reasonCodes contains HIGH_RATING_WEAK_SITE", async () => {
    await runTriggerDetector(
      makeCtx({
        lead: {
          id: "lead-3",
          salesOpportunity: {
            id: "so-3",
            reasonCodes: ["HIGH_RATING_WEAK_SITE", "PRICE_LEVEL_FIT"],
          } as unknown as never,
        },
      }),
    );
    const cp = created.filter((c) => c.data.type === "COMPETITOR_PRESSURE");
    expect(cp.length).toBeGreaterThan(0);
  });

  it("does not fire for unrelated reason codes", async () => {
    await runTriggerDetector(
      makeCtx({
        lead: {
          id: "lead-4",
          salesOpportunity: {
            id: "so-4",
            reasonCodes: ["RECENTLY_OPENED", "PRICE_LEVEL_FIT"],
          } as unknown as never,
        },
      }),
    );
    expect(
      created.filter((c) => c.data.type === "COMPETITOR_PRESSURE"),
    ).toHaveLength(0);
  });
});

describe("TRIGGER_DETECTOR — BAD_SERVICE_REVIEWS via weaknessKpis", () => {
  it("fires when weaknessKpis have service/wait/slow >= 3 count", async () => {
    await runTriggerDetector(
      makeCtx({
        lead: {
          id: "lead-5",
          reviewAnalysis: {
            id: "ra-5",
            weaknessKpis: [
              { label: "Slow service", count: 8 },
              { label: "Long wait time", count: 5 },
            ],
            painPhrases: [],
            sentimentBreakdown: { negative: 0 },
          } as unknown as never,
        },
      }),
    );
    expect(
      created.filter((c) => c.data.type === "BAD_SERVICE_REVIEWS").length,
    ).toBeGreaterThan(0);
  });

  it("does not double-emit when painPhrases path already fired", async () => {
    await runTriggerDetector(
      makeCtx({
        lead: {
          id: "lead-6",
          reviewAnalysis: {
            id: "ra-6",
            // Triggers existing pre-Phase-2 rule via painPhrases.
            painPhrases: ["slow service", "rude staff", "waited 20 min"],
            sentimentBreakdown: { negative: 0.4 },
            weaknessKpis: [{ label: "Slow service", count: 5 }],
          } as unknown as never,
        },
      }),
    );
    expect(
      created.filter((c) => c.data.type === "BAD_SERVICE_REVIEWS"),
    ).toHaveLength(1);
  });
});

describe("TRIGGER_DETECTOR — MENU_REDESIGN_SIGNAL", () => {
  it("fires on menu/pricing/portion weakness KPIs", async () => {
    await runTriggerDetector(
      makeCtx({
        lead: {
          id: "lead-7",
          reviewAnalysis: {
            id: "ra-7",
            weaknessKpis: [{ label: "Overpriced menu", count: 6 }],
            painPhrases: [],
            sentimentBreakdown: { negative: 0 },
          } as unknown as never,
        },
      }),
    );
    expect(
      created.filter((c) => c.data.type === "MENU_REDESIGN_SIGNAL").length,
    ).toBeGreaterThan(0);
  });

  it("bumps severity when audit confirms stale menu PDF", async () => {
    const sixMonthsAndOne = new Date(
      Date.now() - 200 * 24 * 60 * 60 * 1000,
    ).toISOString();
    await runTriggerDetector(
      makeCtx({
        lead: {
          id: "lead-8",
          reviewAnalysis: {
            id: "ra-8",
            weaknessKpis: [{ label: "Confusing pricing", count: 4 }],
            painPhrases: [],
            sentimentBreakdown: { negative: 0 },
          } as unknown as never,
          websiteAudit: {
            id: "wa-8",
            rawFeaturesJson: { menuPdfLastUpdated: sixMonthsAndOne },
          } as unknown as never,
        },
      }),
    );
    const menu = created.find((c) => c.data.type === "MENU_REDESIGN_SIGNAL");
    expect(menu).toBeDefined();
    expect(menu!.data.severity).toBeGreaterThanOrEqual(70);
  });
});

describe("TRIGGER_DETECTOR — DELIVERY_EXPANSION", () => {
  it("fires when delivery complaints + no delivery service detected", async () => {
    await runTriggerDetector(
      makeCtx({
        lead: {
          id: "lead-9",
          reviewAnalysis: {
            id: "ra-9",
            weaknessKpis: [{ label: "No delivery option", count: 3 }],
            painPhrases: [],
            sentimentBreakdown: { negative: 0 },
          } as unknown as never,
          websiteAudit: {
            id: "wa-9",
            servicesDetected: ["dine-in", "reservations"],
          } as unknown as never,
        },
      }),
    );
    expect(
      created.filter((c) => c.data.type === "DELIVERY_EXPANSION").length,
    ).toBeGreaterThan(0);
  });

  it("does not fire when site already offers delivery", async () => {
    await runTriggerDetector(
      makeCtx({
        lead: {
          id: "lead-10",
          reviewAnalysis: {
            id: "ra-10",
            weaknessKpis: [{ label: "Delivery is slow", count: 4 }],
            painPhrases: [],
            sentimentBreakdown: { negative: 0 },
          } as unknown as never,
          websiteAudit: {
            id: "wa-10",
            servicesDetected: ["dine-in", "delivery"],
          } as unknown as never,
        },
      }),
    );
    expect(
      created.filter((c) => c.data.type === "DELIVERY_EXPANSION"),
    ).toHaveLength(0);
  });
});

describe("TRIGGER_DETECTOR — SEASONAL_TOURISM", () => {
  it("fires in May–September for a tourism-zone borough", async () => {
    // Use mid-July fixed date so the test is deterministic.
    vi.setSystemTime(new Date("2026-07-15T12:00:00Z"));
    await runTriggerDetector(
      makeCtx({
        lead: {
          id: "lead-11",
          borough: "Westminster",
        },
      }),
    );
    expect(
      created.filter((c) => c.data.type === "SEASONAL_TOURISM").length,
    ).toBeGreaterThan(0);
    vi.useRealTimers();
  });

  it("does not fire outside the tourism window", async () => {
    vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));
    await runTriggerDetector(
      makeCtx({
        lead: {
          id: "lead-12",
          borough: "Westminster",
        },
      }),
    );
    expect(
      created.filter((c) => c.data.type === "SEASONAL_TOURISM"),
    ).toHaveLength(0);
    vi.useRealTimers();
  });
});

describe("TRIGGER_DETECTOR — REBRANDING", () => {
  it("fires when site title diverges from business name", async () => {
    await runTriggerDetector(
      makeCtx({
        lead: {
          id: "lead-13",
          businessName: "Glass Coffee",
          websiteAudit: {
            id: "wa-13",
            title: "Roastery 88 — Specialty Beans Online Shop",
          } as unknown as never,
        },
      }),
    );
    expect(
      created.filter((c) => c.data.type === "REBRANDING").length,
    ).toBeGreaterThan(0);
  });

  it("does not fire when site title matches business name", async () => {
    await runTriggerDetector(
      makeCtx({
        lead: {
          id: "lead-14",
          businessName: "Glass Coffee",
          websiteAudit: {
            id: "wa-14",
            title: "Glass Coffee — London Roastery",
          } as unknown as never,
        },
      }),
    );
    expect(created.filter((c) => c.data.type === "REBRANDING")).toHaveLength(0);
  });
});

describe("TRIGGER_DETECTOR — NEW_LOCATION_OPENING + CHAIN_EXPANSION via Account", () => {
  it("emits NEW_LOCATION_OPENING for a fresh lead in a multi-location account", async () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    await runTriggerDetector(
      makeCtx({
        lead: {
          id: "lead-15",
          createdAt: tenDaysAgo,
          account: {
            id: "acc-15",
            locationsCount: 2,
            tier: "TIER_2",
          } as unknown as never,
        },
      }),
    );
    expect(
      created.filter((c) => c.data.type === "NEW_LOCATION_OPENING").length,
    ).toBeGreaterThan(0);
  });

  it("emits CHAIN_EXPANSION for accounts with 3+ locations", async () => {
    await runTriggerDetector(
      makeCtx({
        lead: {
          id: "lead-16",
          createdAt: new Date(),
          account: {
            id: "acc-16",
            locationsCount: 8,
            tier: "TIER_1",
          } as unknown as never,
        },
      }),
    );
    expect(
      created.filter((c) => c.data.type === "CHAIN_EXPANSION").length,
    ).toBeGreaterThan(0);
  });

  it("does not emit NEW_LOCATION_OPENING for stale leads", async () => {
    const sixMonthsAgo = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000);
    await runTriggerDetector(
      makeCtx({
        lead: {
          id: "lead-17",
          createdAt: sixMonthsAgo,
          account: {
            id: "acc-17",
            locationsCount: 2,
            tier: "TIER_3",
          } as unknown as never,
        },
      }),
    );
    expect(
      created.filter((c) => c.data.type === "NEW_LOCATION_OPENING"),
    ).toHaveLength(0);
  });
});
