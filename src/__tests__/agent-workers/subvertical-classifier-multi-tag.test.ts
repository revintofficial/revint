/**
 * Phase 2.2 / 2.3 — SUBVERTICAL_CLASSIFIER multi-tag + auto-assign.
 *
 * Beta finding §5: hybrid leads (e.g. a hotel-bar) only carried ONE
 * sub-niche slug, which forced the opener / package selector / mockup
 * picker to choose between two equally-valid pitches. The classifier
 * now writes:
 *   - `subNicheSlug` — the highest-confidence pick (unchanged)
 *   - `subNicheSlugs[]` — primary + up to 2 alternatives that
 *     cleared the 0.4 confidence floor
 *   - `subNicheAlternatives` — JSON array of {slug, confidence,
 *     reason} for the lead-detail picker
 *
 * Plus the Phase 2.3 fine-dining auto-assign path: when the rule
 * pass + Gemini both fail to confidently pick a child but the lead's
 * Place stats look like fine dining (rating ≥ 4.5 + reviews ≥ 200 +
 * priceLevel ≥ 3), promote to `fnb-fine-dining` at confidence 0.85.
 *
 * Both surfaces are persisted in `persistResult` via a single
 * `prisma.lead.update`, which we assert below.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentWorkerContext } from "@/lib/agent-workers/types";

const { prismaMock, geminiSpy } = vi.hoisted(() => ({
  prismaMock: {
    lead: {
      update: vi.fn().mockResolvedValue({}),
    },
  },
  geminiSpy: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Disable Gemini fallback for these tests by removing the API key —
// the worker's `classifyWithGemini` path returns null on missing key,
// which is exactly the "Gemini unavailable" branch we want to exercise
// for the rule-weak / auto-assign tests. Tests that NEED Gemini opt
// in by mocking the key + the SDK below.
vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn(function () {
    return {
      getGenerativeModel: () => ({ generateContent: geminiSpy }),
    };
  }),
  SchemaType: {
    OBJECT: "OBJECT",
    STRING: "STRING",
    NUMBER: "NUMBER",
    BOOLEAN: "BOOLEAN",
    ARRAY: "ARRAY",
  },
}));

import { run } from "@/lib/agent-workers/subvertical-classifier";

interface CtxOverrides {
  businessName?: string;
  primaryType?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  priceLevel?: number | null;
  formattedAddress?: string | null;
  subNicheSource?: "MANUAL" | "AUTO" | null;
}

function makeFnbCtx(overrides: CtxOverrides = {}): AgentWorkerContext {
  return {
    runId: "run_1",
    workspaceId: "ws_1",
    workspacePlan: "PRO",
    leadId: "lead_1",
    userId: null,
    lead: {
      id: "lead_1",
      workspaceId: "ws_1",
      businessName: overrides.businessName ?? "Pied à Terre",
      formattedAddress: overrides.formattedAddress ?? "34 Charlotte St, London W1T 2NH, UK",
      borough: "Fitzrovia",
      phone: null,
      websiteUrl: null,
      hasWebsite: false,
      googleMapsUri: null,
      rating: overrides.rating ?? null,
      reviewCount: overrides.reviewCount ?? null,
      businessStatus: "OPERATIONAL",
      primaryType: overrides.primaryType ?? null,
      priceLevel: overrides.priceLevel ?? null,
      sourceQuery: null,
      sourceLat: null,
      sourceLng: null,
      crawlStatus: "CRAWLED",
      analyzeStatus: "ANALYZED",
      reviewAnalysisStatus: "ANALYZED",
      nicheSlug: "fnb",
      subNicheSlug: null,
      subNicheSource: overrides.subNicheSource ?? null,
      subNicheConfidence: null,
      subNicheVersion: 0,
      subNicheSlugs: [],
      subNicheAlternatives: [],
      discoverySourceQuery: null,
      websiteAudit: null,
      salesOpportunity: null,
      reviewAnalysis: null,
    } as never,
    workspace: {
      id: "ws_1",
      name: "Test WS",
      slug: "test-ws",
      plan: "PRO",
      language: "en",
      niche: "RESTAURANT_TECH",
    } as never,
    memory: [],
    plannerSessionId: null,
    emit: vi.fn().mockResolvedValue(undefined),
  };
}

beforeEach(async () => {
  // Disable Gemini for the auto-assign / rule-weak tests by removing
  // every numbered slot. Tests that need Gemini will set them back.
  delete process.env.GEMINI_API_KEY;
  for (let i = 1; i <= 8; i++) delete process.env[`GEMINI_API_KEY_${i}`];
  const { _resetGeminiKeysForTests } = await import("@/lib/gemini-keys");
  _resetGeminiKeysForTests();
  prismaMock.lead.update.mockReset().mockResolvedValue({});
  geminiSpy.mockReset();
});

describe("Phase 2.2 — multi-tag persistence", () => {
  it("a hybrid bar-restaurant writes BOTH subNicheSlug and subNicheSlugs[] including the primary", async () => {
    // Strong bar signal (name + place type) so rule classifier hits
    // fnb-bar-club; expect at least the primary in the slugs array.
    await run(
      makeFnbCtx({
        businessName: "The Lobby Cocktail Bar",
        primaryType: "bar",
      }),
    );

    expect(prismaMock.lead.update).toHaveBeenCalledTimes(1);
    const args = prismaMock.lead.update.mock.calls[0][0];
    expect(args.where).toEqual({ id: "lead_1" });
    expect(args.data.subNicheSlug).toBe("fnb-bar-club");
    // subNicheSlugs is wrapped in a Prisma `set` directive
    expect(args.data.subNicheSlugs).toEqual(
      expect.objectContaining({
        set: expect.arrayContaining(["fnb-bar-club"]),
      }),
    );
    // The primary MUST be the first entry so downstream consumers can
    // assume slugs[0] === primary when one exists.
    expect(args.data.subNicheSlugs.set[0]).toBe("fnb-bar-club");
  });

  it("subNicheAlternatives is an array (defaults to [] when no runners-up clear the floor)", async () => {
    // A clean fast-food primaryType produces a single high-confidence
    // pick (fnb-qsr) with no nearby runner-up.
    await run(
      makeFnbCtx({
        businessName: "Burger Express Camden",
        primaryType: "fast_food_restaurant",
        priceLevel: 1,
      }),
    );

    const args = prismaMock.lead.update.mock.calls[0][0];
    expect(args.data.subNicheSlug).toBe("fnb-qsr");
    expect(Array.isArray(args.data.subNicheAlternatives)).toBe(true);
  });

  it("self-skips when subNicheSource is MANUAL (rep override is gold-standard)", async () => {
    const result = await run(
      makeFnbCtx({
        businessName: "Anything Goes",
        subNicheSource: "MANUAL",
      }),
    );
    const out = result.output as { skipped?: boolean; reason?: string };
    expect(out.skipped).toBe(true);
    expect(out.reason).toBe("manual-locked");
    expect(prismaMock.lead.update).not.toHaveBeenCalled();
  });
});

describe("Phase 2.3 — fine-dining auto-assign in classifier", () => {
  it("Pied à Terre's Place stats route to fnb-fine-dining via the expanded type matcher", async () => {
    // Beta finding §5: french_restaurant is the cuisine subtype now
    // claimed by fnb-fine-dining (via the Phase 2.3 type expansion).
    // Combined with priceLevel=4 (in fine-dining's range), the rule
    // pass scores fine-dining higher than any sibling — no need to
    // fall through to the auto-assign rule for this case. We use a
    // generic-sounding business name to avoid triggering keyword
    // matches on casual-dining ("tavern", "bistro" etc.).
    await run(
      makeFnbCtx({
        businessName: "Charlotte Street Restaurant",
        primaryType: "french_restaurant",
        rating: 4.7,
        reviewCount: 250,
        priceLevel: 4,
      }),
    );

    const args = prismaMock.lead.update.mock.calls[0][0];
    expect(args.data.subNicheSlug).toBe("fnb-fine-dining");
    expect(args.data.subNicheConfidence).toBeGreaterThanOrEqual(0.5);
  });

  it("auto-assign rule kicks in when no rule fires at all (generic primaryType)", async () => {
    // Use a primaryType that no fine-dining rule claims AND a generic
    // name. The rule pass should produce no winner that clears the
    // 0.5 floor; Gemini is mocked unavailable; the floorless
    // `rankAllChildren` returns 0 hits — so the auto-assign rule
    // promotes us at 0.85. (`food` is not in any niche pack's
    // googlePlacesTypes list.)
    await run(
      makeFnbCtx({
        businessName: "Kitchen 34",
        primaryType: "food",
        rating: 4.8,
        reviewCount: 300,
        priceLevel: 4,
      }),
    );

    const args = prismaMock.lead.update.mock.calls[0][0];
    // Either the auto-assign rule fires (slug=fnb-fine-dining,
    // confidence=0.85) OR — if a stray rule still picked something
    // weak — the auto-assign should still beat it because we only
    // accept the rule-weak path when no auto-assign result exists or
    // the rule is more confident than 0.85. So fine-dining is the
    // expected slug here.
    expect(args.data.subNicheSlug).toBe("fnb-fine-dining");
    expect(args.data.subNicheConfidence).toBe(0.85);
  });

  it("a restaurant with low review count does NOT trigger auto-assign", async () => {
    // Low-evidence guard: 50 reviews is too thin to claim fine dining.
    // Falls through to either rule-weak (if any rule fired) or
    // rule-default (slug = null). Either way it must NOT be
    // fnb-fine-dining at high confidence.
    await run(
      makeFnbCtx({
        businessName: "Generic Restaurant",
        primaryType: "restaurant",
        rating: 4.9,
        reviewCount: 50,
        priceLevel: 4,
      }),
    );

    const args = prismaMock.lead.update.mock.calls[0][0];
    if (args.data.subNicheSlug === "fnb-fine-dining") {
      // If somehow promoted, confidence must be the real auto-assign
      // value (0.85). It shouldn't be 0.85 here because the threshold
      // wasn't met — the most this should be is a clamped weak rule.
      expect(args.data.subNicheConfidence).toBeLessThan(0.85);
    }
  });
});
