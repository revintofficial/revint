/**
 * POST /api/leads/[id]/dispositions
 *
 * Phase 3 — one-tap post-call disposition capture.
 *
 * The lead-detail v2 surface presents a 4-chip overlay
 * (Connected / Voicemail / No-answer / Wrong-#) within 5 minutes of
 * tapping Dial. One tap lands here.
 *
 * Why a separate route from `log-call`:
 * - `log-call` already accepts a `disposition` field but is the heavy
 *   path that advances sequence step, recomputes `nextActionDueAt`,
 *   flips `dnc` on opt-out, and writes a `CALL_LOGGED` activity. The
 *   disposition strip is meant to be an eyes-down one-tap capture
 *   that should NOT silently advance the sequence (e.g. tapping
 *   "wrong number" should not bump the rep to step+1 against the
 *   wrong contact). Instead this route writes a lightweight
 *   `DISPOSITION_LOGGED` activity and updates the read-side fields
 *   the queue strip / leads list sort on.
 * - Reps who want the full call form keep using `log-call`. Both
 *   routes coexist; the activity timeline distinguishes them via the
 *   activity `kind`.
 *
 * MULTI-TENANT SCOPE AUDIT:
 * - `requireUser()` first; trusted `workspaceId`.
 * - `prisma.lead.findFirst({ where: { id, workspaceId } })` re-verifies
 *   ownership before any write. Cross-tenant request returns 404.
 * - All writes scoped to `workspaceId` either directly (LeadActivity)
 *   or via the pre-checked Lead row.
 *
 * BODY: `{ disposition: 'connected'|'voicemail'|'no_answer'|'wrong_number';
 *           calledAt?: ISO }`
 *
 * RETURNS: `{ ok: true, disposition }` (HTTP 200).
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { internalError } from "@/lib/api-errors";
import type { CallDisposition } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DispositionShortcut =
  | "connected"
  | "voicemail"
  | "no_answer"
  | "wrong_number";

const SHORTCUT_TO_ENUM: Record<DispositionShortcut, CallDisposition> = {
  connected: "ANSWERED_INTERESTED",
  voicemail: "VOICEMAIL",
  no_answer: "NO_ANSWER",
  wrong_number: "WRONG_NUMBER",
};

function isShortcut(v: unknown): v is DispositionShortcut {
  return (
    v === "connected" ||
    v === "voicemail" ||
    v === "no_answer" ||
    v === "wrong_number"
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId, user } = await requireUser();
    const { id } = await params;

    const body = (await request.json().catch(() => ({}))) as {
      disposition?: unknown;
      calledAt?: unknown;
    };
    if (!isShortcut(body?.disposition)) {
      return NextResponse.json(
        {
          error: "Invalid disposition",
          allowed: ["connected", "voicemail", "no_answer", "wrong_number"],
        },
        { status: 400 },
      );
    }
    const shortcut: DispositionShortcut = body.disposition;
    const enumValue = SHORTCUT_TO_ENUM[shortcut];
    const calledAtRaw = typeof body.calledAt === "string" ? body.calledAt : null;
    const calledAt = calledAtRaw ? new Date(calledAtRaw) : new Date();
    if (Number.isNaN(calledAt.getTime())) {
      return NextResponse.json(
        { error: "Invalid calledAt" },
        { status: 400 },
      );
    }

    const lead = await prisma.lead.findFirst({
      where: { id, workspaceId },
      select: { id: true },
    });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.lead.update({
        where: { id },
        data: {
          lastDisposition: enumValue,
          lastContactedAt: calledAt,
        },
      }),
      prisma.leadActivity.create({
        data: {
          workspaceId,
          leadId: id,
          userId: user.id,
          kind: "DISPOSITION_LOGGED",
          payload: {
            disposition: enumValue,
            shortcut,
            calledAt: calledAt.toISOString(),
          },
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      disposition: shortcut,
      mappedTo: enumValue,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.leads.dispositions.POST", err);
  }
}
