/**
 * AI Core - embedding helper.
 *
 * Wraps Gemini `text-embedding-004` (768-dimensional, multilingual, free
 * tier 1500 requests/day at time of writing). Every SemanticMemory.text
 * flows through this single function so that if we ever swap providers
 * (to a local model, OpenAI, or Voyage) the change is one file.
 *
 * Design notes:
 *   - 768 dims is a hard contract with the pgvector column type in
 *     prisma/migrations/add_ai_core.sql. Do not change without running
 *     a migration to resize the vector column and reindex.
 *   - Retries use exponential backoff on 429/5xx. Other errors fail
 *     fast so callers don't silently degrade to zero vectors.
 *   - `embedBatch()` is preferred over a loop of `embed()` calls
 *     because Gemini's batchEmbedContents endpoint amortises network
 *     cost and stays under the per-minute request cap.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  getGeminiKey,
  isGeminiAuthFailure,
  markGeminiKeyCool,
} from "@/lib/gemini-keys";

export const EMBEDDING_DIM = 768;
const MODEL_NAME = "text-embedding-004";
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 500;
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
        const res = await model.embedContent(input);
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
            })),
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
