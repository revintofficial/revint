import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";

export async function PATCH(request: Request) {
  try {
    const session = await requireUser();
    if (session.role !== "OWNER" && session.role !== "ADMIN") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }
    const { name, slug } = await request.json();
    if (!name?.trim() || !slug?.trim()) {
      return NextResponse.json({ error: "Name and slug are required" }, { status: 400 });
    }
    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 32);

    if (cleanSlug !== session.workspace.slug) {
      const exists = await prisma.workspace.findUnique({ where: { slug: cleanSlug } });
      if (exists) {
        return NextResponse.json({ error: "Slug is taken" }, { status: 409 });
      }
    }

    const updated = await prisma.workspace.update({
      where: { id: session.workspaceId },
      data: { name: name.trim(), slug: cleanSlug },
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Workspace update error:", error);
    return NextResponse.json({ error: "Failed to update workspace" }, { status: 500 });
  }
}
