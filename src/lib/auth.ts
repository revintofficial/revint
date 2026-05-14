import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServer } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { sendEmailAsync } from "@/lib/email/send";
import { WelcomeEmail } from "@/lib/email/templates/welcome";
import { internalError } from "@/lib/api-errors";
import type { WorkspaceNiche } from "@/generated/prisma/client";

/** Cookie storing the user's selected workspace id (non-httpOnly for client reads). */
export const ACTIVE_WORKSPACE_COOKIE = "leadac_active_workspace_id";

export class UnauthorizedError extends Error {
  status = 401;
  constructor(message = "Unauthorized") {
    super(message);
  }
}

export class NotFoundError extends Error {
  status = 404;
  constructor(message = "Workspace not found") {
    super(message);
  }
}

/**
 * H5 - thrown by `requireWorkspaceAdminApi()` so API route catch
 * blocks can map it to a clean 403 JSON response without depending
 * on Next's RSC-only `redirect()` (which leaks `NEXT_REDIRECT` as a
 * generic 500 inside an API handler).
 */
export class ForbiddenError extends Error {
  status = 403;
  constructor(message = "Forbidden") {
    super(message);
  }
}

export interface AuthedSession {
  user: {
    id: string;
    email: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
  workspaceId: string;
  workspace: {
    id: string;
    name: string;
    slug: string;
    plan: "FREE" | "PRO" | "PRO_TEAM" | "AGENCY";
    country: string | null;
    niche: WorkspaceNiche;
    onboardingCompletedAt: Date | null;
  };
  role: "OWNER" | "ADMIN" | "MEMBER";
}

/**
 * Resolve the current Supabase user, ensure they have a workspace, and return
 * the active workspace context. Creates a personal workspace on first sign-in.
 * Throws UnauthorizedError if there is no session.
 */
export async function requireUser(): Promise<AuthedSession> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new UnauthorizedError();

  const dbUser = await prisma.user.upsert({
    where: { id: user.id },
    update: {
      email: user.email ?? `${user.id}@user.local`,
    },
    create: {
      id: user.id,
      email: user.email ?? `${user.id}@user.local`,
      fullName:
        (user.user_metadata?.full_name as string | undefined) ||
        (user.user_metadata?.name as string | undefined) ||
        null,
      avatarUrl: (user.user_metadata?.avatar_url as string | undefined) || null,
    },
  });

  let membership = await prisma.workspaceMember.findFirst({
    where: { userId: dbUser.id },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) {
    const baseSlug = (dbUser.email.split("@")[0] || "workspace")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32) || "workspace";

    // M14 - bound the collision loop so a pathological slug (e.g.
    // an extremely common "admin"/"info" prefix that hits dozens of
    // existing rows) doesn't hammer the DB on every signup. After 50
    // sequential attempts we fall back to a 6-char random suffix
    // which gives ~16M collision-free options. Anything past that
    // and we throw instead of looping forever.
    let slug = baseSlug;
    let attempt = 0;
    const MAX_SEQUENTIAL_ATTEMPTS = 50;
    while (await prisma.workspace.findUnique({ where: { slug } })) {
      attempt++;
      if (attempt <= MAX_SEQUENTIAL_ATTEMPTS) {
        slug = `${baseSlug}-${attempt}`;
        continue;
      }
      const randomSuffix = Math.random().toString(36).slice(2, 8);
      slug = `${baseSlug}-${randomSuffix}`;
      // One last collision check — if the random suffix also collides
      // (~1 in 16M) we give up and surface a 500 instead of looping.
      const stillTaken = await prisma.workspace.findUnique({ where: { slug } });
      if (stillTaken) {
        throw new Error(
          `slug_generation_exhausted: could not generate unique slug for base "${baseSlug}" after ${attempt} attempts`,
        );
      }
      break;
    }

    const workspace = await prisma.workspace.create({
      data: {
        name: dbUser.fullName ? `${dbUser.fullName}'s Workspace` : "My Workspace",
        slug,
        ownerId: dbUser.id,
        members: {
          create: { userId: dbUser.id, role: "OWNER" },
        },
      },
    });

    membership = await prisma.workspaceMember.findFirstOrThrow({
      where: { userId: dbUser.id, workspaceId: workspace.id },
      include: { workspace: true },
    });

    // Fire-and-forget welcome email on first workspace creation. Never blocks
    // the auth flow even if Resend is misconfigured.
    if (dbUser.email && !dbUser.email.endsWith("@user.local")) {
      sendEmailAsync({
        to: dbUser.email,
        subject: WelcomeEmail.buildSubject(dbUser.fullName, "en"),
        react: WelcomeEmail({
          fullName: dbUser.fullName,
          workspaceName: workspace.name,
          locale: "en",
        }),
        tags: [{ name: "type", value: "welcome" }],
      });
    }
  }

