/**
 * P1.1 / P1.4 - Email account: PATCH (toggle reply attribution) / DELETE.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { logger } from "@/lib/logger";

/** Public shape: never return OAuth tokens to the client. */
const PUBLIC_SELECT = {
  id: true,
  workspaceId: true,
  userId: true,
  provider: true,
  email: true,
  expiresAt: true,
  dailyLimit: true,
  sentToday: true,
  resetAt: true,
  replyAttributionEnabled: true,
  lastInboxSyncAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Only the mailbox owner or a workspace OWNER/ADMIN may change or remove it. */
function canManage(
  session: { user: { id: string }; role: string },
  account: { userId: string },
): boolean {
  return account.userId === session.user.id || session.role === "OWNER" || session.role === "ADMIN";
}

interface PatchBody {
  replyAttributionEnabled?: boolean;
  dailyLimit?: number;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const body = (await request.json()) as PatchBody;

    const account = await prisma.emailAccount.findFirst({
      where: { id, workspaceId: session.workspaceId },
      select: { id: true, userId: true },
    });
    if (!account) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!canManage(session, account)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data: PatchBody = {};
    if (typeof body.replyAttributionEnabled === "boolean") {
      data.replyAttributionEnabled = body.replyAttributionEnabled;
    }
    if (typeof body.dailyLimit === "number" && body.dailyLimit > 0 && body.dailyLimit <= 2000) {
      data.dailyLimit = body.dailyLimit;
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const updated = await prisma.emailAccount.update({
      where: { id },
      data,
      select: PUBLIC_SELECT,
    });
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.email_accounts.patch_error", { err });
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const account = await prisma.emailAccount.findFirst({
      where: { id, workspaceId: session.workspaceId },
      select: { id: true, userId: true },
    });
    if (!account) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!canManage(session, account)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await prisma.emailAccount.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.email_accounts.delete_error", { err });
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
