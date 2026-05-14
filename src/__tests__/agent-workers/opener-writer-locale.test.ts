/**
 * Truth Layer T-B — opener-writer locale-gate integration tests.
 *
 * Pins:
 *   1. The Greenwich Morning fixture (TR workspace + GB lead) drives
 *      `localeResolution.resolved === "en-GB"` per master plan §2.6 +
 *      Open Decision §10.1.
 *   2. When `TRUTH_LAYER_LOCALE_GATE` is ON the Gemini prompt:
 *        - Contains the resolved BCP-47 tag (`en-GB`).
 *        - Contains the explicit `LANGUAGE:` directive built by
 *          `buildLocaleInstruction`.
 *        - Switches the workspace-language branch off Turkish even
 *          though the workspace is configured `language: "tr"` —
 *          the lead-country override wins.
 *   3. When `TRUTH_LAYER_LOCALE_GATE` is OFF the worker still records
 *      the resolution on the output (shadow-run telemetry) but the
 *      prompt body matches the pre-Truth-Layer baseline — no
 *      `LANGUAGE:` directive, Turkish header back in place.
 *
 * The pure-resolver unit cases live in
 * `src/__tests__/locale/lead-locale.test.ts`; this file is scoped to
 * the worker integration surface (prompt injection + output shape).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadLeadFixture } from "../../../tests/fixtures/load-lead-fixture";
import type { AgentWorkerContext } from "@/lib/agent-workers/types";

const { generateContentSpy, memoryQueryMock, memoryUnionMock } = vi.hoisted(() => ({
  generateContentSpy: vi.fn(),
  memoryQueryMock: vi.fn(),
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
  query: memoryQueryMock,
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
    agentRun: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    servicePackage: {
      findFirst: vi.fn().mockResolvedValue(null),
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

/**
 * Build an `AgentWorkerContext` whose `lead` + `workspace` slices
 * mirror the Greenwich Morning fixture exactly enough for the
 * opener-writer to run. The fixture is the canonical TR-workspace +
 * GB-lead case the master plan calls out as the T-B regression case.
 */
