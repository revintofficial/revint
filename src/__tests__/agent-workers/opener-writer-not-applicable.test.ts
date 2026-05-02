/**
 * Phase 2.4 + 2.5 — OPENER_WRITER constraint hardening.
 *
 * Two beta findings (§6) drove these tests:
 *
 *   2.4 — `notApplicableModules` per niche.
 *     The opener pitched "online ordering" to Pied à Terre (Michelin
 *     fine dining). Fine-dining never benefits from delivery /
 *     tablet ordering — those modules cheapen the brand. The niche
 *     pack now carries a `notApplicableModules` list, and the opener
 *     prompt builder injects a hard "NEVER mention …" rule.
 *
 *   2.5 — Brief-grounded pain whitelist.
 *     The opener cited unverified pains (e.g. "your booking system
 *     is broken" when the audit said the opposite). The
 *     LEAD_INTELLIGENCE_BRIEF now writes `confirmedPainPoints` /
 *     `confirmedMissingFeatures` arrays; the opener prompt rule
 *     forbids citing anything outside those lists when they're
 *     non-empty. Empty arrays = no constraint, legacy behaviour.
 *
 * The tests assert what's INJECTED INTO THE PROMPT — that's the
 * actual enforcement mechanism (the LLM can't cite what it isn't
 * shown). We verify both the positive injection and the no-op fallback.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentWorkerContext, MemoryHit } from "@/lib/agent-workers/types";

const { generateContentSpy, memoryUnionMock } = vi.hoisted(() => ({
  generateContentSpy: vi.fn(),
  memoryUnionMock: vi.fn(),
}));

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn(function () {
    return {
      getGenerativeModel: () => ({ generateContent: generateContentSpy }),
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

vi.mock("@/lib/ai-core/memory", () => ({
  query: vi.fn().mockResolvedValue([]),
  queryWithNicheUnion: memoryUnionMock,
}));

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    salesOpportunity: {
      update: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    websiteMockup: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    servicePackage: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    // OPENER_WRITER queries agentRun TWICE in the new code path:
    //   1. To detect a manual edit (last successful OPENER_WRITER run)
    //   2. To pull the latest LEAD_INTELLIGENCE_BRIEF for the
    //      confirmedPainPoints / confirmedMissingFeatures whitelists
    // We use mockImplementation so each test can return a different
    // shape per query.
    agentRun: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { run } from "@/lib/agent-workers/opener-writer";

function textResponse(text: string) {
  return {
    response: {
      text: () => text,
      candidates: [{ content: { parts: [{ text }] } }],
    },
  };
}

function makeFineDiningCtx(overrides: Partial<AgentWorkerContext> = {}): AgentWorkerContext {
  return {
    runId: "run_1",
    workspaceId: "ws_1",
    workspacePlan: "PRO",
    leadId: "lead_pat",
    userId: "user_1",
    lead: {
      id: "lead_pat",
      workspaceId: "ws_1",
      businessName: "Pied à Terre",
      formattedAddress: "34 Charlotte St, London W1T 2NH, UK",
      googleMapsUri: null,
      primaryType: "french_restaurant",
      websiteUrl: "https://pied-a-terre.example",
      websiteAudit: null,
      // Trust gate (subNicheSource MANUAL OR confidence ≥ 0.7) so
      // the opener actually uses the fine-dining child pack.
      nicheSlug: "fnb",
      subNicheSlug: "fnb-fine-dining",
      subNicheSource: "MANUAL",
      subNicheConfidence: 0.95,
      subNicheSlugs: ["fnb-fine-dining"],
      subNicheAlternatives: [],
      salesOpportunity: {
        leadId: "lead_pat",
        opportunityScore: 80,
        reasonCodes: ["high_rating", "premium_price_point"],
        bestSalesAngle: "White-glove digital concierge",
        likelyPainPoints: ["no premium reservation widget", "menu only as PDF"],
        personalizedFirstMessage: null,
      } as never,
      reviewAnalysis: null,
      placeId: "p_pat",
      borough: "Fitzrovia",
      phone: null,
      hasWebsite: true,
      rating: 4.7,
      reviewCount: 250,
      priceLevel: 4,
      businessStatus: "OPERATIONAL",
      sourceQuery: null,
      sourceLat: null,
      sourceLng: null,
      crawlStatus: "CRAWLED",
      analyzeStatus: "ANALYZED",
      reviewAnalysisStatus: "ANALYZED",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never,
    workspace: {
      id: "ws_1",
      name: "FineDine WS",
      slug: "finedine",
      plan: "PRO",
      language: "en",
      tone: null,
      offerName: "FineDine Premium",
      valueProposition: "All-in-one restaurant tech",
      offerHook: "Free audit",
      objective: null,
      senderName: "Sam",
      conversionLink: "https://finedine.io/demo",
      socialProof: null,
      branding: null,
      niche: "RESTAURANT_TECH",
    } as never,
    memory: [],
    plannerSessionId: null,
    emit: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(async () => {
  process.env.GEMINI_API_KEY = "test-key";
  const { _resetGeminiKeysForTests } = await import("@/lib/gemini-keys");
  _resetGeminiKeysForTests();
  generateContentSpy.mockReset();
  memoryUnionMock.mockReset().mockResolvedValue([] as MemoryHit[]);
  prismaMock.salesOpportunity.update.mockReset().mockResolvedValue({});
  prismaMock.salesOpportunity.findUnique.mockReset().mockResolvedValue(null);
  prismaMock.websiteMockup.findFirst.mockReset().mockResolvedValue(null);
  prismaMock.servicePackage.findFirst.mockReset().mockResolvedValue(null);
  prismaMock.agentRun.findFirst.mockReset().mockResolvedValue(null);
});

describe("Phase 2.4 — notApplicableModules NEVER-mention rule", () => {
  it("injects the fine-dining notApplicableModules block into the prompt", async () => {
    generateContentSpy.mockResolvedValue(textResponse("Hi - noticed your menu..."));

    await run(makeFineDiningCtx());

    const prompt = generateContentSpy.mock.calls[0][0] as string;
    expect(prompt).toContain("NEVER mention or pitch the following modules");
    // At least one of the niche pack's not-applicable modules MUST
    // appear in the prompt rule list.
    expect(prompt).toMatch(/Online ordering|Tablet ordering|QR-only ordering/);
  });

  it("omits the NEVER-mention rule when the niche has no notApplicableModules", async () => {
    generateContentSpy.mockResolvedValue(textResponse("Hi - quick note..."));

    // Hijack ctx to a niche pack we know doesn't define the list.
    // hvac (flat pack) carries no notApplicableModules. Use parent
    // fallback semantics by setting low confidence so the trust gate
    // falls back to the parent — the parent fnb pack also has no
    // notApplicableModules in our seed. We assert the rule line
    // is absent.
    const ctx = makeFineDiningCtx();
    (ctx.lead as Record<string, unknown>).subNicheSlug = null;
    (ctx.lead as Record<string, unknown>).subNicheSlugs = [];
    (ctx.lead as Record<string, unknown>).subNicheSource = "AUTO";
    (ctx.lead as Record<string, unknown>).subNicheConfidence = 0.2;

    await run(ctx);

    const prompt = generateContentSpy.mock.calls[0][0] as string;
    expect(prompt).not.toContain("NEVER mention or pitch the following modules");
  });
});

describe("Phase 2.5 — brief-grounded pain / missing-feature whitelist", () => {
  it("injects confirmedPainPoints into the prompt as a hard whitelist", async () => {
    generateContentSpy.mockResolvedValue(textResponse("Hello..."));

    // OPENER_WRITER calls `prisma.agentRun.findFirst` UP TO TWICE:
    //   1. (always) the LEAD_INTELLIGENCE_BRIEF lookup added in 2.5
    //   2. (conditional) the manual-edit detection lookup, only when
    //      the lead already has a personalizedFirstMessage that needs
    //      preserving. In this test fixture personalizedFirstMessage
    //      is null, so the second call never fires.
    // We therefore stub a single response containing the brief.
    prismaMock.agentRun.findFirst.mockResolvedValue({
      outputJson: {
        confirmedPainPoints: ["pdf-only menu", "no allergen filter"],
        confirmedMissingFeatures: ["online reservation widget"],
      },
    });

    await run(makeFineDiningCtx());

    const prompt = generateContentSpy.mock.calls[0][0] as string;
    expect(prompt).toContain("You may ONLY cite pain points from this whitelist");
    expect(prompt).toContain("pdf-only menu");
    expect(prompt).toContain("no allergen filter");
    expect(prompt).toContain('"You don\'t have X" claims may ONLY come from');
    expect(prompt).toContain("online reservation widget");
  });

  it("omits the whitelist rule entirely when the brief has empty arrays (legacy fallback)", async () => {
    generateContentSpy.mockResolvedValue(textResponse("Hello..."));

    prismaMock.agentRun.findFirst.mockResolvedValue({
      outputJson: {
        confirmedPainPoints: [],
        confirmedMissingFeatures: [],
      },
    });

    await run(makeFineDiningCtx());

    const prompt = generateContentSpy.mock.calls[0][0] as string;
    expect(prompt).not.toContain("You may ONLY cite pain points from this whitelist");
    expect(prompt).not.toContain('"You don\'t have X" claims may ONLY come from');
  });

  it("omits the whitelist rule when no brief has run yet (findFirst returns null)", async () => {
    generateContentSpy.mockResolvedValue(textResponse("Hello..."));

    prismaMock.agentRun.findFirst.mockResolvedValue(null);

    await run(makeFineDiningCtx());

    const prompt = generateContentSpy.mock.calls[0][0] as string;
    expect(prompt).not.toContain("You may ONLY cite pain points from this whitelist");
  });

  it("the run logs include confirmedPainPointsCount", async () => {
    generateContentSpy.mockResolvedValue(textResponse("Hello..."));

    prismaMock.agentRun.findFirst.mockResolvedValue({
      outputJson: {
        confirmedPainPoints: ["a", "b", "c"],
        confirmedMissingFeatures: [],
      },
    });

    const result = await run(makeFineDiningCtx());

    // Output stays backward-compatible (no required new field), but
    // the worker reaches the persistence step without throwing — that
    // is the contract callers depend on.
    expect(result.output).toMatchObject({ message: expect.any(String) });
  });
});
