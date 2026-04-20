/**
 * P1.2 - AI sales co-pilot chat API.
 * GET: list last 50 messages.
 * POST: send a new message, get the assistant's reply.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { sendCopilotMessage, CopilotQuotaExceeded } from "@/lib/copilot";
import { checkRateLimit, LIMITS, rateLimitResponse } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const session = await requireUser();
    const messages = await prisma.copilotMessage.findMany({
      where: { workspaceId: session.workspaceId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        role: true,
        content: true,
        leadIds: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ messages: messages.reverse() });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireUser();

    const rl = await checkRateLimit(session.workspaceId, LIMITS.copilot);
    if (!rl.ok) return rateLimitResponse(rl);

    const body = await request.json();
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) {
      return NextResponse.json({ error: "message required" }, { status: 400 });
    }
    if (message.length > 2000) {
      return NextResponse.json({ error: "message too long (max 2000 chars)" }, { status: 400 });
    }

    const result = await sendCopilotMessage({
      workspaceId: session.workspaceId,
      userId: session.user.id,
      workspacePlan: session.workspace.plan,
      message,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof CopilotQuotaExceeded) {
      return NextResponse.json(
        {
          error: "copilot_quota",
          message: `Co-pilot günlük limit doldu (${err.used}/${err.limit}). Yarın sıfırlanır ya da plan yükselt.`,
          used: err.used,
          limit: err.limit,
          upgradeUrl: "/app/settings/billing",
        },
        { status: 402 },
      );
    }
    logger.error("api.copilot.error", { err });
    return NextResponse.json({ error: "Copilot failed", detail: String(err) }, { status: 500 });
  }
}
