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

  // Known permanent cases by name / message.
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
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
