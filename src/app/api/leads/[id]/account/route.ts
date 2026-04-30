import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { logger } from "@/lib/logger";

interface AssignBody {
  accountId: string | null;
}

/**
 * Phase 2 — assign or unassign a lead from an Account rollup.
 *
 * Sending `{ accountId: null }` removes the lead from its current
 * account (the lead becomes standalone again). Both lead and account
 * are workspace-scoped so we double-check before linking, otherwise
 * a malicious caller could attach a lead in their workspace to an
 * Account that belongs to a different one.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId } = await requireUser();
    const { id } = await params;
    const body = (await request.json()) as AssignBody;

    const lead = await prisma.lead.findFirst({
      where: { id, workspaceId },
      select: { id: true },
    });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (body.accountId) {
      const account = await prisma.account.findFirst({
        where: { id: body.accountId, workspaceId, archivedAt: null },
        select: { id: true },
      });
      if (!account) {
        return NextResponse.json({ error: "Account not found" }, { status: 404 });
      }
    }

    const updated = await prisma.lead.update({
      where: { id },
      data: { accountId: body.accountId },
      select: { id: true, accountId: true },
    });

    logger.info("api.leads.account.updated", {
      leadId: id,
      workspaceId,
      accountId: updated.accountId,
    });

    return NextResponse.json({ ok: true, accountId: updated.accountId });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.leads.account.error", { err });
    return NextResponse.json({ error: "Failed to update account" }, { status: 500 });
  }
}
