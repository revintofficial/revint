/**
 * P0.7 - Voice notes light: delete a single note.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId } = await requireUser();
    const { id } = await params;

    const note = await prisma.voiceNote.findFirst({
      where: { id, workspaceId },
      select: { id: true },
    });
    if (!note) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.voiceNote.delete({ where: { id: note.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.voice_notes.delete_error", { err: error });
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
