/**
 * P1.4 - Inbox sync trigger.
 * Reads recent inbox messages, matches sender against lead contactEmails,
 * and bumps SalesOpportunity.status to REPLIED → MEETING (heuristic match
 * on subject keywords like "meeting", "call", "schedule").
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { listRecentInboxMessages } from "@/lib/oauth/email-client";
import { internalError } from "@/lib/api-errors";

const LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000; // last 7 days

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId } = await requireUser();
    const { id } = await params;

    const account = await prisma.emailAccount.findFirst({
      where: { id, workspaceId },
      select: { id: true, replyAttributionEnabled: true },
    });
    if (!account) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!account.replyAttributionEnabled) {
      return NextResponse.json(
        { error: "reply_attribution_disabled", message: "Turn on the reply attribution toggle first." },
        { status: 400 },
      );
    }

    const messages = await listRecentInboxMessages(account.id, LOOKBACK_MS);

    // Pull all leads with contact emails for this workspace.
    const leads = await prisma.lead.findMany({
      where: {
        workspaceId,
        websiteAudit: { isNot: null },
      },
      select: {
        id: true,
        websiteAudit: { select: { contactEmails: true } },
        salesOpportunity: { select: { id: true, status: true } },
      },
    });

    const emailToLead = new Map<string, { leadId: string; status: string | null }>();
    for (const lead of leads) {
      const emails = (lead.websiteAudit?.contactEmails as string[] | undefined) || [];
      for (const e of emails) {
        if (typeof e === "string") {
          emailToLead.set(e.toLowerCase(), {
            leadId: lead.id,
            status: lead.salesOpportunity?.status ?? null,
          });
        }
      }
    }

    let attributions = 0;
    for (const msg of messages) {
      const fromEmail = extractEmailAddress(msg.from)?.toLowerCase();
      if (!fromEmail) continue;
      const match = emailToLead.get(fromEmail);
      if (!match) continue;

      const subjectLower = msg.subject.toLowerCase();
      const isMeetingHint =
        subjectLower.includes("meet") ||
        subjectLower.includes("meeting") ||
        subjectLower.includes("appointment") ||
        subjectLower.includes("booking") ||
        subjectLower.includes("call") ||
        subjectLower.includes("schedule") ||
        subjectLower.includes("randevu") ||
        subjectLower.includes("görüşme");

      const newStatus = isMeetingHint ? "MEETING" : "INTERESTED";
      // Only upgrade, never downgrade.
      if (
        !match.status ||
        match.status === "NEW" ||
        match.status === "CONTACTED" ||
        (match.status === "INTERESTED" && newStatus === "MEETING")
      ) {
        await prisma.salesOpportunity.upsert({
          where: { leadId: match.leadId },
          create: { leadId: match.leadId, status: newStatus },
          update: { status: newStatus },
        });
        attributions += 1;
      }
    }

    await prisma.emailAccount.update({
      where: { id: account.id },
      data: { lastInboxSyncAt: new Date() },
    });

    return NextResponse.json({
      ok: true,
      messagesScanned: messages.length,
      attributions,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.email_accounts.sync_error", err);
  }
}

function extractEmailAddress(headerValue: string): string | null {
  const m = headerValue.match(/<([^>]+)>/);
  if (m) return m[1];
  if (headerValue.includes("@")) return headerValue.trim();
  return null;
}
