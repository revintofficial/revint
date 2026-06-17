/**
 * Unit tests for OPENER_WRITER worker.
 *
 * Covers:
 *   - No OPENER_SUCCESS memory: few-shot block absent from prompt
 *   - With 3 OPENER_SUCCESS memory hits: few-shot block present + all 3 examples
 *   - Top-K=5 cap: worker queries memory with topK=5 and surfaces only
 *     what memoryQuery returns (the cap is enforced in the memory layer)
 *   - Memory hydration is done via direct memoryQuery (NOT ctx.memory),
 *     so we mock @/lib/ai-core/memory rather than populating ctx.memory
 *   - prisma.salesOpportunity.update is called with the Gemini message
 *   - Output exposes fewShotCount
 *   - Gemini returns plain text (no JSON parse happens in this worker),
 *     so there's no "malformed JSON" branch; we verify the worker stores
 *     whatever text Gemini returns as the personalizedFirstMessage.
 *
 * Divergences from spec:
 *   - opener-writer.ts does NOT read ctx.memory. It calls memoryQuery
 *     directly so it can tailor the query text to the lead's pain
 *     phrases (see src/lib/agent-workers/opener-writer.ts lines 60-74).
 *     All memory assertions mock @/lib/ai-core/memory.query.
 *   - Gemini response is consumed as raw text, never JSON-parsed; the
 *     spec's "malformed JSON" scenario does not map to a real branch in
 *     this worker.
 *   - Persistence uses prisma.salesOpportunity.update (not upsert).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentWorkerContext, MemoryHit } from "@/lib/agent-workers/types";

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
    // OPENER_WRITER reads the last-successful AgentRun for this lead
    // to detect a manual edit. Default to "no prior run" so tests
    // exercise the happy overwrite path unless they override it.
    agentRun: {
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

function hit(partial: Partial<MemoryHit> & { text: string; similarity: number }): MemoryHit {
  return {
    id: partial.id ?? `mem_${Math.random().toString(36).slice(2, 8)}`,
    kind: partial.kind ?? "OPENER_SUCCESS",
    leadId: partial.leadId ?? null,
    refType: partial.refType ?? null,
    refId: partial.refId ?? null,
    text: partial.text,
    metadata: partial.metadata ?? {},
    similarity: partial.similarity,
    createdAt: partial.createdAt ?? new Date(),
    nicheScope: partial.nicheScope ?? null,
  };
}

function makeCtx(overrides: Partial<AgentWorkerContext> = {}): AgentWorkerContext {
  return {
    runId: "run_1",
    workspaceId: "ws_1",
    workspacePlan: "PRO",
    leadId: "lead_1",
    userId: "user_1",
    lead: {
      id: "lead_1",
      workspaceId: "ws_1",
      businessName: "Acme HVAC",
      formattedAddress: "1 Main St, Brooklyn, NY",
      googleMapsUri: null,
      primaryType: "hvac_contractor",
      websiteUrl: "https://acme.example",
      websiteAudit: null,
      salesOpportunity: {
        leadId: "lead_1",
        opportunityScore: 72,
        reasonCodes: ["weak_seo", "no_booking"],
        bestSalesAngle: "Mobile-first local SEO",
        likelyPainPoints: ["slow website", "no online booking"],
        personalizedFirstMessage: null,
      } as never,
      reviewAnalysis: null,
      placeId: "p1",
      borough: "Brooklyn",
      phone: null,
      hasWebsite: true,
      rating: 4.6,
      reviewCount: 120,
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
      name: "Test WS",
      slug: "test-ws",
      plan: "PRO",
      language: "en",
      tone: null,
      offerName: "Local SEO Pack",
      valueProposition: "Get found for same-day jobs",
      offerHook: "Free audit",
      objective: null,
      senderName: "Sam",
      conversionLink: "https://revint.dev/demo",
      socialProof: null,
      branding: null,
      niche: "WEB_AGENCY",
    } as never,
    memory: [],
    plannerSessionId: null,
    emit: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(async () => {
  process.env.GEMINI_API_KEY = "test-key";
  // Beta finding §6: getGeminiKey() caches the key pool at module
  // load. Tests that delete GEMINI_API_KEY mid-suite need to flush
  // the cache so the next call re-reads env vars.
  const { _resetGeminiKeysForTests } = await import("@/lib/gemini-keys");
  _resetGeminiKeysForTests();
  generateContentSpy.mockReset();
  memoryQueryMock.mockReset().mockResolvedValue([]);
  memoryUnionMock.mockReset().mockResolvedValue([]);
  prismaMock.salesOpportunity.update.mockReset().mockResolvedValue({});
  prismaMock.websiteMockup.findFirst.mockReset().mockResolvedValue(null);
});

describe("OPENER_WRITER - few-shot block gating", () => {
  it("omits the few-shot header when no OPENER_SUCCESS memory is available", async () => {
    memoryUnionMock.mockResolvedValue([]);
    generateContentSpy.mockResolvedValue(textResponse("Hi - noticed your shop..."));

    const result = await run(makeCtx());

    expect(generateContentSpy).toHaveBeenCalledTimes(1);
    const prompt = generateContentSpy.mock.calls[0][0] as string;
    expect(prompt).not.toContain("Past openers from this workspace that got replies");
    expect(prompt).not.toContain("gecmiste cevap almis opener ornekleri");
    expect(prompt).not.toMatch(/--- 1$/m);

    const out = result.output as { message: string; fewShotCount: number };
    expect(out.fewShotCount).toBe(0);
    expect(out.message).toBe("Hi - noticed your shop...");
  });

  it("includes the few-shot header and all 3 examples when 3 OPENER_SUCCESS hits are returned", async () => {
    memoryUnionMock.mockResolvedValue([
      hit({ text: "Example opener one about booking.", similarity: 0.92 }),
      hit({ text: "Example opener two about mobile speed.", similarity: 0.88 }),
      hit({ text: "Example opener three about reviews.", similarity: 0.81 }),
    ]);
    generateContentSpy.mockResolvedValue(textResponse("Hey - quick note..."));

    const result = await run(makeCtx());
    const prompt = generateContentSpy.mock.calls[0][0] as string;

    expect(prompt).toContain("Past openers from this workspace that got replies");
    expect(prompt).toContain("Example opener one about booking.");
    expect(prompt).toContain("Example opener two about mobile speed.");
    expect(prompt).toContain("Example opener three about reviews.");
    expect(prompt).toContain("--- 1");
    expect(prompt).toContain("--- 2");
    expect(prompt).toContain("--- 3");

    const out = result.output as { fewShotCount: number };
    expect(out.fewShotCount).toBe(3);
  });
});

describe("OPENER_WRITER - memory retrieval contract", () => {
  it("queries memory with topK=5 and OPENER_SUCCESS kind so the DB layer enforces the cap", async () => {
    memoryUnionMock.mockResolvedValue([]);
    generateContentSpy.mockResolvedValue(textResponse("ok"));

    await run(makeCtx());

    expect(memoryUnionMock).toHaveBeenCalledTimes(1);
    const args = memoryUnionMock.mock.calls[0][0];
    expect(args).toMatchObject({
      workspaceId: "ws_1",
      kinds: ["OPENER_SUCCESS"],
      topK: 5,
      // Niche union: parent fallback when lead has no sub-niche set.
      // childSlug=null + parentSlug=null because the test ctx does not
      // configure a workspace niche; weighted union still works.
      childSlug: null,
      parentWeight: 0.5,
    });
    expect(typeof args.text).toBe("string");
    expect(args.text.length).toBeGreaterThan(0);
  });

  it("top-K=5 cap: when memoryQuery returns 5 hits, all 5 (and only 5) examples appear in the prompt", async () => {
    // Memory layer caps at topK=5; we emulate that here by returning the
    // 5 highest-similarity entries the store would have produced from a
    // larger superset. The worker itself does not re-sort or trim.
    const top5 = [
      hit({ text: "PROMPT_EXAMPLE_1 winning opener", similarity: 0.95 }),
      hit({ text: "PROMPT_EXAMPLE_2 winning opener", similarity: 0.93 }),
      hit({ text: "PROMPT_EXAMPLE_3 winning opener", similarity: 0.91 }),
      hit({ text: "PROMPT_EXAMPLE_4 winning opener", similarity: 0.87 }),
      hit({ text: "PROMPT_EXAMPLE_5 winning opener", similarity: 0.84 }),
    ];
    const droppedByMemory = [
      hit({ text: "SHOULD_NOT_APPEAR_6", similarity: 0.72 }),
      hit({ text: "SHOULD_NOT_APPEAR_7", similarity: 0.65 }),
    ];
    memoryUnionMock.mockResolvedValue(top5);
    generateContentSpy.mockResolvedValue(textResponse("x"));

    const result = await run(makeCtx());
    const prompt = generateContentSpy.mock.calls[0][0] as string;

    for (const h of top5) expect(prompt).toContain(h.text);
    for (const h of droppedByMemory) expect(prompt).not.toContain(h.text);
    expect(prompt).toContain("--- 5");
    expect(prompt).not.toContain("--- 6");

    const out = result.output as { fewShotCount: number };
    expect(out.fewShotCount).toBe(5);
  });
});

describe("OPENER_WRITER - persistence and output", () => {
  it("persists the Gemini message to SalesOpportunity.personalizedFirstMessage", async () => {
    memoryUnionMock.mockResolvedValue([]);
    generateContentSpy.mockResolvedValue(textResponse("Hey Acme - saw your 4.6 rating..."));

    await run(makeCtx());

    expect(prismaMock.salesOpportunity.update).toHaveBeenCalledTimes(1);
    const args = prismaMock.salesOpportunity.update.mock.calls[0][0];
    expect(args).toMatchObject({
      where: { leadId: "lead_1" },
      data: { personalizedFirstMessage: "Hey Acme - saw your 4.6 rating..." },
    });
  });

  it("trims surrounding whitespace from the Gemini reply before persisting", async () => {
    memoryUnionMock.mockResolvedValue([]);
    generateContentSpy.mockResolvedValue(textResponse("   Hi Acme   \n"));

    const result = await run(makeCtx());
    const out = result.output as { message: string };
    expect(out.message).toBe("Hi Acme");
    const args = prismaMock.salesOpportunity.update.mock.calls[0][0];
    expect(args.data.personalizedFirstMessage).toBe("Hi Acme");
  });

  it("returns empty message when Gemini returns an empty string (no JSON parsing in this worker)", async () => {
    // The worker consumes result.response.text() directly; it never
    // parses JSON. So a whitespace-only response is stored as "" rather
    // than throwing - this is the actual code path.
    memoryUnionMock.mockResolvedValue([]);
    generateContentSpy.mockResolvedValue(textResponse("   "));

    const result = await run(makeCtx());
    const out = result.output as { message: string };
    expect(out.message).toBe("");
    expect(prismaMock.salesOpportunity.update).toHaveBeenCalledTimes(1);
  });

  it("throws when GEMINI_API_KEY is missing", async () => {
    delete process.env.GEMINI_API_KEY;
    // Beta finding §6: also clear the numbered slots in case the
    // dev env has them set; otherwise the pool still returns one.
    for (let i = 1; i <= 8; i++) delete process.env[`GEMINI_API_KEY_${i}`];
    const { _resetGeminiKeysForTests } = await import("@/lib/gemini-keys");
    _resetGeminiKeysForTests();
    memoryUnionMock.mockResolvedValue([]);
    generateContentSpy.mockResolvedValue(textResponse("x"));
    await expect(run(makeCtx())).rejects.toThrow(/GEMINI_API_KEY/);
  });
});

describe("OPENER_WRITER - sub-niche confidence gate", () => {
  it("uses the child sub-niche pack when subNicheSource is MANUAL (skips confidence check)", async () => {
    memoryUnionMock.mockResolvedValue([]);
    generateContentSpy.mockResolvedValue(textResponse("ok"));

    const baseCtx = makeCtx();
    await run(
      makeCtx({
        lead: {
          ...(baseCtx.lead as Record<string, unknown>),
          nicheSlug: "fnb",
          subNicheSlug: "fnb-bar-club",
          subNicheSource: "MANUAL",
          subNicheConfidence: 0.3,
        } as never,
        workspace: {
          ...baseCtx.workspace,
          niche: "RESTAURANT_TECH",
        } as never,
      }),
    );

    const args = memoryUnionMock.mock.calls[0][0];
    expect(args.childSlug).toBe("fnb-bar-club");
    expect(args.parentSlug).toBe("fnb");

    const prompt = generateContentSpy.mock.calls[0][0] as string;
    expect(prompt).toContain("Bars & nightclubs");
  });

  it("falls back to the parent pack when subNicheSource is AUTO and confidence < 0.7", async () => {
    memoryUnionMock.mockResolvedValue([]);
    generateContentSpy.mockResolvedValue(textResponse("ok"));

    const baseCtx = makeCtx();
    await run(
      makeCtx({
        lead: {
          ...(baseCtx.lead as Record<string, unknown>),
          nicheSlug: "fnb",
          subNicheSlug: "fnb-bar-club",
          subNicheSource: "AUTO",
          subNicheConfidence: 0.55,
        } as never,
        workspace: {
          ...baseCtx.workspace,
          niche: "RESTAURANT_TECH",
        } as never,
      }),
    );

    const args = memoryUnionMock.mock.calls[0][0];
    expect(args.childSlug).toBeNull();
    expect(args.parentSlug).toBe("fnb");

    const prompt = generateContentSpy.mock.calls[0][0] as string;
    expect(prompt).toContain("sub-vertical not yet confirmed");
    // Bar-specific featured modules MUST NOT leak into the prompt at
    // low confidence — that would create the wrong-vertical email the
    // confidence gate is designed to prevent.
    expect(prompt).not.toContain("Relevant product modules");
  });
});
