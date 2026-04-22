/**
 * Deterministic Gemini stand-ins for unit tests.
 *
 * Every test that mocks `@google/generative-ai` can import these
 * helpers to stay consistent instead of re-implementing the shape of
 * `embedContent`, `batchEmbedContents`, and `generateContent` in each
 * file. None of these helpers call `vi.mock()` themselves - that is
 * still the test's responsibility (the factory pattern assumes the
 * test has already declared the mock). These helpers only produce the
 * response shapes Gemini returns.
 *
 * Determinism is deliberate: tests that compare embeddings can reason
 * about cosine similarity purely from the seed string. Two tests that
 * embed the SAME string get the SAME vector; two tests that embed
 * DIFFERENT strings get vectors that are approximately orthogonal.
 */

export const EMBEDDING_DIM = 768;

/**
 * Hashes a string into a reproducible 768-dim unit vector. Uses a
 * cheap xmur3+sfc32 mix so the output is stable across Node versions
 * without needing a Buffer-based crypto hash. Good enough for ordering
 * tests; not suitable for real similarity reasoning.
 */
export function deterministicEmbedding(seed: string): number[] {
  const h = xmur3(seed);
  const rng = sfc32(h(), h(), h(), h());
  const v = new Array<number>(EMBEDDING_DIM);
  let sumSq = 0;
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    // Box-Muller transform for a gaussian; centered & small-variance
    // so the vectors are spread across the unit sphere.
    const u1 = Math.max(1e-9, rng());
    const u2 = rng();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    v[i] = z;
    sumSq += z * z;
  }
  // L2-normalise so cosine similarity equals dot product.
  const norm = Math.sqrt(sumSq) || 1;
  for (let i = 0; i < EMBEDDING_DIM; i++) v[i] = v[i] / norm;
  return v;
}

/**
 * Returns a `GoogleGenerativeAI` compatible mock whose `getGenerativeModel`
 * returns a model that embeds via `deterministicEmbedding` and replies
 * to `generateContent` / `startChat().sendMessage` with the queued
 * responses. Queue semantics: each call consumes the next entry in
 * `responses`; when empty, the last response is repeated.
 *
 * Use like:
 *   vi.mock("@google/generative-ai", () => ({
 *     GoogleGenerativeAI: vi.fn().mockImplementation(() =>
 *       makeFakeGemini({ responses: [textReply("ok")] }),
 *     ),
 *     SchemaType: { OBJECT: "OBJECT", STRING: "STRING", NUMBER: "NUMBER", BOOLEAN: "BOOLEAN", ARRAY: "ARRAY" },
 *   }));
 */
export interface FakeGeminiResponse {
  /** Plain text reply returned from `response.text()`. */
  text?: string;
  /** Function calls emitted as parts. */
  functionCalls?: Array<{ name: string; args: Record<string, unknown> }>;
}

export function textReply(text: string): FakeGeminiResponse {
  return { text };
}

export function toolReply(
  functionCalls: Array<{ name: string; args: Record<string, unknown> }>,
): FakeGeminiResponse {
  return { functionCalls };
}

export function makeFakeGemini(config: {
  responses?: FakeGeminiResponse[];
  /** Force `embedContent` / `batchEmbedContents` to throw this error. */
  embedError?: Error;
  /** Force `generateContent` to throw this error. */
  generateError?: Error;
}) {
  const queue = [...(config.responses ?? [])];

  function nextResponse(): FakeGeminiResponse {
    if (queue.length === 0) return { text: "" };
    if (queue.length === 1) return queue[0];
    return queue.shift()!;
  }

  function wrap(resp: FakeGeminiResponse) {
    const parts: Array<Record<string, unknown>> = [];
    if (resp.text) parts.push({ text: resp.text });
    for (const fc of resp.functionCalls ?? []) {
      parts.push({ functionCall: { name: fc.name, args: fc.args } });
    }
    return {
      response: {
        text: () => resp.text ?? "",
        candidates: [{ content: { parts } }],
      },
    };
  }

  return {
    getGenerativeModel: () => ({
      embedContent: async (input: string | { content: { parts: Array<{ text: string }> } }) => {
        if (config.embedError) throw config.embedError;
        const text =
          typeof input === "string"
            ? input
            : input?.content?.parts?.[0]?.text ?? "";
        return { embedding: { values: deterministicEmbedding(text) } };
      },
      batchEmbedContents: async (args: {
        requests: Array<{ content: { parts: Array<{ text: string }> } }>;
      }) => {
        if (config.embedError) throw config.embedError;
        return {
          embeddings: args.requests.map((r) => ({
            values: deterministicEmbedding(r.content.parts[0]?.text ?? ""),
          })),
        };
      },
      generateContent: async () => {
        if (config.generateError) throw config.generateError;
        return wrap(nextResponse());
      },
      startChat: () => ({
        sendMessage: async () => {
          if (config.generateError) throw config.generateError;
          return wrap(nextResponse());
        },
      }),
    }),
  };
}

/**
 * Helper for tests that set their own custom spies. Returns a minimal
 * SchemaType enum matching the subset used by router.ts.
 */
export const fakeSchemaType = {
  OBJECT: "OBJECT",
  STRING: "STRING",
  NUMBER: "NUMBER",
  BOOLEAN: "BOOLEAN",
  ARRAY: "ARRAY",
} as const;

// ---------- internal helpers ----------

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a |= 0;
    b |= 0;
    c |= 0;
    d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}
