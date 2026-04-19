/**
 * P1.1 - Direct email send via Gmail API + Microsoft Graph.
 * P1.4 - Inbox sync (Gmail messages.list / Graph mail-folders).
 *
 * Token refresh handled inline; if the stored access token is expired we use
 * the refresh token to mint a new one and persist back to EmailAccount.
 */

import { prisma } from "@/lib/prisma";
import { refreshAccessToken } from "./providers";
import type { EmailProvider } from "@/generated/prisma/client";

interface SendEmailInput {
  accountId: string;
  to: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
}

async function ensureFreshToken(accountId: string): Promise<{ provider: EmailProvider; accessToken: string; email: string }> {
  const account = await prisma.emailAccount.findUniqueOrThrow({
    where: { id: accountId },
  });

  const isExpired = account.expiresAt && account.expiresAt.getTime() < Date.now() + 30_000;
  if (!isExpired) {
    return { provider: account.provider, accessToken: account.accessToken, email: account.email };
  }

  const tok = await refreshAccessToken(
    account.provider === "GMAIL" ? "gmail" : "outlook",
    account.refreshToken,
  );
  const newExpiresAt = new Date(Date.now() + tok.expires_in * 1000);
  await prisma.emailAccount.update({
    where: { id: accountId },
    data: {
      accessToken: tok.access_token,
      refreshToken: tok.refresh_token ?? account.refreshToken,
      expiresAt: newExpiresAt,
    },
  });
  return { provider: account.provider, accessToken: tok.access_token, email: account.email };
}

export async function sendEmail(input: SendEmailInput): Promise<{ messageId: string }> {
  const { provider, accessToken, email: from } = await ensureFreshToken(input.accountId);

  if (provider === "GMAIL") {
    return sendGmail({ ...input, accessToken, from });
  }
  return sendOutlook({ ...input, accessToken, from });
}

async function sendGmail(input: SendEmailInput & { accessToken: string; from: string }) {
  const lines = [
    `From: ${input.from}`,
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    "MIME-Version: 1.0",
    `Content-Type: ${input.bodyHtml ? "text/html" : "text/plain"}; charset=UTF-8`,
    "",
    input.bodyHtml || input.bodyText,
  ];
  const raw = Buffer.from(lines.join("\r\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail send failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { id: string };
  return { messageId: data.id };
}

async function sendOutlook(input: SendEmailInput & { accessToken: string; from: string }) {
  const message = {
    message: {
      subject: input.subject,
      body: {
        contentType: input.bodyHtml ? "HTML" : "Text",
        content: input.bodyHtml || input.bodyText,
      },
      toRecipients: [{ emailAddress: { address: input.to } }],
    },
    saveToSentItems: true,
  };
  const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Outlook send failed: ${res.status} ${text}`);
  }
  // Microsoft Graph sendMail does not return a messageId; we synthesize.
  return { messageId: `outlook-${Date.now()}` };
}

/**
 * P1.4 - Inbox sync: list recent inbox messages, look for replies tied to lead
 * email addresses, and update SalesOpportunity.status.
 */
export async function listRecentInboxMessages(
  accountId: string,
  sinceMs: number,
): Promise<
  Array<{ id: string; from: string; subject: string; date: Date }>
> {
  const { provider, accessToken } = await ensureFreshToken(accountId);
  const sinceDate = new Date(Date.now() - sinceMs);

  if (provider === "GMAIL") {
    const q = `after:${Math.floor(sinceDate.getTime() / 1000)} in:inbox`;
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=50`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!listRes.ok) {
      throw new Error(`Gmail list failed: ${listRes.status}`);
    }
    const list = (await listRes.json()) as { messages?: { id: string }[] };
    const messages: Array<{ id: string; from: string; subject: string; date: Date }> = [];
    for (const m of list.messages ?? []) {
      const detail = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!detail.ok) continue;
      const data = (await detail.json()) as {
        id: string;
        payload?: { headers?: { name: string; value: string }[] };
        internalDate?: string;
      };
      const headers = data.payload?.headers ?? [];
      const fromH = headers.find((h) => h.name === "From")?.value ?? "";
      const subjH = headers.find((h) => h.name === "Subject")?.value ?? "";
      const ts = data.internalDate ? new Date(parseInt(data.internalDate, 10)) : new Date();
      messages.push({ id: data.id, from: fromH, subject: subjH, date: ts });
    }
    return messages;
  }

  const isoSince = sinceDate.toISOString();
  const url = `https://graph.microsoft.com/v1.0/me/mailFolders/Inbox/messages?$filter=receivedDateTime ge ${isoSince}&$top=50&$select=id,from,subject,receivedDateTime`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    throw new Error(`Outlook list failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    value?: Array<{
      id: string;
      from?: { emailAddress?: { address: string } };
      subject?: string;
      receivedDateTime?: string;
    }>;
  };
  return (data.value ?? []).map((m) => ({
    id: m.id,
    from: m.from?.emailAddress?.address ?? "",
    subject: m.subject ?? "",
    date: m.receivedDateTime ? new Date(m.receivedDateTime) : new Date(),
  }));
}
