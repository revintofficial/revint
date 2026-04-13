import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { done, text } = body;

    const data: Record<string, unknown> = {};
    if (typeof done === "boolean") data.done = done;
    if (typeof text === "string" && text.trim()) data.text = text.trim();

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "Nothing to update" },
        { status: 400 }
      );
    }

    const todo = await prisma.teamTodo.update({
      where: { id },
      data,
    });

    return NextResponse.json(todo);
  } catch (error) {
    console.error("Todo update error:", error);
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
    const { id } = await params;

    await prisma.teamTodo.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Todo delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete todo", details: String(error) },
      { status: 500 }
    );
  }
}
