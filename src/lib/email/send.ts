/**
 * Thin wrapper around the Resend SDK with:
 *   - dev-redirect support (EMAIL_DEV_REDIRECT) so templates can be exercised
 *     without spamming real inboxes
 *   - structured logging via `logger` (no raw console.error)
 *   - light retry with backoff for transient 5xx / network errors
 *   - `tags` passed through for Resend's analytics dashboard
 *
 * The shape mirrors Resend's `emails.send` input. Callers should pass either
 * `react` (preferred — React Email templates) or `html`/`text` strings.
 */

import { render } from "@react-email/render";
import type { ReactElement } from "react";
import { getResend } from "./client";
import {
  getDevRedirect,
  getFromAddress,
  getReplyToAddress,
} from "./from";
import { logger } from "@/lib/logger";

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  /** Preferred: React Email component. Rendered to both HTML and plaintext. */
  react?: ReactElement;
  /** Fallback if no react template is provided. */
  html?: string;
  /** Plaintext fallback. Auto-derived from react if omitted. */
  text?: string;
  /** Resend tags for filtering in the dashboard (e.g. type=welcome). */
  tags?: Array<{ name: string; value: string }>;
  /** Override the default from address for this specific send. */
  from?: string;
  /** Override the default reply-to for this specific send. */
  replyTo?: string;
  /** Max retries on transient errors. Default 2 (3 total attempts). */
  maxRetries?: number;
}

export interface SendEmailResult {
  id: string | null;
  delivered: boolean;
  skipped: boolean;
  error?: string;
}

const TRANSIENT_ERROR_SUBSTRINGS = [
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "socket hang up",
  "rate_limit_exceeded",
  "internal_server_error",
];

function isTransientError(message: string): boolean {
  return TRANSIENT_ERROR_SUBSTRINGS.some((s) => message.includes(s));
}

function toArray(x: string | string[]): string[] {
  return Array.isArray(x) ? x : [x];
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const devRedirect = getDevRedirect();
  const originalTo = toArray(input.to);
  const to = devRedirect ? [devRedirect] : originalTo;

  if (to.length === 0 || to.some((addr) => !addr?.includes("@"))) {
    logger.warn("email.invalid_recipient", { to: originalTo });
    return { id: null, delivered: false, skipped: true, error: "invalid_recipient" };
  }

  let html = input.html;
  let text = input.text;
  if (input.react) {
    try {
      html = await render(input.react);
      if (!text) text = await render(input.react, { plainText: true });
    } catch (err) {
      logger.error("email.render_failed", { err, subject: input.subject });
      return {
        id: null,
        delivered: false,
        skipped: false,
        error: "render_failed",
      };
    }
  }

  if (!html && !text) {
    logger.warn("email.empty_body", { subject: input.subject });
    return { id: null, delivered: false, skipped: true, error: "empty_body" };
  }

  const from = input.from || getFromAddress();
  const replyTo = input.replyTo || getReplyToAddress();
  const tags = [
    ...(input.tags || []),
    ...(devRedirect ? [{ name: "dev_redirect", value: "true" }] : []),
  ];

  const payload: Record<string, unknown> = {
    from,
    to,
    subject: input.subject,
    replyTo,
  };
  if (html) payload.html = html;
  if (text) payload.text = text;
  if (tags.length > 0) payload.tags = tags;

  const client = getResend();
  const maxRetries = Math.max(0, input.maxRetries ?? 2);

  let lastError = "";
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Resend SDK and our dev stub share the same input shape. We widen
      // the call signature to `unknown` so the union of the two client
      // types doesn't force an intersected (and un-satisfiable) parameter.
      type SendFn = (input: unknown) => Promise<{
        data: { id: string } | null;
        error: unknown;
      }>;
      const send = client.emails.send.bind(client.emails) as SendFn;
      const { data, error } = await send(payload);
      if (error) {
        const msg =
          typeof error === "object" && error !== null && "message" in error
            ? String((error as { message: unknown }).message)
            : String(error);
        lastError = msg;
        logger.warn("email.send_error", {
          attempt,
          error: msg,
          subject: input.subject,
        });
        if (attempt < maxRetries && isTransientError(msg)) {
          await new Promise((r) => setTimeout(r, 300 * Math.pow(2, attempt)));
          continue;
        }
        return { id: null, delivered: false, skipped: false, error: msg };
      }

      logger.info("email.sent", {
        id: data?.id,
        to,
        subject: input.subject,
        devRedirect: !!devRedirect,
        originalTo: devRedirect ? originalTo : undefined,
        tags: tags.map((t) => `${t.name}=${t.value}`).join(","),
      });
      return { id: data?.id ?? null, delivered: true, skipped: false };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lastError = msg;
      logger.error("email.send_exception", {
        attempt,
        err,
        subject: input.subject,
      });
      if (attempt < maxRetries && isTransientError(msg)) {
        await new Promise((r) => setTimeout(r, 300 * Math.pow(2, attempt)));
        continue;
      }
      return { id: null, delivered: false, skipped: false, error: msg };
    }
  }

  return { id: null, delivered: false, skipped: false, error: lastError };
}

/**
 * Fire-and-forget variant: logs errors but never throws. Use in hot paths
 * (auth callbacks, workers) where email failure should not break the
 * primary flow.
 */
export function sendEmailAsync(input: SendEmailInput): void {
  sendEmail(input).catch((err) => {
    logger.error("email.async_rejected", { err, subject: input.subject });
  });
}
