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
import { prisma } from "@/lib/prisma";

/**
 * Founder-level dashboard gate for /admin (marketing analytics) and
 * /api/admin/**. Authoritative check is the `User.isPlatformAdmin` column
 * (Phase 3 of the Revint corporate transition); the
 * `ADMIN_DASHBOARD_EMAILS` env var stays as a bootstrap fallback so a
 * fresh database without any admin rows is still operable by the
 * founders without touching SQL.
 *
 * Two short caches keep this cheap:
 *   - module-level allowlist (parsed once per process)
 *   - 30-second per-user admin flag cache (re-issued on every request
 *     but the DB hit is amortised across the page+API tree)
 *
 * Why not skip the env var entirely? Because the bootstrap case
 * (new dev DB, prod just after the rename) needs a way in without a
 * "create the first admin" UI that itself needs an admin to use.
 * Once that UI exists in `/admin/team`, the env var can be retired.
 *
 * `requireUser()` is still the source of truth for "is there a session
 * at all?" — we layer the admin check on top so the founder gets a
 * clean 403 (not redirected to login) if they accidentally signed in
 * with a non-admin email.
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

// In-process cache keyed by user id. Short TTL so a freshly-revoked
// admin loses access within the cache window without a server restart.
const ADMIN_CACHE_TTL_MS = 30_000;
const adminCache = new Map<string, { value: boolean; expiresAt: number }>();

async function isPlatformAdminUser(userId: string): Promise<boolean> {
  const cached = adminCache.get(userId);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPlatformAdmin: true },
  });
  const value = row?.isPlatformAdmin === true;
  adminCache.set(userId, { value, expiresAt: now + ADMIN_CACHE_TTL_MS });
  return value;
}

/**
 * Test-only — clears the in-process admin cache. Real callers should
 * not need this; the TTL is short enough that flipping the column in
 * the DB becomes effective inside 30 seconds.
 */
export function _resetAdminAuthCache(): void {
  adminCache.clear();
}

async function isAdminSession(session: AuthedSession): Promise<boolean> {
  if (await isPlatformAdminUser(session.user.id)) return true;
  return isAllowlistedEmail(session.user.email);
}

/**
 * Server-component / page guard. Throws ForbiddenError on miss so the
 * caller can decide whether to render a 403 panel or redirect. Unlike
 * `requireWorkspaceAdmin`, we do NOT redirect — the /admin shell is
 * not part of /app; bouncing to /app/settings/account would be
 * confusing for a non-admin teammate who somehow guessed the URL.
 */
export async function requireAdminEmail(): Promise<AuthedSession> {
  const session = await requireUser();
  if (!(await isAdminSession(session))) {
    throw new ForbiddenError("Admin dashboard access required");
  }
  return session;
}

/** Boolean helper for layouts that want to render a custom 403. */
export async function getOptionalAdmin(): Promise<AuthedSession | null> {
  const session = await getOptionalUser();
  if (!session) return null;
  if (!(await isAdminSession(session))) return null;
  return session;
}

/**
 * /api/admin/** wrapper. Mirrors `withAuth` from src/lib/auth.ts so
 * route handlers stay tiny. Maps Unauthorized -> 401 (no session) and
 * Forbidden -> 403 (signed in but not platform-admin).
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
