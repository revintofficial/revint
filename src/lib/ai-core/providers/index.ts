/**
 * AI Core - provider entrypoint.
 *
 * Single import for workers / SDR_BRAIN to grab the active inference
 * + embedding providers. Phase 1 always returns the Gemini
 * implementation; Phase 2 will branch on env (e.g. `AI_PROVIDER=openai`)
 * and add a fallback chain.
 *
 * Usage:
 *   import { getStructuredInferenceProvider } from "@/lib/ai-core/providers";
 *   const provider = getStructuredInferenceProvider();
 *   const { data } = await provider.structuredInfer<MyOutput>({ ... });
 */
import { geminiInferenceProvider, geminiEmbeddingProvider } from "./gemini";
import type { EmbeddingProvider, StructuredInferenceProvider } from "./provider";

export type {
  StructuredInferenceProvider,
  StructuredInferenceArgs,
  StructuredInferenceResult,
  EmbeddingProvider,
  EmbeddingResult,
  BatchEmbeddingResult,
  SchemaDefinition,
} from "./provider";

let cachedInference: StructuredInferenceProvider | null = null;
let cachedEmbedding: EmbeddingProvider | null = null;

export function getStructuredInferenceProvider(): StructuredInferenceProvider {
  if (!cachedInference) cachedInference = geminiInferenceProvider;
  return cachedInference;
}

export function getEmbeddingProvider(): EmbeddingProvider {
  if (!cachedEmbedding) cachedEmbedding = geminiEmbeddingProvider;
  return cachedEmbedding;
}

/**
 * Test-only override. The unit suite injects a stub provider so
 * structuredInfer can be replayed deterministically. Production code
 * never calls this.
 */
export function __setStructuredInferenceProviderForTest(
  provider: StructuredInferenceProvider | null,
): void {
  cachedInference = provider;
}

export function __setEmbeddingProviderForTest(
  provider: EmbeddingProvider | null,
): void {
  cachedEmbedding = provider;
}
