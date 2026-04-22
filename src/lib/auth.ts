import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServer } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { sendEmailAsync } from "@/lib/email/send";
import { WelcomeEmail } from "@/lib/email/templates/welcome";

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

    let slug = baseSlug;
    let attempt = 0;
    while (await prisma.workspace.findUnique({ where: { slug } })) {
      attempt++;
      slug = `${baseSlug}-${attempt}`;
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
      if (err instanceof NotFoundError) {
        return NextResponse.json({ error: err.message }, { status: 404 });
      }
      console.error("[withAuth] handler error:", err);
      const detail = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: "Internal error", detail },
        { status: 500 }
      );
    }
  };
}
