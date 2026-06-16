import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { enqueueCrmWriteback } from "@/lib/integrations/hubspot/writeback";
import type { CallDisposition } from "@/generated/prisma/client";

const VALID_DISPOSITIONS: CallDisposition[] = [
  "ANSWERED_INTERESTED",
  "ANSWERED_NOT_INTERESTED",
  "VOICEMAIL",
  "NO_ANSWER",
  "WRONG_NUMBER",
  "BOOKED_MEETING",
  "OPTED_OUT",
];

/**
 * Phase 1 — log a call outcome.
 *
 * Writes a `LeadActivity` row (kind = CALL_LOGGED) and updates the
 * Lead aggregate fields the leads list / Today's Queue / dashboard
 * read off:
 *   - lastContactedAt = now()
 *   - lastDisposition = disposition
 *   - nextActionDueAt depends on disposition (re-attempt cadence)
 *   - dnc = true when disposition is OPTED_OUT (KVKK / GDPR)
 *   - sequenceStep += 1 when disposition advances the sequence
 *
 * Body: { disposition: CallDisposition, notes?: string, durationSec?: number }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId, user } = await requireUser();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const disposition = String(body.disposition ?? "") as CallDisposition;
    const notes = typeof body.notes === "string" ? body.notes.trim() : null;
    const durationSec = typeof body.durationSec === "number" ? body.durationSec : null;

    if (!VALID_DISPOSITIONS.includes(disposition)) {
      return NextResponse.json(
        { error: "Invalid disposition", allowed: VALID_DISPOSITIONS },
        { status: 400 },
      );
    }

    const lead = await prisma.lead.findFirst({
      where: { id, workspaceId },
      select: { id: true, sequenceStep: true, dnc: true },
    });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const now = new Date();
    let nextActionDueAt: Date | null = null;
    switch (disposition) {
      case "VOICEMAIL":
      case "NO_ANSWER":
        // Try again tomorrow.
        nextActionDueAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        break;
      case "ANSWERED_INTERESTED":
        // Follow up in 2 business days.
        nextActionDueAt = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
        break;
      case "BOOKED_MEETING":
        // Meeting takes priority; don't auto-schedule another touch.
        nextActionDueAt = null;
        break;
      case "ANSWERED_NOT_INTERESTED":
      case "OPTED_OUT":
      case "WRONG_NUMBER":
        nextActionDueAt = null;
        break;
    }

    const isOptOut = disposition === "OPTED_OUT";
    const advanceSequence =
      disposition === "VOICEMAIL" ||
      disposition === "NO_ANSWER" ||
      disposition === "ANSWERED_INTERESTED";

    await prisma.$transaction([
      prisma.lead.update({
        where: { id },
        data: {
          lastContactedAt: now,
          lastDisposition: disposition,
          nextActionDueAt,
          ...(advanceSequence ? { sequenceStep: lead.sequenceStep + 1 } : {}),
          ...(isOptOut ? { dnc: true, optedOutAt: now } : {}),
        },
      }),
      prisma.leadActivity.create({
        data: {
          workspaceId,
          leadId: id,
          userId: user.id,
          kind: "CALL_LOGGED",
          payload: {
            disposition,
            notes,
            durationSec,
          },
        },
      }),
      ...(isOptOut
        ? [
            prisma.leadActivity.create({
              data: {
                workspaceId,
                leadId: id,
                userId: user.id,
                kind: "CONSENT_RECORDED",
                payload: {
                  source: "OPT_OUT_FROM_CALL",
                },
              },
            }),
          ]
        : []),
    ]);

    logger.info("api.leads.log_call.ok", {
      leadId: id,
      workspaceId,
      disposition,
      isOptOut,
    });

    // FineDine v1 update — push the disposition + a call engagement to
    // HubSpot (best-effort, idempotent outbox). Never blocks the response.
    void enqueueCrmWriteback(prisma, {
      workspaceId,
      leadId: id,
      reason: "disposition",
      engagementNote: `Call logged: ${disposition}${notes ? ` — ${notes}` : ""}`,
    }).catch(() => {});

    return NextResponse.json({ ok: true, disposition, nextActionDueAt });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.leads.log_call.error", { err: error });
    return NextResponse.json({ error: "Failed to log call" }, { status: 500 });
  }
}
