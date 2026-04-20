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
    const member = await prisma.workspaceMember.findUnique({ where: { id } });
    if (!member || member.workspaceId !== session.workspaceId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (member.role === "OWNER") {
      return NextResponse.json({ error: "Cannot remove owner" }, { status: 400 });
    }
    await prisma.workspaceMember.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.team.member_delete_error", { err: error });
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }
}
