/**
 * AI Core - embedding helper.
 *
 * Wraps Gemini `gemini-embedding-001` with `outputDimensionality=768`
 * (multilingual, Matryoshka — the 768 prefix is loss-trained so it is
 * comparable to the legacy `text-embedding-004` vectors at the same
 * dim). Every SemanticMemory.text flows through this single function
 * so that if we ever swap providers (to a local model, OpenAI, or
 * Voyage) the change is one file.
 *
 * Design notes:
 *   - 768 dims is a hard contract with the pgvector column type in
 *     prisma/migrations/add_ai_core.sql. We MUST pass
 *     `outputDimensionality: 768` explicitly — Gemini's default for
 *     `gemini-embedding-001` is 3072 and would error against
 *     `vector(768)` on insert.
 *   - The legacy `text-embedding-004` model was retired by Google;
 *     `embedContent` returns 404 NOT_FOUND for it. Migrating to
 *     `gemini-embedding-001` is what unsticks every memory query.
 *   - Retries use exponential backoff on 429/5xx. Other errors fail
 *     fast so callers don't silently degrade to zero vectors.
 *   - `embedBatch()` is preferred over a loop of `embed()` calls
 *     because Gemini's batchEmbedContents endpoint amortises network
 *     cost and stays under the per-minute request cap.
 *   - The `@google/generative-ai` v0.24.x SDK's `EmbedContentRequest`
 *     type does not yet declare `outputDimensionality`, but at runtime
 *     the SDK `JSON.stringify`s the params object as-is, so the field
 *     survives to the REST call. We pass it through with a tight cast
 *     rather than maintaining a parallel REST fallback.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  getGeminiKey,
  isGeminiAuthFailure,
  markGeminiKeyCool,
} from "@/lib/gemini-keys";

export const EMBEDDING_DIM = 768;
export const EMBEDDING_MODEL_NAME = "gemini-embedding-001";
const MODEL_NAME = EMBEDDING_MODEL_NAME;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 500;
/**
 * `gemini-embedding-001` ships Matryoshka-trained outputs at
 * 768/1536/3072. Anything else gets rejected by the API. Keep 768 in
 * lock-step with `EMBEDDING_DIM` above and with the pgvector column
 * width — never change one without the other.
 */
const OUTPUT_DIMENSIONALITY = 768;
// Gemini's input limit for this model is 2048 tokens; we cap chars
// defensively at ~8k to keep well under that for any language.
const MAX_CHARS = 8000;

/**
 * Picks a key from the rotation pool every call. Embedding is the
 * single highest-volume Gemini consumer (every memory write +
 * pre-fetch query + lookalike search), so spreading the load over the
 * full pool gets the most mileage out of the per-key 1500/day quota.
 */
function getClient(): { client: GoogleGenerativeAI; apiKey: string } {
  const apiKey = getGeminiKey();
  return { client: new GoogleGenerativeAI(apiKey), apiKey };
}

export class EmbeddingError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "EmbeddingError";
  }
}

/**
 * Truncates and trims the text to a safe length before embedding. We
 * never pad; a shorter input produces a vector just as valid, and
 * padding would bias the cosine similarity toward the padding token.
 */
function normalize(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_CHARS) return trimmed;
  return trimmed.slice(0, MAX_CHARS);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Embeds a single string. Throws `EmbeddingError` if all retries fail.
 */
