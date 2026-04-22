/**
 * Unit tests for the copilot router (routerTurn).
 *
 * Stubs Gemini + memory.query + prisma + events.emit so we can
 * exercise the function-calling loop, each tool's behaviour, and the
 * safety caps (loop count, cross-workspace guard, dedup).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  makeFakeGemini,
  textReply,
  toolReply,
  deterministicEmbedding,
  type FakeGeminiResponse,
} from "../_helpers/mock-gemini";

// Mutable Gemini configuration; each test mutates `geminiResponses`
// before awaiting `routerTurn`.
let geminiResponses: FakeGeminiResponse[] = [];
let geminiError: Error | null = null;
let sendMessageSpy = vi.fn();

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      const fake = makeFakeGemini({
        responses: geminiResponses,
        generateError: geminiError ?? undefined,
      });
      const model = fake.getGenerativeModel();
      return {
        ...model,
        startChat: () => {
          const chat = model.startChat();
          sendMessageSpy = vi.fn((prompt: unknown) =>
            (chat.sendMessage as unknown as (p: unknown) => Promise<unknown>)(prompt),
          );
          return { sendMessage: sendMessageSpy };
        },
      };
    }
  },
  SchemaType: {
    OBJECT: "OBJECT",
    STRING: "STRING",
    NUMBER: "NUMBER",
    BOOLEAN: "BOOLEAN",
    ARRAY: "ARRAY",
  },
}));

const mockMemoryQuery = vi.fn();
vi.mock("@/lib/ai-core/memory", () => ({
  query: (...args: unknown[]) => mockMemoryQuery(...args),
}));

const mockEventsEmit = vi.fn();
vi.mock("@/lib/ai-core/events", () => ({
  emit: (...args: unknown[]) => mockEventsEmit(...args),
}));

const mockLeadFindUnique = vi.fn();
const mockSemanticMemoryFindFirst = vi.fn();
const mockLeadFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: {
      findUnique: (...args: unknown[]) => mockLeadFindUnique(...args),
      findMany: (...args: unknown[]) => mockLeadFindMany(...args),
    },
    semanticMemory: {
      findFirst: (...args: unknown[]) => mockSemanticMemoryFindFirst(...args),
    },
  },
}));

beforeEach(() => {
  process.env.GEMINI_API_KEY = "test-key";
  geminiResponses = [];
  geminiError = null;
  mockMemoryQuery.mockReset();
  mockEventsEmit.mockReset();
  mockLeadFindUnique.mockReset();
  mockLeadFindMany.mockReset();
  mockSemanticMemoryFindFirst.mockReset();
  // Default: retrieval returns nothing.
  mockMemoryQuery.mockResolvedValue([]);
  mockEventsEmit.mockResolvedValue("session_xyz");
  mockLeadFindMany.mockResolvedValue([]);
});

function hit(partial: Partial<Record<string, unknown>>) {
  return {
    id: partial.id ?? "m_" + Math.random().toString(36).slice(2, 8),
    kind: partial.kind ?? "LEAD_PROFILE",
    leadId: partial.leadId ?? null,
    refType: partial.refType ?? "lead",
    refId: partial.refId ?? partial.leadId ?? null,
    text: partial.text ?? "lead text",
    metadata: partial.metadata ?? {},
    similarity: partial.similarity ?? 0.9,
    createdAt: new Date(),
  };
}

describe("routerTurn - tool dispatch", () => {
  it("semantic_search_leads tool calls memory.query with kinds=[LEAD_PROFILE]", async () => {
    geminiResponses = [
      toolReply([{ name: "semantic_search_leads", args: { query: "pain" } }]),
      textReply("ok"),
    ];

    const { routerTurn } = await import("@/lib/ai-core/router");
    const result = await routerTurn({
      workspaceId: "ws",
      userId: "u",
      message: "find me leads",
    });

    // Called thrice by initial retrieval (leads, turns, offers) and
    // once more inside the tool (semantic_search_leads).
    const kindsCalls = mockMemoryQuery.mock.calls.map((c) => c[0].kinds);
    expect(kindsCalls).toContainEqual(["LEAD_PROFILE"]);
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].name).toBe("semantic_search_leads");
  });

  it("start_pitch_pack blocks cross-workspace leads and does not emit", async () => {
    mockLeadFindUnique.mockResolvedValue({ workspaceId: "different" });
    geminiResponses = [
      toolReply([{ name: "start_pitch_pack", args: { leadId: "foreign" } }]),
      textReply("done"),
    ];

    const { routerTurn } = await import("@/lib/ai-core/router");
    const result = await routerTurn({
      workspaceId: "ws",
      userId: "u",
      message: "pitch that lead",
    });

    expect(mockEventsEmit).not.toHaveBeenCalled();
    const toolCall = result.toolCalls[0];
    expect(toolCall.name).toBe("start_pitch_pack");
    expect(toolCall.result).toEqual({ error: "lead not found in workspace" });
  });

  it("start_deep_research emits user_deep_research for an owned lead", async () => {
    mockLeadFindUnique.mockResolvedValue({ workspaceId: "ws" });
    geminiResponses = [
      toolReply([{ name: "start_deep_research", args: { leadId: "own" } }]),
      textReply("ok"),
    ];

    const { routerTurn } = await import("@/lib/ai-core/router");
    await routerTurn({ workspaceId: "ws", userId: "u", message: "deep dive" });

    expect(mockEventsEmit).toHaveBeenCalledTimes(1);
    const [eventName, payload] = mockEventsEmit.mock.calls[0];
    expect(eventName).toBe("user_deep_research");
    expect(payload).toMatchObject({ workspaceId: "ws", userId: "u", leadId: "own" });
  });

  it("find_lookalikes excludes the source leadId from results", async () => {
    mockSemanticMemoryFindFirst.mockResolvedValue({
      id: "mem1",
      text: "source profile",
    });
    // First retrieval call: returns 3 hits including source lead L.
    // The tool call re-queries memory for lookalikes; we make both
    // memory.query calls return the same dataset.
    mockMemoryQuery.mockImplementation(async (input: { leadId?: string }) => {
      void input;
      return [
        hit({ leadId: "L", text: "source" }),
        hit({ leadId: "other1", text: "similar" }),
        hit({ leadId: "other2", text: "similar2" }),
      ];
    });
    geminiResponses = [
      toolReply([{ name: "find_lookalikes", args: { leadId: "L" } }]),
      textReply("done"),
    ];

    const { routerTurn } = await import("@/lib/ai-core/router");
    const result = await routerTurn({
      workspaceId: "ws",
      userId: "u",
      message: "find similar",
    });

    const toolResult = result.toolCalls[0].result as {
      lookalikes: Array<{ leadId: string }>;
    };
    expect(toolResult.lookalikes.every((lk) => lk.leadId !== "L")).toBe(true);
    expect(toolResult.lookalikes.map((lk) => lk.leadId)).toEqual(
      expect.arrayContaining(["other1", "other2"]),
    );
  });
});

describe("routerTurn - infinite-loop cap", () => {
  it("exits after <=3 tool round trips (max 4 Gemini calls)", async () => {
    // Queue 4 identical tool replies; even with infinite queue the
    // loop must bail after 3 iterations. Gemini is called once for
    // the initial message and then once per tool round trip -> 4.
    geminiResponses = [
      toolReply([{ name: "semantic_search_leads", args: { query: "x" } }]),
      toolReply([{ name: "semantic_search_leads", args: { query: "x" } }]),
      toolReply([{ name: "semantic_search_leads", args: { query: "x" } }]),
      toolReply([{ name: "semantic_search_leads", args: { query: "x" } }]),
    ];

    const { routerTurn } = await import("@/lib/ai-core/router");
    const result = await routerTurn({
      workspaceId: "ws",
      userId: "u",
      message: "ping",
    });

    // Loop cap is 3 iterations -> 3 tool calls executed.
    expect(result.toolCalls.length).toBeLessThanOrEqual(3);
    expect(sendMessageSpy.mock.calls.length).toBeLessThanOrEqual(4);
  });
});

describe("routerTurn - empty-response safety net", () => {
  it("falls back to 'couldn't generate an answer' when Gemini returns no text and no tool calls", async () => {
    // Queue a single response with neither text nor functionCalls so
    // the loop exits with an empty reply and the fallback kicks in.
    geminiResponses = [{ text: "" }];

    const { routerTurn } = await import("@/lib/ai-core/router");
    const result = await routerTurn({
      workspaceId: "ws",
      userId: "u",
      message: "hi",
    });
    expect(result.reply).toMatch(/couldn't generate an answer/i);
  });
});

describe("routerTurn - usedLeadIds dedup", () => {
  it("dedupes the same leadId across memory hits", async () => {
    mockMemoryQuery.mockImplementation(async (input: { kinds?: string[] }) => {
      if (input.kinds?.[0] === "LEAD_PROFILE") {
        return [hit({ leadId: "dup" }), hit({ leadId: "dup" }), hit({ leadId: "other" })];
      }
      return [];
    });
    geminiResponses = [textReply("ok")];

    const { routerTurn } = await import("@/lib/ai-core/router");
    const result = await routerTurn({
      workspaceId: "ws",
      userId: "u",
      message: "hi",
    });
    expect(result.usedLeadIds.filter((id) => id === "dup")).toHaveLength(1);
    expect(result.usedLeadIds).toContain("other");
  });
});

// Keep a reference to make TS not nag about unused import.
void deterministicEmbedding;
