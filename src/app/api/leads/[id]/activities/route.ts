/**
 * FineDine v1 update — lead activity timeline (call attempt history).
 *
 * Powers the Action Sheet "Call Attempt History" block: a chronological
 * feed of CALL_LOGGED / DISPOSITION_LOGGED / NOTE / STATUS_CHANGED /
 * MEETING_BOOKED activities. Scoped by workspace + lead.
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { internalError } from "@/lib/api-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId } = await requireUser();
    const { id } = await params;
    const lead = await prisma.lead.findFirst({
      where: { id, workspaceId },
      select: { id: true, nextActionDueAt: true, lastContactedAt: true },
    });
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    const activities = await prisma.leadActivity.findMany({
      where: { workspaceId, leadId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        kind: true,
        payload: true,
        userId: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      activities: activities.map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
      })),
      nextActionDueAt: lead.nextActionDueAt?.toISOString() ?? null,
      lastContactedAt: lead.lastContactedAt?.toISOString() ?? null,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.leads.activities.GET", err);
  }
}
