import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { internalError } from "@/lib/api-errors";

export async function GET() {
  try {
    const { workspaceId } = await requireUser();
    const todos = await prisma.teamTodo.findMany({
      where: { workspaceId },
      orderBy: [{ column: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    });

    const byColumn: Record<string, typeof todos> = {};
    for (const todo of todos) {
      if (!byColumn[todo.column]) byColumn[todo.column] = [];
      byColumn[todo.column].push(todo);
    }

    return NextResponse.json({ todos: byColumn });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.todos.fetch_error", error);
  }
}

export async function POST(request: Request) {
  try {
    const { workspaceId } = await requireUser();
    const body = await request.json();
    const { column, text } = body;

    if (!column || !text?.trim()) {
      return NextResponse.json(
        { error: "column and text are required" },
        { status: 400 }
      );
    }

    const maxOrder = await prisma.teamTodo.aggregate({
      where: { workspaceId, column },
      _max: { sortOrder: true },
    });

    const todo = await prisma.teamTodo.create({
      data: {
        workspaceId,
        column,
        text: text.trim(),
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });

    return NextResponse.json(todo, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.todos.create_error", { err: error });
    return NextResponse.json(
      { error: "Failed to create todo", details: String(error) },
      { status: 500 }
    );
  }
}