  const cookieStore = await cookies();
  const activeWorkspaceId = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value;
  if (activeWorkspaceId) {
    const preferred = await prisma.workspaceMember.findFirst({
      where: { userId: dbUser.id, workspaceId: activeWorkspaceId },
      include: { workspace: true },
    });
    if (preferred) {
      membership = preferred;
    }
  }

  return {
    user: {
      id: dbUser.id,
      email: dbUser.email,
      fullName: dbUser.fullName,
      avatarUrl: dbUser.avatarUrl,
    },
    workspaceId: membership.workspaceId,
    workspace: {
      id: membership.workspace.id,
      name: membership.workspace.name,
      slug: membership.workspace.slug,
      plan: membership.workspace.plan,
      country: membership.workspace.country,
      niche: membership.workspace.niche,
      onboardingCompletedAt: membership.workspace.onboardingCompletedAt,
    },
    role: membership.role,
  };
}

/**
 * Same as requireUser() but returns null instead of throwing.
 */
export async function getOptionalUser(): Promise<AuthedSession | null> {
  try {
    return await requireUser();
  } catch {
    return null;
  }
}

/**
 * Require the active workspace member to be ADMIN or OWNER. MEMBER
 * sessions are redirected to /app/settings/account so SDR users
 * who type an admin URL into the address bar are bounced out
 * gracefully instead of seeing a 500 / blank page.
 *
 * Phase 1 deployment-redesign: pairs with the role-aware
 * SettingsNav to enforce ADMIN-only configuration surfaces
 * (offer, packages, lead pipeline, branding, team, billing).
 *
 * NOTE: this calls Next's `redirect()` which throws `NEXT_REDIRECT`.
 * That works inside Server Components / page.tsx but BREAKS inside
 * an API route handler — the throw bubbles to the catch block and
 * is reported as a generic 500. API routes MUST use
 * `requireWorkspaceAdminApi()` instead, which throws
 * `ForbiddenError` (mappable to a 403 JSON response).
 */
export async function requireWorkspaceAdmin(): Promise<AuthedSession> {
  const session = await requireUser();
  if (session.role !== "OWNER" && session.role !== "ADMIN") {
    const { redirect } = await import("next/navigation");
    redirect("/app/settings/account");
  }
  return session;
}

/**
 * H5 - API-friendly version of `requireWorkspaceAdmin`. Returns the
 * authed session for OWNER/ADMIN roles; throws `ForbiddenError`
 * (status 403) for MEMBER roles so the caller's catch block can
 * return a clean JSON 403 instead of a generic 500.
 *
 * Use this in `src/app/api/**\/route.ts` files. Pages keep using
 * `requireWorkspaceAdmin()` because RSC redirects render the
 * /app/settings/account fallback transparently.
 */
export async function requireWorkspaceAdminApi(): Promise<AuthedSession> {
  const session = await requireUser();
  if (session.role !== "OWNER" && session.role !== "ADMIN") {
    throw new ForbiddenError("Workspace admin access required");
  }
  return session;
}

/**
 * Wrap an /api route handler so that:
 *   - 401 is returned automatically when there is no session
 *   - the handler receives a fully resolved AuthedSession
 *   - quota / not-found errors are converted to JSON
 */
export function withAuth<T extends unknown[]>(
  handler: (session: AuthedSession, ...args: T) => Promise<Response>
) {
  return async (...args: T): Promise<Response> => {
    try {
      const session = await requireUser();
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
      // H4 fix - never echo `err.message` to the client. Old code put
      // it under `detail` even in production, which leaked stack
      // fragments, ORM constraint strings and Supabase project hints
      // to anyone who could trigger a 500. `internalError()` logs the
      // full detail server-side under the scope and returns the
      // generic envelope; in dev it includes the detail to keep the
      // iteration loop fast.
      return internalError("withAuth", err);
    }
  };
}
