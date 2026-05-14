/**
 * Truth Layer v1 — T-C Evidence Calibration: window-timer derivation +
 * COMPETITOR_PRESSURE outbound-only gate.
 *
 * Master plan §3 T-C bullet 3 has two outputs that share this file:
 *   1. `deriveWindowClosesAt({detectedAt, urgencyWindowDays})` is the
 *      pure helper the worker calls per persisted trigger to stamp
 *      `evidence.windowClosesAt`. The dispatch prompt's test surface:
 *        - A trigger row that never fired: `windowClosesAt === null`.
 *        - A `RATING_DROP` trigger from 30 days ago with 60-day window:
 *          `windowClosesAt` ≈ 30 days from now.
 *   2. The COMPETITOR_PRESSURE rule must fire ONLY when at least one
 *      switch signal carries `direction = outbound`. Inbound + neutral
 *      signals must NOT trigger the rule even when SalesOpportunity
 *      reasonCodes match — that was the v1 over-fire bug T-C exists
 *      to close.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const created: Array<{
  data: {
    workspaceId: string;
    type: string;
    severity: number;
    confidence: number;
    evidence: Record<string, unknown>;
    impactPrediction: string | null;
    urgencyWindowDays: number;
    detectedAt?: Date;
  };
}> = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    leadTrigger: {
      // Phase 6 soft-dedup adds a findFirst lookup before write. Returning
      // null forces every row through the create branch — exactly what
      // these tests want to inspect.
      findFirst: vi.fn(async () => null),
      update: vi.fn(async (args: { where: { id: string }; data: unknown }) => ({
        id: args.where.id,
        ...(args.data as Record<string, unknown>),
      })),
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

// Block any real Gemini call. The COMPETITOR_PRESSURE / direction tests
// keep `detected.length > 0` once they fire, so the bucketer branch
// shouldn't trip — defense in depth regardless.
vi.mock("@/lib/ai-core/providers", () => ({
  getStructuredInferenceProvider: () => ({
    structuredInfer: vi.fn(async () => ({ data: { triggers: [] } })),
  }),
}));

import {
  deriveWindowClosesAt,
  readStructuredSwitchSignals,
  run as runTriggerDetector,
} from "@/lib/agent-workers/trigger-detector";
import type { AgentWorkerContext } from "@/lib/agent-workers/types";

const DAY_MS = 24 * 60 * 60 * 1000;

function makeCtx(overrides: {
  lead: Partial<AgentWorkerContext["lead"]> & { id: string };
}): AgentWorkerContext {
  const lead = {
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
    memory: [],
    plannerSessionId: null,
    emit: async () => {},
    runInputs: {},
  };
}

beforeEach(() => {
  created.length = 0;
});

describe("deriveWindowClosesAt — pure helper", () => {
  it("returns null when detectedAt is null (trigger never fired)", () => {
    expect(
      deriveWindowClosesAt({ detectedAt: null, urgencyWindowDays: 30 }),
    ).toBeNull();
  });

  it("returns null when urgencyWindowDays is null", () => {
    expect(
      deriveWindowClosesAt({
        detectedAt: new Date("2026-04-14T00:00:00Z"),
        urgencyWindowDays: null,
      }),
    ).toBeNull();
  });

  it("returns null when both fields are missing", () => {
    expect(
      deriveWindowClosesAt({
        detectedAt: undefined,
        urgencyWindowDays: undefined,
      }),
    ).toBeNull();
  });

  it("RATING_DROP from 30 days ago with 60-day window → ~30 days from now", () => {
    // Test surface from the dispatch prompt — verifies the trigger
    // closes 30 days into the future when its detection happened
    // 30 days into the past against a 60-day urgency window.
    const now = Date.now();
    const detectedAt = new Date(now - 30 * DAY_MS);
    const closesAt = deriveWindowClosesAt({
      detectedAt,
      urgencyWindowDays: 60,
    })!;
    expect(closesAt).toBeInstanceOf(Date);
    const closesIn = closesAt.getTime() - now;
    // Allow 1-day slack for clock + test execution drift.
    expect(closesIn).toBeGreaterThan(29 * DAY_MS);
    expect(closesIn).toBeLessThan(31 * DAY_MS);
  });

  it("derives the exact arithmetic: detectedAt + days * 86_400_000ms", () => {
    const detectedAt = new Date("2026-04-01T00:00:00Z");
    const closesAt = deriveWindowClosesAt({
      detectedAt,
      urgencyWindowDays: 14,
    })!;
    expect(closesAt.toISOString()).toBe("2026-04-15T00:00:00.000Z");
  });

  it("guards against non-finite urgencyWindowDays (Infinity / NaN)", () => {
    expect(
      deriveWindowClosesAt({
        detectedAt: new Date(),
        urgencyWindowDays: Number.POSITIVE_INFINITY,
      }),
    ).toBeNull();
    expect(
      deriveWindowClosesAt({
        detectedAt: new Date(),
        urgencyWindowDays: Number.NaN,
      }),
    ).toBeNull();
  });
});

describe("readStructuredSwitchSignals — legacy/structured tolerance", () => {
  it("extracts only entries that conform to switch-signal@v1", () => {
    const blob = [
      // Legacy flat string — must be filtered out (no `direction`).
      "we used to go to X but moved",
      // Structured (passes).
      {
        competitor: "Resy",
        direction: "comparison_neutral",
        quote: "Resy is instant elsewhere",
        reviewId: "r1",
        severity: 5,
      },
      // Malformed `direction` value — must be filtered out.
      {
        competitor: "Foo",
        direction: "unknown",
        quote: "x",
        reviewId: "r2",
        severity: 0,
      },
    ];
    const out = readStructuredSwitchSignals(blob);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      direction: "comparison_neutral",
      competitor: "Resy",
    });
  });

  it("returns [] for non-array inputs", () => {
    expect(readStructuredSwitchSignals(null)).toEqual([]);
    expect(readStructuredSwitchSignals(undefined)).toEqual([]);
    expect(readStructuredSwitchSignals("not an array")).toEqual([]);
    expect(readStructuredSwitchSignals({})).toEqual([]);
  });
});

describe("TRIGGER_DETECTOR — COMPETITOR_PRESSURE outbound-only gate", () => {
  it("does NOT fire on inbound switch signal (Maido Bar fixture)", async () => {
    // Maido has reasonCodes that previously matched, plus an inbound
    // switch signal. Per the new gate, inbound is positive intent —
    // not a defection — so COMPETITOR_PRESSURE must stay silent.
    await runTriggerDetector(
      makeCtx({
        lead: {
          id: "lead-maido",
          businessName: "Maido Bar",
          salesOpportunity: {
            id: "so-maido",
            reasonCodes: ["HIGH_RATING_WEAK_SITE"],
          } as unknown as never,
          reviewAnalysis: {
            id: "ra-maido",
            painPhrases: [],
            sentimentBreakdown: { negative: 0 },
            weaknessKpis: [],
            switchSignals: [
              {
                competitor: "Sankaku",
                direction: "inbound",
                quote: "way better cocktails than the place I used to go",
                reviewId: "lead-maido:switch:0",
                severity: 30,
              },
            ],
          } as unknown as never,
        },
      }),
    );
    expect(
      created.filter((c) => c.data.type === "COMPETITOR_PRESSURE"),
    ).toHaveLength(0);
  });

  it("does NOT fire on comparison_neutral switch signal (Casa Polanco fixture)", async () => {
    await runTriggerDetector(
      makeCtx({
        lead: {
          id: "lead-casa",
          businessName: "Casa Polanco",
          salesOpportunity: {
            id: "so-casa",
            reasonCodes: ["COMPETITOR_DENSE_AREA"],
          } as unknown as never,
          reviewAnalysis: {
            id: "ra-casa",
            painPhrases: [],
            sentimentBreakdown: { negative: 0 },
            weaknessKpis: [],
            switchSignals: [
              {
                competitor: "Resy",
                direction: "comparison_neutral",
                quote: "tuvimos que llamar 4 veces, ahora con Resy es instantáneo",
                reviewId: "lead-casa:switch:0",
                severity: 10,
              },
            ],
          } as unknown as never,
        },
      }),
    );
    expect(
      created.filter((c) => c.data.type === "COMPETITOR_PRESSURE"),
    ).toHaveLength(0);
  });

  it("FIRES on outbound switch signal with matching reasonCodes (synthetic)", async () => {
    await runTriggerDetector(
      makeCtx({
        lead: {
          id: "lead-outbound",
          businessName: "Acme Bistro",
          salesOpportunity: {
            id: "so-outbound",
            reasonCodes: ["HIGH_RATING_WEAK_SITE", "PRICE_LEVEL_FIT"],
          } as unknown as never,
          reviewAnalysis: {
            id: "ra-outbound",
            painPhrases: [],
            sentimentBreakdown: { negative: 0 },
            weaknessKpis: [],
            switchSignals: [
              {
                competitor: "Other Place",
                direction: "outbound",
                quote: "we used to go to Acme but moved",
                reviewId: "lead-outbound:switch:0",
                severity: 55,
              },
            ],
          } as unknown as never,
        },
      }),
    );
    const cp = created.filter((c) => c.data.type === "COMPETITOR_PRESSURE");
    expect(cp).toHaveLength(1);
    // The new evidence shape carries the outbound competitor for
    // downstream openers (T-D brief, opener-writer "defection" hook).
    expect(cp[0].data.evidence.outboundCompetitor).toBe("Other Place");
    expect(cp[0].data.evidence.source).toContain("SwitchSignal.outbound");
  });

  it("does NOT fire when outbound exists but reasonCodes don't match", async () => {
    // Outbound is necessary but not sufficient — the SalesOpportunity
    // narrative must still confirm a competitive landscape. This
    // preserves the rule's existing strength gate.
    await runTriggerDetector(
      makeCtx({
        lead: {
          id: "lead-no-codes",
          businessName: "Acme",
          salesOpportunity: {
            id: "so-no-codes",
            reasonCodes: ["RECENTLY_OPENED", "PRICE_LEVEL_FIT"],
          } as unknown as never,
          reviewAnalysis: {
            id: "ra-no-codes",
            painPhrases: [],
            sentimentBreakdown: { negative: 0 },
            weaknessKpis: [],
            switchSignals: [
              {
                competitor: "Other",
                direction: "outbound",
                quote: "we left",
                reviewId: "lead-no-codes:switch:0",
                severity: 40,
              },
            ],
          } as unknown as never,
        },
      }),
    );
    expect(
      created.filter((c) => c.data.type === "COMPETITOR_PRESSURE"),
    ).toHaveLength(0);
  });
});

describe("TRIGGER_DETECTOR — windowClosesAt persistence", () => {
  it("stamps evidence.windowClosesAt as ISO string when a rule fires", async () => {
    // RATING_DROP via the windowed 30-day rule (Rule A). We pin the
    // review timestamps so the rule fires deterministically, then
    // assert the persisted evidence carries a parseable ISO date.
    const now = Date.now();
    const reviews = [
      { id: "r1", rating: 3, publishTime: new Date(now - 5 * DAY_MS) },
      { id: "r2", rating: 3, publishTime: new Date(now - 10 * DAY_MS) },
      { id: "r3", rating: 3, publishTime: new Date(now - 15 * DAY_MS) },
      { id: "r4", rating: 3, publishTime: new Date(now - 20 * DAY_MS) },
      { id: "r5", rating: 5, publishTime: new Date(now - 35 * DAY_MS) },
      { id: "r6", rating: 4, publishTime: new Date(now - 40 * DAY_MS) },
      { id: "r7", rating: 5, publishTime: new Date(now - 50 * DAY_MS) },
      { id: "r8", rating: 4, publishTime: new Date(now - 55 * DAY_MS) },
    ];
    await runTriggerDetector(
      makeCtx({
        lead: {
          id: "lead-window",
          googleReviews: reviews as unknown as never,
        },
      }),
    );
    const ratingDrop = created.find((c) => c.data.type === "RATING_DROP");
    expect(ratingDrop).toBeDefined();
    const window = ratingDrop!.data.evidence.windowClosesAt;
    expect(typeof window).toBe("string");
    // Parsing must round-trip; the stamp is computed as
    // detectedAt + urgencyWindowDays * day = now + 30 days.
    const parsed = Date.parse(window as string);
    expect(Number.isFinite(parsed)).toBe(true);
    const closesIn = parsed - now;
    // 30 days ± 1 day for execution slack.
    expect(closesIn).toBeGreaterThan(29 * DAY_MS);
    expect(closesIn).toBeLessThan(31 * DAY_MS);
  });
});
