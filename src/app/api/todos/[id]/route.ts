import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { workspaceId } = await requireUser();
    const { id } = await params;
    const body = await request.json();
    const { done, text } = body;

    const data: Record<string, unknown> = {};
    if (typeof done === "boolean") data.done = done;
    if (typeof text === "string" && text.trim()) data.text = text.trim();

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const result = await prisma.teamTodo.updateMany({
      where: { id, workspaceId },
      data,
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "Todo not found" }, { status: 404 });
    }

    // L1 fix - re-fetch via findFirst with workspaceId scope. The
    // earlier updateMany already gates the write, but using
    // findUnique({id}) for the response payload was an IDOR shape
    // (a future PR removing the updateMany guard would silently
    // leak the row). Belt-and-braces the read so the pattern stays
    // consistent across the codebase.
    const todo = await prisma.teamTodo.findFirst({
      where: { id, workspaceId },
    });
    return NextResponse.json(todo);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.todos.update_error", { err: error });
    return NextResponse.json(
      { error: "Failed to update todo", details: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { workspaceId } = await requireUser();
    const { id } = await params;

    const result = await prisma.teamTodo.deleteMany({
      where: { id, workspaceId },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "Todo not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.todos.delete_error", { err: error });
    return NextResponse.json(
      { error: "Failed to delete todo", details: String(error) },
      { status: 500 }
    );
  }
}
