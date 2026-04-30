/**
 * Gemini client helpers with timeout/abort support.
 *
 * The raw `model.generateContent(prompt)` call has no built-in deadline.
 * When the Gemini endpoint hangs (TCP stall, cold start, overloaded region)
 * the BullMQ worker slot is consumed indefinitely, concurrency=5 means 5
 * stuck calls = queue dead.
 *
 * `generateWithTimeout` wraps every call with an AbortController that fires
 * after `timeoutMs` (default 60s). On abort it throws `RetryableError` so
 * BullMQ re-queues the job rather than dropping it. The socket is actually
 * cancelled (not just abandoned on the Node side) because the Google
 * Generative AI SDK respects the `signal` option in `generateContent`.
 *
 * Usage:
 *   import { generateWithTimeout } from "@/lib/gemini-client";
 *   const result = await generateWithTimeout(model, prompt, {
 *     timeoutMs: 60_000,
 *     label: "website_mockup",
 *   });
 *   const text = result.response.text();
 */
import type {
  GenerativeModel,
  GenerateContentRequest,
  GenerateContentResult,
} from "@google/generative-ai";
import { RetryableError } from "@/lib/agent-workers/errors";
import { logger } from "@/lib/logger";

export interface GenerateWithTimeoutOpts {
  /** Abort + RetryableError after this many ms. Default 60_000. */
  timeoutMs?: number;
  /** Logged on abort so worker logs are actionable. */
  label?: string;
}

/**
 * Calls `model.generateContent(request)` with a hard wall-clock timeout.
 *
 * On timeout: cancels the underlying fetch via AbortController and throws
 * `RetryableError` so the caller / BullMQ can retry.
 * On other errors: rethrows as-is (callers own error classification).
 */
export async function generateWithTimeout(
  model: GenerativeModel,
  request: GenerateContentRequest | string,
  opts: GenerateWithTimeoutOpts = {},
): Promise<GenerateContentResult> {
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const label = opts.label ?? "gemini";

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    // The Google Generative AI SDK accepts a `signal` field in the request
    // options (second argument to generateContent as of @google/generative-ai
    // >= 0.21.0). Passing it here allows the SDK to cancel the fetch.
    const result = await (model.generateContent as (
      req: GenerateContentRequest | string,
      options?: { signal?: AbortSignal },
    ) => Promise<GenerateContentResult>)(request, {
      signal: controller.signal,
    });
    return result;
  } catch (err) {
    if (controller.signal.aborted) {
      logger.warn("gemini_client.timeout", {
        label,
        timeoutMs,
      });
      throw new RetryableError(
        `${label}: gemini timeout after ${timeoutMs}ms`,
        err,
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Per-worker recommended timeouts (ms).
 *
 * Values are 2× the empirical P95 latency for each worker.
 * Website Mockup generates the most JSON so gets extra headroom.
 * Apify-backed workers don't use Gemini directly so are omitted.
 */
export const WORKER_TIMEOUTS: Record<string, number> = {
  WEBSITE_MOCKUP_GENERATOR: 90_000,
  AI_RECEPTIONIST_BUILDER: 80_000,
  OPENER_WRITER: 60_000,
  REVIEW_REPLY_AGENT: 60_000,
  LEAD_RESPONSE_AGENT: 60_000,
  VIDEO_SCRIPT_WRITER: 75_000,
  REVIEW_ANALYST: 75_000,
  WEBSITE_PLAN_GENERATOR: 90_000,
  SALES_OPPORTUNITY_SCORER: 45_000,
  LEAD_DOSSIER: 60_000,
  LEAD_INTELLIGENCE_BRIEF: 45_000,
  TRANSCRIBE: 45_000,
} as const;
