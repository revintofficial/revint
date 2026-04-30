/**
 * P1.1 - Direct email send: send opener (and optional mockup link) from
 * a connected Gmail/Outlook account, bypassing CSV export to Smartlead.
 *
 * Auto-send stays off by default; this endpoint requires an explicit POST
 * from the user clicking "Send" in the lead detail UI.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { sendEmail } from "@/lib/oauth/email-client";
import { internalError } from "@/lib/api-errors";

interface SendBody {
  accountId: string;
  to: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireUser();
    const { id: leadId } = await params;
    const body = (await request.json()) as SendBody;

    if (!body.accountId || !body.to || !body.subject || !body.bodyText) {
      return NextResponse.json({ error: "accountId, to, subject, bodyText required" }, { status: 400 });
    }

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, workspaceId: session.workspaceId },
      select: { id: true, dnc: true, optedOutAt: true, businessName: true },
    });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // KVKK / GDPR: never let an authenticated rep email a DNC-flagged
    // lead, even if they typed in the address by hand. The lead
    // detail UI already disables the Send button — this is the
    // server-side floor that protects us when the UI lies, when a
    // CSV import dropped DNC, or when a future automation forgets
    // to read the flag.
    if (lead.dnc || lead.optedOutAt) {
      return NextResponse.json(
        {
          error: "dnc_blocked",
          message:
            "This lead is on Do-Not-Contact. Sending email is blocked by KVKK / GDPR rules.",
          businessName: lead.businessName,
        },
        { status: 403 },
      );
    }

    const account = await prisma.emailAccount.findFirst({
      where: { id: body.accountId, workspaceId: session.workspaceId },
      select: { id: true, sentToday: true, dailyLimit: true, resetAt: true },
    });
    if (!account) {
      return NextResponse.json({ error: "Email account not found" }, { status: 404 });
    }

    // Reset daily counter if it has been > 24h since resetAt.
    const now = Date.now();
    let sentToday = account.sentToday;
    if (now - account.resetAt.getTime() > 24 * 60 * 60 * 1000) {
      sentToday = 0;
    }
    if (sentToday >= account.dailyLimit) {
      return NextResponse.json(
        {
          error: "daily_send_limit_reached",
          message: `Daily limit of ${account.dailyLimit} sent emails reached. Resets in 24h.`,
        },
        { status: 429 },
      );
    }

    const result = await sendEmail({
      accountId: account.id,
      to: body.to,
      subject: body.subject,
      bodyText: body.bodyText,
      bodyHtml: body.bodyHtml,
    });

    await prisma.emailAccount.update({
      where: { id: account.id },
      data: {
        sentToday: sentToday + 1,
        resetAt: now - account.resetAt.getTime() > 24 * 60 * 60 * 1000 ? new Date() : account.resetAt,
      },
    });

    // Mark the lead as CONTACTED if it wasn't already.
    await prisma.salesOpportunity.upsert({
      where: { leadId },
      create: { leadId, status: "CONTACTED" },
      update: { status: "CONTACTED" },
    });

    return NextResponse.json({ ok: true, messageId: result.messageId });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.leads.send_email_error", err);
  }
}
