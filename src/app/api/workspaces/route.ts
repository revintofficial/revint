import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError, ACTIVE_WORKSPACE_COOKIE } from "@/lib/auth";
import { logger } from "@/lib/logger";

const MAX_WORKSPACES_PER_USER = 10;

function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
}

export async function GET() {
  try {
    const session = await requireUser();

    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: session.user.id },
      include: { workspace: true },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      activeWorkspaceId: session.workspaceId,
      workspaces: memberships.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        slug: m.workspace.slug,
        plan: m.workspace.plan,
        role: m.role,
      })),
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.workspaces.list_error", { err: error });
    return NextResponse.json({ error: "Failed to list workspaces" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireUser();
    const body = (await request.json()) as { name?: string };
    const name = body.name?.trim();

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (name.length > 60) {
      return NextResponse.json({ error: "Name is too long" }, { status: 400 });
    }

    const ownedCount = await prisma.workspace.count({
      where: { ownerId: session.user.id },
    });
    if (ownedCount >= MAX_WORKSPACES_PER_USER) {
      return NextResponse.json(
        { error: `You can own at most ${MAX_WORKSPACES_PER_USER} workspaces.` },
        { status: 400 },
      );
    }

    const baseSlug = slugify(name) || "workspace";
    let slug = baseSlug;
    let attempt = 0;
    while (await prisma.workspace.findUnique({ where: { slug } })) {
      attempt++;
      slug = `${baseSlug}-${attempt}`;
      if (attempt > 50) {
        return NextResponse.json({ error: "Could not allocate a slug" }, { status: 500 });
      }
    }

    const workspace = await prisma.workspace.create({
      data: {
        name,
        slug,
        ownerId: session.user.id,
        members: {
          create: { userId: session.user.id, role: "OWNER" },
        },
      },
    });

    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_WORKSPACE_COOKIE, workspace.id, {
      path: "/",
      sameSite: "lax",
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 365,
    });

    return NextResponse.json({
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      plan: workspace.plan,
      role: "OWNER" as const,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.workspaces.create_error", { err: error });
    return NextResponse.json({ error: "Failed to create workspace" }, { status: 500 });
  }
}
