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

export const EMBEDDING_DIM = 768;
const MODEL_NAME = "text-embedding-004";
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 500;
// Gemini's input limit for this model is 2048 tokens; we cap chars
// defensively at ~8k to keep well under that for any language.
const MAX_CHARS = 8000;

function getClient(): GoogleGenerativeAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set - embeddings unavailable");
  return new GoogleGenerativeAI(key);
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

  const model = getClient().getGenerativeModel({ model: MODEL_NAME });

  let lastErr: unknown = null;
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
      const msg = err instanceof Error ? err.message : String(err);
      // Only retry on transient errors
      const transient = /429|rate|quota|5\d\d|timeout|temporarily/i.test(msg);
      if (!transient || attempt === MAX_RETRIES - 1) break;
      await sleep(BASE_BACKOFF_MS * 2 ** attempt);
    }
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

  const model = getClient().getGenerativeModel({ model: MODEL_NAME });
  const out: number[][] = [];
  const CHUNK = 50;

  for (let i = 0; i < inputs.length; i += CHUNK) {
    const slice = inputs.slice(i, i + CHUNK);

    let lastErr: unknown = null;
    let batch: number[][] | null = null;

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
        break;
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        const transient = /429|rate|quota|5\d\d|timeout|temporarily/i.test(msg);
        if (!transient || attempt === MAX_RETRIES - 1) break;
        await sleep(BASE_BACKOFF_MS * 2 ** attempt);
      }
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
