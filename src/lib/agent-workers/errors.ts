/**
 * Agent worker error taxonomy.
 *
 * Previously BullMQ retried every thrown error with exponential
 * backoff, including permanent failures like schema violations and
 * quota exhaustions. Permanent errors waste Gemini / Apify tokens on
 * work that will deterministically fail again, so we split the error
 * space into two classes and BullMQ only retries the first.
 *
 * Classification rules of thumb:
 *   - Network / 5xx / rate-limit / timeout: RetryableError.
 *   - Schema violation, invalid input, quota exceeded, plan too low,
 *     grounding failure: PermanentError (BullMQ attempts = 1).
 *   - Unknown errors default to retryable, because "retry once" is
 *     cheaper than "lose a run due to a flaky dependency".
 *
 * Callers throw subclasses of the two base errors, or plain Errors
 * (defaulting to retryable). The worker wrapper in execute.ts reads
 * the class to decide whether to rethrow for BullMQ retry or mark
 * the run FAILED and acknowledge the job.
 */

export class RetryableError extends Error {
  readonly retryable = true;
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "RetryableError";
  }
}

export class PermanentError extends Error {
  readonly retryable = false;
  constructor(
    message: string,
    public readonly reason: "schema" | "grounding" | "quota" | "plan" | "input" | "other" = "other",
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "PermanentError";
  }
}

/**
 * Heuristic classification for unclassified errors. Looks at message
 * + code fields to guess. We err on the side of retrying unknowns -
 * transient dependencies are more common than truly permanent
 * failures in practice.
 */
export function isRetryable(err: unknown): boolean {
  if (err instanceof PermanentError) return false;
  if (err instanceof RetryableError) return true;

  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    const name = err.name?.toLowerCase() ?? "";

    // --- Explicit retryable patterns ---
    // Timeout from generateWithTimeout AbortController wrapper.
    if (msg.includes("gemini timeout")) return true;
    // Outer deadline fired inside executeAgentRun.
    if (msg.includes("worker_deadline_exceeded")) return true;
    // Native AbortError from Node fetch / AbortController.
    if (name === "aborterror" || msg.includes("the operation was aborted") || msg.includes("aborted")) return true;
    // Network transients.
    if (msg.includes("socket hang up") || msg.includes("econnreset") || msg.includes("enotfound")) return true;
    // node-postgres pool back-pressure: surfaces as "Connection terminated
    // due to connection timeout" when the pool's connectionTimeoutMillis
    // elapses while waiting for a free slot. Transient — retry after backoff
    // typically succeeds because sibling jobs have released their connections.
    if (msg.includes("connection terminated") || msg.includes("connection timeout")) return true;
    // Transient Apify 5xx / rate-limit (HTTP_429, HTTP_502, HTTP_503).
    if (/http_(429|5\d\d)/.test(msg)) return true;
    // Apify temporary "memory limit exceeded" (402): once sibling actors
    // free their reservations the retry succeeds. With the new memoryMbytes
    // caps in @/lib/apify this should be rare, but still belongs in the
    // retry class rather than poisoning the AgentRun.
    if (msg.includes("actor-memory-limit-exceeded")) return true;

    // --- Explicit permanent patterns ---
    if (msg.includes("schema") && msg.includes("violation")) return false;
    if (msg.includes("quota exceeded")) return false;
    if (msg.includes("plan too low")) return false;
    if (msg.includes("apify monthly usd budget exhausted")) return false;
    if (msg.includes("invalid json") || msg.includes("malformed json")) return false;
    // Google Generative AI surfaces hard errors (SAFETY, PROMPT_BLOCK)
    // that no retry will fix.
    if (msg.includes("safety") || msg.includes("prompt was blocked")) return false;
  }
  return true;
}