export async function embed(text: string): Promise<number[]> {
  const input = normalize(text);
  if (!input) {
    throw new EmbeddingError("Cannot embed empty text");
  }

  // Outer loop: rotate keys on 403. Each iteration picks a fresh key
  // from the pool. Inner loop: existing 429/5xx exponential backoff
  // against the chosen key.
  let lastErr: unknown = null;
  const triedKeys = new Set<string>();
  // We try at most MAX_RETRIES distinct keys (capped by what's
  // configured) before giving up. Default config is 1 key, so this
  // collapses to a single inner-loop attempt — same behaviour as
  // before for legacy single-key deploys.
  const MAX_KEY_ROTATIONS = 3;

  for (let rotation = 0; rotation < MAX_KEY_ROTATIONS; rotation++) {
    let pickedKey: string;
    try {
      pickedKey = getGeminiKey();
    } catch (err) {
      throw new EmbeddingError(
        err instanceof Error ? err.message : String(err),
        err,
      );
    }
    if (triedKeys.has(pickedKey)) break;
    triedKeys.add(pickedKey);

    const model = new GoogleGenerativeAI(pickedKey).getGenerativeModel({
      model: MODEL_NAME,
    });

    let authFailure = false;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // SDK type lags the REST API — `outputDimensionality` is a
        // valid field but not declared in `EmbedContentRequest` in
        // v0.24.x. Cast through `unknown` to bypass the narrow type
        // while preserving the runtime shape the API expects.
        const res = await model.embedContent({
          content: { role: "user", parts: [{ text: input }] },
          outputDimensionality: OUTPUT_DIMENSIONALITY,
        } as unknown as Parameters<typeof model.embedContent>[0]);
        const values = res.embedding?.values;
        if (!values || values.length !== EMBEDDING_DIM) {
          throw new EmbeddingError(
            `Unexpected embedding shape: got ${values?.length ?? 0} dims, expected ${EMBEDDING_DIM}`,
          );
        }
        return values;
      } catch (err) {
        lastErr = err;
        if (isGeminiAuthFailure(err)) {
          markGeminiKeyCool(pickedKey, "embed_403");
          authFailure = true;
          break;
        }
        const msg = err instanceof Error ? err.message : String(err);
        // Only retry on transient errors
        const transient = /429|rate|quota|5\d\d|timeout|temporarily/i.test(msg);
        if (!transient || attempt === MAX_RETRIES - 1) break;
        await sleep(BASE_BACKOFF_MS * 2 ** attempt);
      }
    }
    if (!authFailure) break; // non-auth failure: don't bother trying another key
  }
  throw new EmbeddingError(
    `Failed to embed after ${MAX_RETRIES} attempts`,
    lastErr,
  );
}

/**
 * Batched embedding. Gemini's batchEmbedContents caps at 100 inputs
 * per request; we chunk into 50 to stay safely inside the window.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const inputs = texts.map(normalize);
  if (inputs.some((s) => !s)) {
    throw new EmbeddingError("embedBatch received an empty string");
  }

  // Rotate keys per CHUNK rather than per-call so a 403 mid-batch
  // re-tries the failing chunk against a fresh key without re-uploading
  // the chunks that already succeeded.
  const out: number[][] = [];
  const CHUNK = 50;

  for (let i = 0; i < inputs.length; i += CHUNK) {
    const slice = inputs.slice(i, i + CHUNK);

    let lastErr: unknown = null;
    let batch: number[][] | null = null;

    const triedKeys = new Set<string>();
    rotation: for (let rotation = 0; rotation < 3; rotation++) {
      const pickedKey = getClient().apiKey;
      if (triedKeys.has(pickedKey)) break;
      triedKeys.add(pickedKey);

      const model = new GoogleGenerativeAI(pickedKey).getGenerativeModel({
        model: MODEL_NAME,
      });

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const res = await model.batchEmbedContents({
            requests: slice.map((content) => ({
              content: { role: "user", parts: [{ text: content }] },
              // Same SDK type-lag note as in `embed()` above: the field
              // is wire-valid, just not in the TS interface.
              outputDimensionality: OUTPUT_DIMENSIONALITY,
            })) as unknown as Parameters<typeof model.batchEmbedContents>[0]["requests"],
          });
          batch = res.embeddings.map((e) => {
            const values = e.values ?? [];
            if (values.length !== EMBEDDING_DIM) {
              throw new EmbeddingError(
                `Unexpected embedding shape in batch: ${values.length} dims`,
              );
            }
            return values;
          });
          break rotation;
        } catch (err) {
          lastErr = err;
          if (isGeminiAuthFailure(err)) {
            markGeminiKeyCool(pickedKey, "embedBatch_403");
            continue rotation;
          }
          const msg = err instanceof Error ? err.message : String(err);
          const transient = /429|rate|quota|5\d\d|timeout|temporarily/i.test(msg);
          if (!transient || attempt === MAX_RETRIES - 1) break;
          await sleep(BASE_BACKOFF_MS * 2 ** attempt);
        }
      }
      // Non-auth failure exhausted retries against this key — no point
      // trying another, the error is not key-specific.
      break;
    }

    if (!batch) {
      throw new EmbeddingError(
        `Batch embed failed after ${MAX_RETRIES} attempts`,
        lastErr,
      );
    }
    out.push(...batch);
  }

  return out;
}

/**
 * Formats a vector for a pgvector literal. `[0.1,0.2,...]` with fixed
 * precision; we trim to 6 decimals since the actual precision Gemini
 * provides is far lower than that and it keeps the raw SQL readable
 * in logs.
 */
export function toPgVectorLiteral(v: number[]): string {
  return `[${v.map((x) => x.toFixed(6)).join(",")}]`;
}
