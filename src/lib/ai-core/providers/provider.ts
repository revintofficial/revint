/**
 * AI Core - structured inference & embedding provider interfaces.
 *
 * Phase 1 has only one implementation per interface (Gemini). The
 * abstraction exists so a future Phase 2 can plug in a fallback chain
 * (e.g. Gemini -> OpenAI on Gemini 429) or a multi-tenant key-routing
 * layer without touching every worker.
 *
 * Workers SHOULD route Gemini calls through the provider rather than
 * `new GoogleGenerativeAI(...)` directly. The legacy callsites in
 * `src/lib/gemini.ts` / `src/lib/agent-workers/*` are a Phase 2
 * migration target — adding new workers via the provider keeps the
 * surface from re-growing.
 *
 * Key design points:
 *   - `structuredInfer<T>` is the only entry point. Free-form text
 *     completion is intentionally not exposed; everything we ship to
 *     production has a Gemini `responseSchema` so the caller can
 *     trust the JSON shape.
 *   - The schema field is loosely typed (`SchemaDefinition`) because
 *     each provider's SDK shapes its schema slightly differently. The
 *     provider implementation owns the translation.
 *   - `label` is required so timeouts, telemetry, and logs are
 *     attributable to a worker.
 */

/**
 * Loose schema definition. Concrete provider implementations narrow
 * this to their SDK type — `geminiInferenceProvider` casts to the
 * Google `Schema` type internally.
 */
export type SchemaDefinition = Record<string, unknown>;

export interface StructuredInferenceArgs {
  prompt: string;
  schema: SchemaDefinition;
  /**
   * 0..1. Defaults to 0.3 (extraction-heavy). Use 0.7+ only for
   * prose-generation workers (opener, dossier).
   */
  temperature?: number;
  /** Hard upper bound on generated tokens. Default 4096. */
  maxTokens?: number;
  /** Wall-clock timeout in ms; aborts the underlying fetch. Default 45_000. */
  timeoutMs?: number;
  /** Worker / call site identifier for logs + telemetry. */
  label: string;
  /**
   * Optional model override. Provider implementations choose a
   * sensible default (Gemini: `gemini-2.5-flash`).
   */
  model?: string;
}

export interface StructuredInferenceResult<T> {
  data: T;
  tokensIn: number;
  tokensOut: number;
  modelVersion: string;
}

export interface StructuredInferenceProvider {
  structuredInfer<T>(args: StructuredInferenceArgs): Promise<StructuredInferenceResult<T>>;
}

export interface EmbeddingResult {
  vector: number[];
  tokensIn: number;
  modelVersion: string;
}

export interface BatchEmbeddingResult {
  vectors: number[][];
  tokensIn: number;
  modelVersion: string;
}

export interface EmbeddingProvider {
  embed(text: string): Promise<EmbeddingResult>;
  embedBatch(texts: string[]): Promise<BatchEmbeddingResult>;
}
