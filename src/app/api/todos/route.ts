import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const todos = await prisma.teamTodo.findMany({
      orderBy: [{ column: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    });

    const byColumn: Record<string, typeof todos> = {};
    for (const todo of todos) {
      if (!byColumn[todo.column]) byColumn[todo.column] = [];
      byColumn[todo.column].push(todo);
    }

    return NextResponse.json({ todos: byColumn });
  } catch (error) {
    console.error("Todos fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch todos", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { column, text } = body;

    if (!column || !text?.trim()) {
      return NextResponse.json(
        { error: "column and text are required" },
        { status: 400 }
      );
    }

    const maxOrder = await prisma.teamTodo.aggregate({
      where: { column },
      _max: { sortOrder: true },
    });

    const todo = await prisma.teamTodo.create({
      data: {
        column,
        text: text.trim(),
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });

    return NextResponse.json(todo, { status: 201 });
  } catch (error) {
    console.error("Todo create error:", error);
    return NextResponse.json(
      { error: "Failed to create todo", details: String(error) },
      { status: 500 }
    );
  }
}
