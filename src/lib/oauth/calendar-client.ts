/**
 * P1.3 - Calendar event create via Google Calendar / Microsoft Graph.
 *
 * Uses the same EmailAccount OAuth tokens (the OAuth scope set already includes
 * calendar permissions in `OAUTH_SCOPES`). One connected account, three uses
 * (send mail / read inbox / create calendar event).
 */

import { prisma } from "@/lib/prisma";
import { refreshAccessToken } from "./providers";

interface CreateMeetingInput {
  accountId: string;
  summary: string;
  description?: string;
  startsAt: Date;
  durationMinutes: number;
  attendees: string[];
}

async function ensureFreshToken(accountId: string) {
  const account = await prisma.emailAccount.findUniqueOrThrow({
    where: { id: accountId },
  });
  const expired = account.expiresAt && account.expiresAt.getTime() < Date.now() + 30_000;
  if (!expired) return { provider: account.provider, accessToken: account.accessToken };
  const tok = await refreshAccessToken(
    account.provider === "GMAIL" ? "gmail" : "outlook",
    account.refreshToken,
  );
  await prisma.emailAccount.update({
    where: { id: accountId },
    data: {
      accessToken: tok.access_token,
      refreshToken: tok.refresh_token ?? account.refreshToken,
      expiresAt: new Date(Date.now() + tok.expires_in * 1000),
    },
  });
  return { provider: account.provider, accessToken: tok.access_token };
}

export async function createCalendarEvent(input: CreateMeetingInput): Promise<{ eventId: string; htmlLink?: string }> {
  const { provider, accessToken } = await ensureFreshToken(input.accountId);
  const endsAt = new Date(input.startsAt.getTime() + input.durationMinutes * 60_000);

  if (provider === "GMAIL") {
    const body = {
      summary: input.summary,
      description: input.description,
      start: { dateTime: input.startsAt.toISOString() },
      end: { dateTime: endsAt.toISOString() },
      attendees: input.attendees.map((email) => ({ email })),
      conferenceData: {
        createRequest: {
          requestId: `le-${Date.now()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    };
    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      throw new Error(`Google Calendar create failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as { id: string; htmlLink?: string };
    return { eventId: data.id, htmlLink: data.htmlLink };
  }

  // Outlook
  const body = {
    subject: input.summary,
    body: { contentType: "Text", content: input.description ?? "" },
    start: { dateTime: input.startsAt.toISOString(), timeZone: "UTC" },
    end: { dateTime: endsAt.toISOString(), timeZone: "UTC" },
    attendees: input.attendees.map((email) => ({
      emailAddress: { address: email },
      type: "required",
    })),
    isOnlineMeeting: true,
  };
  const res = await fetch("https://graph.microsoft.com/v1.0/me/events", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Outlook calendar create failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { id: string; webLink?: string };
  return { eventId: data.id, htmlLink: data.webLink };
}
