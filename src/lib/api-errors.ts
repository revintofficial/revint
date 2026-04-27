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
