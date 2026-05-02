import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError, ACTIVE_WORKSPACE_COOKIE } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    const session = await requireUser();
    const { workspaceId } = (await request.json()) as { workspaceId?: string };

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }

    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: session.user.id, workspaceId },
      include: { workspace: true },
    });

    if (!membership) {
      return NextResponse.json({ error: "Not a member of this workspace" }, { status: 403 });
    }

    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
      path: "/",
      sameSite: "lax",
      httpOnly: false,
      // M16 - mark Secure in production so the cookie isn't sent
      // over plaintext HTTP (man-in-the-middle could otherwise read
      // the workspace pointer on a downgraded request and pivot
      // CSRF attempts to the right tenant).
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
    });

    return NextResponse.json({
      id: membership.workspace.id,
      name: membership.workspace.name,
      slug: membership.workspace.slug,
      plan: membership.workspace.plan,
      role: membership.role,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.workspaces.switch_error", { err: error });
    return NextResponse.json({ error: "Failed to switch workspace" }, { status: 500 });
  }
}
