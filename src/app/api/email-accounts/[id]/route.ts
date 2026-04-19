/**
 * P1.1 / P1.4 - Email account: PATCH (toggle reply attribution) / DELETE.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";

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
      select: { id: true },
    });
    if (!account) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
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

    const updated = await prisma.emailAccount.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Email account PATCH error:", err);
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
      select: { id: true },
    });
    if (!account) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await prisma.emailAccount.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Email account DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
