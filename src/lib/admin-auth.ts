import { NextResponse } from "next/server";
import {
  AuthedSession,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  getOptionalUser,
  requireUser,
} from "@/lib/auth";
import { internalError } from "@/lib/api-errors";

/**
 * Founder-level dashboard gate for /admin (marketing analytics) and
 * /api/admin/**. Mirrors the pattern in src/app/api/health/route.ts:
 * the allowlist is a comma-separated list of emails in the
 * ADMIN_DASHBOARD_EMAILS env var. If the var is unset the dashboard
 * is effectively offline (no one passes), which is the safest default
 * for a multi-tenant SaaS — accidentally exposing global cross-tenant
 * analytics to a workspace member would be a bad day.
 *
 * Why not a User.isSuperAdmin column? Because rotating who gets access
 * shouldn't require a DB migration; ops sets the env var. The cost is
 * one process.env read per protected request, which is free.
 *
 * `requireUser()` is still the source of truth for "is there a session
 * at all?" — we layer the email check on top so the founder gets a
 * clean 403 (not redirected to login) if they accidentally signed in
 * with a non-allowlisted email.
 */

function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_DASHBOARD_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowlistedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allow = getAdminEmails();
  if (allow.length === 0) return false;
  return allow.includes(email.toLowerCase());
}

/**
 * Server-component / page guard. Throws ForbiddenError on miss so the
 * caller can decide whether to render a 403 panel or redirect. Unlike
 * `requireWorkspaceAdmin`, we do NOT redirect — the /admin shell is
 * not part of /app; bouncing to /app/settings/account would be
 * confusing for a non-allowlisted teammate who somehow guessed the URL.
 */
export async function requireAdminEmail(): Promise<AuthedSession> {
  const session = await requireUser();
  if (!isAllowlistedEmail(session.user.email)) {
    throw new ForbiddenError("Admin dashboard access required");
  }
  return session;
}

/** Boolean helper for layouts that want to render a custom 403. */
export async function getOptionalAdmin(): Promise<AuthedSession | null> {
  const session = await getOptionalUser();
  if (!session) return null;
  if (!isAllowlistedEmail(session.user.email)) return null;
  return session;
}

/**
 * /api/admin/** wrapper. Mirrors `withAuth` from src/lib/auth.ts so
 * route handlers stay tiny. Maps Unauthorized -> 401 (no session) and
 * Forbidden -> 403 (signed in but not on the allowlist).
 */
export function withAdminAuth<T extends unknown[]>(
  handler: (session: AuthedSession, ...args: T) => Promise<Response>,
) {
  return async (...args: T): Promise<Response> => {
    try {
      const session = await requireAdminEmail();
      return await handler(session, ...args);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (err instanceof ForbiddenError) {
        return NextResponse.json({ error: err.message }, { status: 403 });
      }
      if (err instanceof NotFoundError) {
        return NextResponse.json({ error: err.message }, { status: 404 });
      }
      return internalError("admin.handler", err);
    }
  };
}
