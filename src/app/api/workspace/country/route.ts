import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const { workspaceId } = await requireUser();
    const ws = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { country: true },
    });
    return NextResponse.json({ country: ws.country });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.workspace.country_get_error", { err: error });
    return NextResponse.json({ error: "Failed to fetch country" }, { status: 500 });
  }
}
