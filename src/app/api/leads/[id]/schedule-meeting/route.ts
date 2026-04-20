/**
 * P1.3 - Calendar sync: schedule a meeting with a lead.
 * Creates a Google Calendar / Outlook event and writes nextMeetingAt +
 * meetingProvider + meetingEventId onto WatchlistItem.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { createCalendarEvent } from "@/lib/oauth/calendar-client";
import { logger } from "@/lib/logger";

interface ScheduleBody {
  accountId: string;
  startsAt: string;
  durationMinutes?: number;
  summary?: string;
  attendeeEmail?: string;
  description?: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireUser();
    const { id: leadId } = await params;
    const body = (await request.json()) as ScheduleBody;

    if (!body.accountId || !body.startsAt) {
      return NextResponse.json(
        { error: "accountId and startsAt required" },
        { status: 400 },
      );
    }

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, workspaceId: session.workspaceId },
      select: {
        id: true,
        businessName: true,
        watchlistItem: { select: { id: true } },
        websiteAudit: { select: { contactEmails: true } },
      },
    });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const account = await prisma.emailAccount.findFirst({
      where: { id: body.accountId, workspaceId: session.workspaceId },
      select: { id: true, provider: true },
    });
    if (!account) {
      return NextResponse.json({ error: "Email account not found" }, { status: 404 });
    }

    const attendeeEmail = body.attendeeEmail
      ?? ((lead.websiteAudit?.contactEmails as string[] | undefined) || [])[0]
      ?? "";

    const startsAt = new Date(body.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      return NextResponse.json({ error: "startsAt must be a valid ISO date" }, { status: 400 });
    }

    const event = await createCalendarEvent({
      accountId: account.id,
      summary: body.summary || `Meeting · ${lead.businessName}`,
      description: body.description,
      startsAt,
      durationMinutes: body.durationMinutes ?? 30,
      attendees: attendeeEmail ? [attendeeEmail] : [],
    });

    // Ensure WatchlistItem exists and update meeting fields.
    const watchlistItemId = lead.watchlistItem?.id
      ?? (await prisma.watchlistItem.create({ data: { leadId } })).id;

    await prisma.watchlistItem.update({
      where: { id: watchlistItemId },
      data: {
        nextMeetingAt: startsAt,
        meetingProvider: account.provider,
        meetingEventId: event.eventId,
      },
    });

    // Bump status to MEETING.
    await prisma.salesOpportunity.upsert({
      where: { leadId },
      create: { leadId, status: "MEETING" },
      update: { status: "MEETING" },
    });

    return NextResponse.json({ ok: true, eventId: event.eventId, htmlLink: event.htmlLink });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.leads.schedule_meeting_error", { err });
    return NextResponse.json(
      { error: "Failed to schedule", detail: String(err) },
      { status: 500 },
    );
  }
}
