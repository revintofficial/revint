import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function POST() {
  try {
    const { workspaceId } = await requireUser();
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { onboardingCompletedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.onboarding.complete_error", { err: error });
    return NextResponse.json({ error: "Failed to complete onboarding" }, { status: 500 });
  }
}
