import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { logger } from "@/lib/logger";

interface DncBody {
  dnc: boolean;
  reason?: string;
}

/**
 * Manual DNC toggle for a lead. Used by the rep when a contact says
 * "stop emailing me" outside of a phone-call disposition flow, or
 * when a manager has to flag a lead for KVKK / GDPR reasons after
 * the fact.
 *
 * Logs a `CONSENT_RECORDED` (opt-out) or generic `STATUS_CHANGED`
 * activity so we have an immutable audit trail of who flipped the
 * flag and when. The /api/leads/[id]/send-email route reads
 * `lead.dnc` and refuses to send when true — this endpoint is the
 * canonical write path.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId, user } = await requireUser();
    const { id } = await params;
    const body = (await request.json()) as DncBody;

    if (typeof body.dnc !== "boolean") {
      return NextResponse.json({ error: "dnc must be boolean" }, { status: 400 });
    }

    const lead = await prisma.lead.findFirst({
      where: { id, workspaceId },
      select: { id: true, dnc: true },
    });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const now = new Date();

    await prisma.$transaction([
      prisma.lead.update({
        where: { id },
        data: {
          dnc: body.dnc,
          optedOutAt: body.dnc ? now : null,
          consentSource: body.dnc ? "MANUAL_OPT_OUT" : undefined,
          consentRecordedAt: body.dnc ? now : undefined,
        },
      }),
      prisma.leadActivity.create({
        data: {
          workspaceId,
          leadId: id,
          userId: user.id,
          kind: "CONSENT_RECORDED",
          payload: {
            dnc: body.dnc,
            reason: body.reason ?? null,
            previousDnc: lead.dnc,
          },
        },
      }),
    ]);

    logger.info("api.leads.dnc.toggled", {
      leadId: id,
      workspaceId,
      dnc: body.dnc,
    });

    return NextResponse.json({ ok: true, dnc: body.dnc });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.leads.dnc.error", { err: error });
    return NextResponse.json({ error: "Failed to update DNC" }, { status: 500 });
  }
}
