import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError, ACTIVE_WORKSPACE_COOKIE } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireUser();
    const { id } = await params;

    const workspace = await prisma.workspace.findUnique({
      where: { id },
      select: { id: true, ownerId: true },
    });

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    if (workspace.ownerId !== session.user.id) {
      return NextResponse.json(
        { error: "Only the workspace owner can delete it." },
        { status: 403 },
      );
    }

    const ownedCount = await prisma.workspace.count({
      where: { ownerId: session.user.id },
    });
    if (ownedCount <= 1) {
      // Guard against users orphaning themselves. requireUser() auto-creates a
      // personal workspace on the next request, but deleting the only one
      // during the same turn would wipe their data with no fallback.
      return NextResponse.json(
        { error: "You must keep at least one workspace." },
        { status: 400 },
      );
    }

    await prisma.workspace.delete({ where: { id } });

    const cookieStore = await cookies();
    if (cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value === id) {
      cookieStore.delete(ACTIVE_WORKSPACE_COOKIE);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.workspaces.delete_error", { err: error });
    return NextResponse.json({ error: "Failed to delete workspace" }, { status: 500 });
  }
}
