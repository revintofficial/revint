/**
 * Unit tests for the Gemini embedding wrapper.
 *
 * Mocks `@google/generative-ai` with a deterministic fake so we can
 * exercise retry + error paths without hitting the real API.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  deterministicEmbedding,
  EMBEDDING_DIM,
  makeFakeGemini,
} from "../_helpers/mock-gemini";

// Shared mutable model handle. Each test swaps this to control the
// behaviour of `getGenerativeModel` without re-mocking the module.
// Typed as `any`-ish record because the fake helper returns a shape
// with extra members (generateContent, startChat) we don't assert
// on here.
type MockModel = Record<string, unknown>;
let currentModel: MockModel = {};

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return currentModel;
    }
  },
}));

beforeEach(() => {
  process.env.GEMINI_API_KEY = "test-key";
  currentModel = makeFakeGemini({ responses: [] }).getGenerativeModel();
});

describe("embed()", () => {
  it("returns a 768-dim array for a short string", async () => {
    const { embed } = await import("@/lib/ai-core/embed");
    const v = await embed("hello");
    expect(v).toHaveLength(EMBEDDING_DIM);
    expect(v.every((x) => typeof x === "number" && Number.isFinite(x))).toBe(true);
  });

  it("truncates inputs above the 8k char cap without throwing", async () => {
    const { embed } = await import("@/lib/ai-core/embed");
    const huge = "a".repeat(10_000);
    const v = await embed(huge);
    expect(v).toHaveLength(EMBEDDING_DIM);
  });

  it("throws EmbeddingError on empty string", async () => {
    const { embed, EmbeddingError } = await import("@/lib/ai-core/embed");
    await expect(embed("")).rejects.toBeInstanceOf(EmbeddingError);
    await expect(embed("   ")).rejects.toBeInstanceOf(EmbeddingError);
  });

  it("throws EmbeddingError when the provider returns the wrong shape", async () => {
    const { embed, EmbeddingError } = await import("@/lib/ai-core/embed");
    currentModel = {
      embedContent: vi.fn().mockResolvedValue({ embedding: { values: [1, 2, 3] } }),
    };
    await expect(embed("hi")).rejects.toBeInstanceOf(EmbeddingError);
  });

  it("retries a transient 429 and returns a vector on success", async () => {
    const { embed } = await import("@/lib/ai-core/embed");
    const embedContent = vi
      .fn()
      .mockRejectedValueOnce(new Error("429 rate limit"))
      .mockResolvedValueOnce({
        embedding: { values: deterministicEmbedding("retried") },
      });
    currentModel = { embedContent };
    const v = await embed("retried");
    expect(v).toHaveLength(EMBEDDING_DIM);
    expect(embedContent).toHaveBeenCalledTimes(2);
  });

  it("does not retry on non-transient errors", async () => {
    const { embed, EmbeddingError } = await import("@/lib/ai-core/embed");
    const embedContent = vi.fn().mockRejectedValue(new Error("API key invalid"));
    currentModel = { embedContent };
    await expect(embed("x")).rejects.toBeInstanceOf(EmbeddingError);
    expect(embedContent).toHaveBeenCalledTimes(1);
  });

  it("sends outputDimensionality=768 so gemini-embedding-001 returns a 768-dim vector", async () => {
    // This is the regression guard for the text-embedding-004 → gemini-embedding-001
    // migration. Without outputDimensionality the API returns 3072 dims and pgvector(768)
    // rejects the insert.
    const { embed } = await import("@/lib/ai-core/embed");
    const embedContent = vi.fn().mockResolvedValue({
      embedding: { values: deterministicEmbedding("dim-check") },
    });
    currentModel = { embedContent };
    await embed("dim-check");
    expect(embedContent).toHaveBeenCalledTimes(1);
    const callArg = embedContent.mock.calls[0]?.[0];
    expect(callArg).toMatchObject({
      content: { role: "user", parts: [{ text: "dim-check" }] },
      outputDimensionality: 768,
    });
  });
});

describe("embedBatch()", () => {
  it("sends outputDimensionality=768 on every request item", async () => {
    const { embedBatch } = await import("@/lib/ai-core/embed");
    const batchEmbedContents = vi.fn().mockResolvedValue({
      embeddings: [
        { values: deterministicEmbedding("a") },
        { values: deterministicEmbedding("b") },
      ],
    });
    currentModel = { batchEmbedContents };
    const vectors = await embedBatch(["a", "b"]);
    expect(vectors).toHaveLength(2);
    expect(vectors[0]).toHaveLength(EMBEDDING_DIM);
    const callArg = batchEmbedContents.mock.calls[0]?.[0];
    expect(callArg.requests).toHaveLength(2);
    for (const req of callArg.requests) {
      expect(req).toMatchObject({
        content: { role: "user", parts: [{ text: expect.any(String) }] },
        outputDimensionality: 768,
      });
    }
  });
});

describe("toPgVectorLiteral()", () => {
  it("formats with 6 decimals and bracket-wrapped", async () => {
    const { toPgVectorLiteral } = await import("@/lib/ai-core/embed");
    expect(toPgVectorLiteral([0.1, 0.2])).toBe("[0.100000,0.200000]");
  });
});
