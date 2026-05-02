import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireUser();
    if (session.role !== "OWNER" && session.role !== "ADMIN") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }
    const { id } = await params;
    // L2 fix - the previous lookup used `findUnique({id})` then
    // post-checked `member.workspaceId !== session.workspaceId`.
    // That pattern leaks info on timing (the post-check 404 takes
    // longer than the workspace-scoped 404) and is a classic IDOR
    // shape: any future PR that drops the post-check would expose
    // every workspace's membership table. The clean version keys
    // on (id, workspaceId) so cross-tenant rows never come back.
    const member = await prisma.workspaceMember.findFirst({
      where: { id, workspaceId: session.workspaceId },
    });
    if (!member) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (member.role === "OWNER") {
      return NextResponse.json({ error: "Cannot remove owner" }, { status: 400 });
    }
    // Same pattern on the delete path: scope on (id, workspaceId)
    // so a stale id from a deleted member doesn't accidentally
    // delete a row from another tenant.
    await prisma.workspaceMember.deleteMany({
      where: { id, workspaceId: session.workspaceId },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.team.member_delete_error", { err: error });
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }
}
