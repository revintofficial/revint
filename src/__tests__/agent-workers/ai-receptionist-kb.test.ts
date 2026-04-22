/**
 * Unit tests for AI_RECEPTIONIST_BUILDER worker (file:
 * src/lib/agent-workers/ai-receptionist.ts, referred to as
 * "ai-receptionist-kb" in the spec because of its PROSPECT_KB_CHUNK
 * memory consumption).
 *
 * Covers:
 *   - Without PROSPECT_KB_CHUNK memory: prompt does NOT include the
 *     "KNOWLEDGE BASE" section and output.knowledge_base is an empty
 *     array. (The worker does NOT synthesize fallback chunks at run
 *     time - that fallback only exists inside `toKnowledgeBaseJson`
 *     export-side. We assert actual worker behavior.)
 *   - With 3 PROSPECT_KB_CHUNK hits: prompt DOES include "KNOWLEDGE
 *     BASE", all 3 chunks appear in the prompt, and
 *     output.knowledge_base contains 3 entries mirroring the memory.
 *   - knowledge_base output field is present (as an array) in both
 *     branches.
 *   - Malformed Gemini response: parseReceptionistJson throws
 *     "AI Receptionist prompt returned malformed JSON" when the text
 *     contains no recoverable JSON object.
 *
 * Divergences from spec:
 *   - The spec said the worker "synthesizes chunks from lead fields"
 *     when memory is empty. It doesn't - the synthesized KB only
 *     appears in the `kb_json` exporter (toKnowledgeBaseJson). The
 *     run-time output's knowledge_base is [] in that case.
 *   - The spec referenced `kb_json` as an output field; the actual
 *     worker puts the chunks under `knowledge_base` on the artifact.
 *     The `kb_json` name is the export format key, not a field name.
 *   - Gemini returns JSON directly; malformed responses raise a
 *     typed error from parseReceptionistJson rather than returning
 *     a graceful fallback.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentWorkerContext, MemoryHit } from "@/lib/agent-workers/types";

const { generateContentSpy } = vi.hoisted(() => ({
  generateContentSpy: vi.fn(),
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

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    websiteMockup: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { run } from "@/lib/agent-workers/ai-receptionist";

function jsonResponse(payload: Record<string, unknown>) {
  const text = JSON.stringify(payload);
  return {
    response: {
      text: () => text,
      candidates: [{ content: { parts: [{ text }] } }],
    },
  };
}

function rawResponse(text: string) {
  return {
    response: {
      text: () => text,
      candidates: [{ content: { parts: [{ text }] } }],
    },
  };
}

function validReceptionistPayload(overrides: Record<string, unknown> = {}) {
  return {
    agent: { name: "Sam", voice_hint: "warm, professional", language: "en" },
    greeting: {
      initial: "Hi, you've reached Acme HVAC.",
      followup: "How can I help?",
    },
    business_summary: "Brooklyn HVAC shop.",
    hours_policy: {
      statement: "Mon-Fri 8-6",
      after_hours_line: "Please leave a message.",
    },
    faqs: [{ question: "What are your hours?", answer: "Mon-Fri 8-6." }],
    services: [{ name: "Repair", short_description: "Same-day AC repair." }],
    intake_flow: {
      steps: [{ label: "name", prompt: "What is your name?", required: true }],
    },
    booking_flow: {
      enabled: true,
      calendar_prompt: "When works best?",
      handoff_rule: "emergency -> human",
    },
    escalation_rules: [{ trigger: "emergency", action: "transfer" }],
    voicemail_fallback: "Please leave a message.",
    guardrails: ["never quote a price"],
    ...overrides,
  };
}

function makeHit(partial: Partial<MemoryHit> & { text: string }): MemoryHit {
  return {
    id: partial.id ?? `mem_${Math.random().toString(36).slice(2, 8)}`,
    kind: partial.kind ?? "PROSPECT_KB_CHUNK",
    leadId: partial.leadId ?? "lead_1",
    refType: partial.refType ?? "kb_chunk",
    refId: partial.refId ?? null,
    text: partial.text,
    metadata: partial.metadata ?? { url: "https://acme.example/services" },
    similarity: partial.similarity ?? 0.8,
    createdAt: partial.createdAt ?? new Date(),
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
      borough: "Brooklyn",
      phone: "+15551234567",
      websiteUrl: "https://acme.example",
      hasWebsite: true,
      googleMapsUri: null,
      rating: 4.6,
      reviewCount: 127,
      businessStatus: "OPERATIONAL",
      primaryType: "hvac_contractor",
      sourceQuery: null,
      sourceLat: null,
      sourceLng: null,
      placeId: "p1",
      crawlStatus: "CRAWLED",
      analyzeStatus: "ANALYZED",
      reviewAnalysisStatus: "ANALYZED",
      createdAt: new Date(),
      updatedAt: new Date(),
      websiteAudit: {
        servicesDetected: ["repair", "installation"],
      } as never,
      reviewAnalysis: {
        painPhrases: ["slow response"],
        strengthPhrases: ["friendly"],
      } as never,
      salesOpportunity: null,
    } as never,
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
    },
    memory: [],
    plannerSessionId: null,
    emit: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  process.env.GEMINI_API_KEY = "test-key";
  generateContentSpy.mockReset();
  prismaMock.websiteMockup.findFirst.mockReset().mockResolvedValue(null);
});

describe("AI_RECEPTIONIST_BUILDER - without PROSPECT_KB_CHUNK memory", () => {
  it("omits the KNOWLEDGE BASE section from the prompt", async () => {
    generateContentSpy.mockResolvedValue(jsonResponse(validReceptionistPayload()));

    await run(makeCtx());

    expect(generateContentSpy).toHaveBeenCalledTimes(1);
    const prompt = generateContentSpy.mock.calls[0][0] as string;
    expect(prompt).not.toContain("KNOWLEDGE BASE");
    expect(prompt).not.toContain("### Chunk 1");
    // But the base prompt should still reference the business so the
    // worker is actually prompting for THIS lead.
    expect(prompt).toContain("Acme HVAC");
  });

  it("output.knowledge_base is an empty array (worker does NOT synthesize fallback chunks at run time)", async () => {
    generateContentSpy.mockResolvedValue(jsonResponse(validReceptionistPayload()));

    const result = await run(makeCtx());
    const artifact = result.output as { knowledge_base: unknown[] };
    expect(Array.isArray(artifact.knowledge_base)).toBe(true);
    expect(artifact.knowledge_base).toEqual([]);
  });
});

describe("AI_RECEPTIONIST_BUILDER - with 3 PROSPECT_KB_CHUNK memory hits", () => {
  const kbHits = [
    makeHit({
      id: "kb_1",
      text: "KB_CHUNK_ONE - About Acme HVAC: family-owned since 1998.",
      metadata: { url: "https://acme.example/about", title: "About" },
    }),
    makeHit({
      id: "kb_2",
      text: "KB_CHUNK_TWO - Services: installation, repair, maintenance.",
      metadata: { url: "https://acme.example/services", title: "Services" },
    }),
    makeHit({
      id: "kb_3",
      text: "KB_CHUNK_THREE - Service area: Brooklyn, Queens.",
      metadata: { url: "https://acme.example/areas", title: "Areas" },
    }),
  ];

  it("prompt includes the KNOWLEDGE BASE header and all 3 chunks", async () => {
    generateContentSpy.mockResolvedValue(jsonResponse(validReceptionistPayload()));

    await run(makeCtx({ memory: kbHits }));

    const prompt = generateContentSpy.mock.calls[0][0] as string;
    expect(prompt).toContain("KNOWLEDGE BASE");
    expect(prompt).toContain("### Chunk 1");
    expect(prompt).toContain("### Chunk 2");
    expect(prompt).toContain("### Chunk 3");
    expect(prompt).toContain("KB_CHUNK_ONE");
    expect(prompt).toContain("KB_CHUNK_TWO");
    expect(prompt).toContain("KB_CHUNK_THREE");
  });

  it("output.knowledge_base mirrors the 3 memory hits with id + text + metadata", async () => {
    generateContentSpy.mockResolvedValue(jsonResponse(validReceptionistPayload()));

    const result = await run(makeCtx({ memory: kbHits }));
    const artifact = result.output as {
      knowledge_base: Array<{ chunk_id: string; text: string; metadata: Record<string, unknown> }>;
    };

    expect(artifact.knowledge_base).toHaveLength(3);
    expect(artifact.knowledge_base[0].chunk_id).toBe("kb_1");
    expect(artifact.knowledge_base[0].text).toContain("KB_CHUNK_ONE");
    expect(artifact.knowledge_base[0].metadata.url).toBe("https://acme.example/about");
    expect(artifact.knowledge_base[0].metadata.title).toBe("About");
    expect(artifact.knowledge_base[0].metadata.chunkIndex).toBe(0);
    expect(artifact.knowledge_base[2].chunk_id).toBe("kb_3");
  });

  it("ignores non-PROSPECT_KB_CHUNK memory entries (e.g. stray LEAD_PROFILE hits)", async () => {
    generateContentSpy.mockResolvedValue(jsonResponse(validReceptionistPayload()));

    const mixed = [
      ...kbHits,
      makeHit({ id: "lp_1", kind: "LEAD_PROFILE", text: "SHOULD_NOT_APPEAR_LEAD_PROFILE" }),
    ];
    const result = await run(makeCtx({ memory: mixed }));

    const prompt = generateContentSpy.mock.calls[0][0] as string;
    expect(prompt).not.toContain("SHOULD_NOT_APPEAR_LEAD_PROFILE");
    const artifact = result.output as { knowledge_base: Array<{ chunk_id: string }> };
    expect(artifact.knowledge_base.map((c) => c.chunk_id)).toEqual(["kb_1", "kb_2", "kb_3"]);
  });
});

describe("AI_RECEPTIONIST_BUILDER - artifact shape", () => {
  it("produces an artifact with every required top-level field (including setup_markdown)", async () => {
    generateContentSpy.mockResolvedValue(jsonResponse(validReceptionistPayload()));
    const result = await run(makeCtx());
    const artifact = result.output as Record<string, unknown>;

    for (const key of [
      "businessName",
      "businessPhone",
      "leadId",
      "language",
      "agent",
      "greeting",
      "business_summary",
      "hours_policy",
      "faqs",
      "services",
      "intake_flow",
      "booking_flow",
      "escalation_rules",
      "voicemail_fallback",
      "guardrails",
      "setup_markdown",
      "knowledge_base",
    ]) {
      expect(artifact, `missing ${key}`).toHaveProperty(key);
    }
    expect(artifact.businessName).toBe("Acme HVAC");
    expect(typeof artifact.setup_markdown).toBe("string");
  });
});

describe("AI_RECEPTIONIST_BUILDER - malformed Gemini response", () => {
  it("throws when Gemini returns a string with no recoverable JSON object", async () => {
    generateContentSpy.mockResolvedValue(rawResponse("totally not json"));
    await expect(run(makeCtx())).rejects.toThrow(/malformed JSON/i);
  });

  it("recovers from JSON embedded inside markdown fences (regex fallback extracts {...})", async () => {
    const payload = validReceptionistPayload();
    const wrapped = `Here you go:\n\`\`\`json\n${JSON.stringify(payload)}\n\`\`\``;
    generateContentSpy.mockResolvedValue(rawResponse(wrapped));

    const result = await run(makeCtx());
    const artifact = result.output as { agent: { name: string } };
    expect(artifact.agent.name).toBe("Sam");
  });

  it("throws 'requires a lead context' when ctx.lead is null", async () => {
    await expect(run(makeCtx({ lead: null }))).rejects.toThrow(/requires a lead/);
  });

  it("throws when GEMINI_API_KEY is missing", async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(run(makeCtx())).rejects.toThrow(/GEMINI_API_KEY/);
  });
});
