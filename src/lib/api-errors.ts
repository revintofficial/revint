/**
 * Shared helpers for safe API error responses.
 *
 * Goal: never echo raw `err.message` or `String(err)` to the client in
 * production. Stack traces, ORM error strings and third-party SDK
 * errors routinely contain SQL, table names, internal hostnames or
 * even secrets. Instead we log the full detail server-side and return
 * a generic message to the caller.
 *
 * Routes should pick the helper that matches the failure mode:
 *   - `internalError(scope, err)` for 500s (default).
 *   - `badRequest(message)` for 400s where the message is a static,
 *     hand-picked string (e.g. validation failure).
 *   - In dev (`NODE_ENV !== "production"`) we *do* include the error
 *     message under `detail` to keep iteration fast.
 */

import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

interface ErrorBody {
  error: string;
  detail?: string;
  code?: string;
}

function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}

function describe(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/**
 * M25 - Next.js 16 throws an opaque `NEXT_REDIRECT;...` error from
 * `redirect()` and a `NEXT_NOT_FOUND` error from `notFound()` so it
 * can render the destination page on the way back up the call stack.
 * Generic catch blocks (try { ... } catch (err) { return 500 }) will
 * accidentally swallow these and surface a 500 instead of performing
 * the navigation. Use `isRedirectOrNotFound(err)` at the top of any
 * catch block that wraps server-component code (page.tsx, layout.tsx,
 * server actions) to re-throw and let Next handle it.
 *
 * The detection is deliberately string-based — Next doesn't export a
 * stable `isRedirectError` helper from a public path, but the digest
 * shape `NEXT_REDIRECT;...` and `NEXT_NOT_FOUND` has been stable
 * since 13.x.
 */
export function isRedirectOrNotFound(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const digest = (err as Error & { digest?: string }).digest ?? "";
  if (typeof digest === "string" && digest.length > 0) {
    if (digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND") {
      return true;
    }
  }
  // Fallback: some Next builds put the marker on `message` itself.
  return err.message === "NEXT_REDIRECT" || err.message === "NEXT_NOT_FOUND";
}

/**
 * Standard 500 response. Always logs the underlying error under the
 * provided `scope` (use a `domain.action.failed` shape so logs are
 * greppable) and returns a generic body in production.
 */
export function internalError(
  scope: string,
  err: unknown,
  extra?: Record<string, unknown>,
): NextResponse {
  logger.error(scope, { err: describe(err), ...(extra ?? {}) });
  const body: ErrorBody = { error: "Internal error" };
  if (!isProd()) {
    body.detail = describe(err);
  }
  return NextResponse.json(body, { status: 500 });
}

/**
 * 400 with a hand-written, static message. Use this for validation
 * errors where the message itself is part of the API contract.
 */
export function badRequest(
  message: string,
  extra?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json({ error: message, ...(extra ?? {}) }, { status: 400 });
}

/**
 * 502/503/504 - upstream/external service failure. Logs the cause
 * server-side, returns a generic "upstream failed" message.
 */
export function upstreamError(
  scope: string,
  err: unknown,
  status: 502 | 503 | 504 = 502,
  extra?: Record<string, unknown>,
): NextResponse {
  logger.error(scope, { err: describe(err), ...(extra ?? {}) });
  const body: ErrorBody = { error: "Upstream service failed" };
  if (!isProd()) {
    body.detail = describe(err);
  }
  return NextResponse.json(body, { status });
}