function makeGreenwichCtx(
  overrides: Partial<AgentWorkerContext> = {},
): AgentWorkerContext {
  const fx = loadLeadFixture("greenwich-morning");
  return {
    runId: "run_locale_1",
    workspaceId: fx.workspace.id,
    workspacePlan: "PRO",
    leadId: fx.lead.id,
    userId: "user_1",
    lead: {
      id: fx.lead.id,
      workspaceId: fx.workspace.id,
      businessName: fx.lead.businessName,
      formattedAddress: fx.lead.formattedAddress,
      googleMapsUri: fx.lead.googleMapsUri,
      primaryType: fx.lead.primaryType,
      websiteUrl: fx.lead.websiteUrl,
      websiteAudit: null,
      salesOpportunity: {
        leadId: fx.lead.id,
        opportunityScore: 60,
        reasonCodes: [],
        bestSalesAngle: "Speed up brunch service",
        likelyPainPoints: fx.reviewAnalysis.painPhrases,
        personalizedFirstMessage: null,
      } as never,
      reviewAnalysis: null,
      placeId: fx.lead.placeId,
      borough: fx.lead.borough,
      phone: fx.lead.phone,
      hasWebsite: fx.lead.hasWebsite,
      rating: fx.lead.rating,
      reviewCount: fx.lead.reviewCount,
      businessStatus: fx.lead.businessStatus,
      sourceQuery: null,
      sourceLat: null,
      sourceLng: null,
      crawlStatus: "NO_WEBSITE",
      analyzeStatus: "ANALYZED",
      reviewAnalysisStatus: "ANALYZED",
      nicheSlug: fx.lead.nicheSlug,
      subNicheSlug: fx.lead.subNicheSlug,
      subNicheSource: null,
      subNicheConfidence: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never,
    workspace: {
      id: fx.workspace.id,
      name: fx.workspace.name,
      slug: "test-tr",
      plan: "PRO",
      // Fixture pins `defaultLocale: "tr-TR"` and `language` defaults
      // to "tr" for the TR workspace — `workspaceDefaultLocaleFromLanguage`
      // projects "tr" → "tr-TR" so the resolver sees the right shape
      // even though `ctx.workspace` doesn't expose `defaultLocale`.
      language: "tr",
      tone: null,
      offerName: "F&B Reservations Pack",
      valueProposition: "Cut brunch wait time",
      offerHook: "Free 5-min audit",
      objective: null,
      senderName: "Sam",
      conversionLink: "https://leadac.ai/demo",
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
  memoryQueryMock.mockReset().mockResolvedValue([]);
  memoryUnionMock.mockReset().mockResolvedValue([]);
  prismaMock.salesOpportunity.update.mockReset().mockResolvedValue({});
  prismaMock.salesOpportunity.findUnique.mockReset().mockResolvedValue(null);
  prismaMock.websiteMockup.findFirst.mockReset().mockResolvedValue(null);
  prismaMock.agentRun.findFirst.mockReset().mockResolvedValue(null);
  prismaMock.servicePackage.findFirst.mockReset().mockResolvedValue(null);
});

describe("OPENER_WRITER — Truth Layer T-B locale gate (ON)", () => {
  beforeEach(() => {
    process.env.TRUTH_LAYER_LOCALE_GATE = "on";
    delete process.env.TRUTH_LAYER_LOCALE_GATE_WORKSPACES;
  });

  it("Greenwich Morning fixture: TR workspace + GB lead → output.localeResolution.resolved === 'en-GB'", async () => {
    generateContentSpy.mockResolvedValue(textResponse("Hi there..."));

    const result = await run(makeGreenwichCtx());
    const out = result.output as {
      localeResolution: {
        resolved: string;
        source: string;
        reasoning: string;
      };
      localeGateEnabled: boolean;
    };
    expect(out.localeResolution).toBeDefined();
    expect(out.localeResolution.resolved).toBe("en-GB");
    expect(out.localeResolution.source).toBe("lead_country_dominant");
    expect(out.localeGateEnabled).toBe(true);
  });

  it("Greenwich Morning fixture: prompt body contains the resolved BCP-47 tag + LANGUAGE directive", async () => {
    generateContentSpy.mockResolvedValue(textResponse("Hi there..."));

    await run(makeGreenwichCtx());

    expect(generateContentSpy).toHaveBeenCalledTimes(1);
    const prompt = generateContentSpy.mock.calls[0][0] as string;
    expect(prompt).toContain("en-GB");
    expect(prompt).toContain("British English");
    expect(prompt).toMatch(/^LANGUAGE: .+en-GB/m);
  });

  it("Greenwich Morning fixture: TR workspace `language: 'tr'` does NOT keep the Turkish header (lead-country override wins)", async () => {
    generateContentSpy.mockResolvedValue(textResponse("Hi there..."));

    await run(makeGreenwichCtx());

    const prompt = generateContentSpy.mock.calls[0][0] as string;
    // Turkish header phrase from `buildOpenerPrompt` legacy branch.
    expect(prompt).not.toContain("Turkce ve kisisel bir cold-email");
    // English header MUST be present even though the workspace is
    // configured `language: "tr"` — the lead-country override
    // flipped the prompt branch.
    expect(prompt).toContain(
      "experienced agency SDR writing a personalized cold-email opener",
    );
  });
});

describe("OPENER_WRITER — Truth Layer T-B locale gate (OFF)", () => {
  beforeEach(() => {
    process.env.TRUTH_LAYER_LOCALE_GATE = "off";
    delete process.env.TRUTH_LAYER_LOCALE_GATE_WORKSPACES;
  });

  it("shadow-run: localeResolution still recorded on output", async () => {
    generateContentSpy.mockResolvedValue(textResponse("Selam..."));

    const result = await run(makeGreenwichCtx());
    const out = result.output as {
      localeResolution: { resolved: string; source: string };
      localeGateEnabled: boolean;
    };
    expect(out.localeResolution.resolved).toBe("en-GB");
    expect(out.localeResolution.source).toBe("lead_country_dominant");
    expect(out.localeGateEnabled).toBe(false);
  });

  it("shadow-run: LANGUAGE directive is NOT injected into the prompt; legacy workspace-language branch wins", async () => {
    generateContentSpy.mockResolvedValue(textResponse("Selam..."));

    await run(makeGreenwichCtx());

    const prompt = generateContentSpy.mock.calls[0][0] as string;
    expect(prompt).not.toMatch(/^LANGUAGE: /m);
    // `workspace.language === "tr"` → Turkish header back in place.
    expect(prompt).toContain("Turkce ve kisisel bir cold-email");
  });
});
