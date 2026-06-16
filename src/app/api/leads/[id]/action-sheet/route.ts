/**
 * FineDine v1 update — call-first Action Sheet payload.
 *
 * Lightweight endpoint the `LeadActionSheet` component fetches on mount.
 * Returns the same `actionSheet` block the main lead route embeds, but
 * without the heavy audit/review includes — so the header can render and
 * refresh independently after a disposition / qualification change.
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { internalError } from "@/lib/api-errors";
import { buildActionSheet } from "@/lib/playbook/action-sheet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId } = await requireUser();
    const { id } = await params;
    const actionSheet = await buildActionSheet(prisma, workspaceId, id);
    if (!actionSheet) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    return NextResponse.json({ actionSheet });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.leads.action_sheet.GET", err);
  }
}
