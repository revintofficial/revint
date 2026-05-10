/**
 * AI Core - Gemini implementation of the structured-inference + embedding
 * provider interfaces.
 *
 * This is a thin shim over `@google/generative-ai` and the existing
 * `gemini-client.ts` / `embed.ts` helpers. The motivation for the shim
 * over a direct callsite:
 *   1. Workers depend on the abstract interface, not Google's SDK
 *      shape, so swapping providers is a one-file change.
 *   2. Centralizes timeout, retry, and key-rotation policy in one
 *      place — Phase 2 fallback chain hooks here.
 *   3. Gives every call a uniform `tokensIn / tokensOut / modelVersion`
 *      result so SDR_BRAIN telemetry stops doing per-worker accounting
 *      math.
 */
import { GoogleGenerativeAI, type Schema } from "@google/generative-ai";
import { getGeminiKey } from "@/lib/gemini-keys";
import { generateWithTimeout } from "@/lib/gemini-client";
import { safeParseGeminiJson } from "@/lib/gemini";
import { embed as embedOne, embedBatch as embedBatchInternal, EMBEDDING_DIM } from "@/lib/ai-core/embed";
import type {
  EmbeddingProvider,
  StructuredInferenceArgs,
  StructuredInferenceProvider,
  StructuredInferenceResult,
} from "./provider";

/**
 * Default model. Keep in sync with the Gemini Flash family until we
 * have real cost/quality data on Gemini Pro for the SDR_BRAIN
 * arbitration step.
 */
const DEFAULT_MODEL = "gemini-2.5-flash";

export const geminiInferenceProvider: StructuredInferenceProvider = {
  async structuredInfer<T>(args: StructuredInferenceArgs): Promise<StructuredInferenceResult<T>> {
    const client = new GoogleGenerativeAI(getGeminiKey());
    const modelName = args.model ?? DEFAULT_MODEL;
    const model = client.getGenerativeModel({
      model: modelName,
      generationConfig: {
        maxOutputTokens: args.maxTokens ?? 4096,
        temperature: args.temperature ?? 0.3,
        responseMimeType: "application/json",
        // The Google SDK uses its own `Schema` type. We accept the
        // looser shape at the abstraction layer and trust the caller
        // to pass a valid Gemini schema until a future Phase 2
        // provider needs a translator.
        responseSchema: args.schema as unknown as Schema,
      },
    });

    const result = await generateWithTimeout(model, args.prompt, {
      timeoutMs: args.timeoutMs ?? 45_000,
      label: args.label,
    });

    const raw = result.response.text();
    const parsed = safeParseGeminiJson<T>(raw, args.label);

    // The SDK exposes `usageMetadata` on the response; older versions
    // omit it. We default to 0 rather than throwing because token
    // counts are observability, not correctness.
    const usage = (result.response as unknown as {
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    }).usageMetadata ?? {};

    return {
      data: parsed,
      tokensIn: usage.promptTokenCount ?? 0,
      tokensOut: usage.candidatesTokenCount ?? 0,
      modelVersion: modelName,
    };
  },
};

export const geminiEmbeddingProvider: EmbeddingProvider = {
  async embed(text: string) {
    const vector = await embedOne(text);
    return {
      vector,
      tokensIn: Math.ceil(text.length / 4), // rough proxy; SDK doesn't return real count
      modelVersion: `text-embedding-004:${EMBEDDING_DIM}`,
    };
  },
  async embedBatch(texts: string[]) {
    const vectors = await embedBatchInternal(texts);
    const totalChars = texts.reduce((s, t) => s + t.length, 0);
    return {
      vectors,
      tokensIn: Math.ceil(totalChars / 4),
      modelVersion: `text-embedding-004:${EMBEDDING_DIM}`,
    };
  },
};
