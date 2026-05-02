/**
 * Phase 2 — inbox reply attribution.
 *
 * Periodically pulls recent inbox messages from each connected
 * EmailAccount, matches the `From` address to a lead's known contact
 * emails, classifies the message via Gemini (positive / negative /
 * out-of-office / unsubscribe), writes a `EMAIL_REPLIED`
 * LeadActivity, and pauses any active sequence so the rep doesn't
 * keep sending into a live conversation.
 *
 * Designed to be invoked from a `inbox_sync` job on the agent-runs
 * queue (per workspace), but can also be driven manually from a
 * /api/sequences/inbox-sync admin endpoint for FineDine to validate
 * during pilot. We deliberately stay polling-based for now — Resend
 * webhooks only cover delivery / opens, not actual replies, and
 * IMAP idle on Gmail/Outlook needs more infra than we want to ship
 * for the FineDine pilot.
 */
import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { listRecentInboxMessages } from "@/lib/oauth/email-client";
import { pauseSequenceForReply } from "./step";
import { generateWithTimeout } from "@/lib/gemini-client";

interface ClassifyOutput {
  classification: "POSITIVE" | "NEGATIVE" | "OUT_OF_OFFICE" | "UNSUBSCRIBE" | "OTHER";
  confidence: number;
  reason: string;
}

const CLASSIFY_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    classification: {
      type: SchemaType.STRING,
      enum: ["POSITIVE", "NEGATIVE", "OUT_OF_OFFICE", "UNSUBSCRIBE", "OTHER"],
    } as Schema,
    confidence: { type: SchemaType.NUMBER },
    reason: { type: SchemaType.STRING },
  },
  required: ["classification", "confidence", "reason"],
};

async function classifyReply(subject: string, fromAddress: string): Promise<ClassifyOutput> {
  const { getGeminiKey } = await import("@/lib/gemini-keys");
  let apiKey: string;
  try {
    apiKey = getGeminiKey();
  } catch {
    return { classification: "OTHER", confidence: 0.4, reason: "no_gemini_key" };
  }

  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({
    model: "gemini-2.0-flash-001",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: CLASSIFY_SCHEMA,
      temperature: 0.2,
      maxOutputTokens: 256,
    },
  });

  const prompt = `Classify the intent of this email reply to a B2B cold-outreach campaign.

From: ${fromAddress}
Subject: ${subject}

Categories:
- POSITIVE: prospect is interested, wants to talk, asks a follow-up question.
- NEGATIVE: prospect declines, says "not interested", "wrong person".
- OUT_OF_OFFICE: auto-reply / vacation / maternity / etc.
- UNSUBSCRIBE: explicit "remove me", "stop emailing me", unsubscribe link click that bounced into a real reply.
- OTHER: spam, ambiguous, internal forward.

Respond with valid JSON only.`;

  try {
    // M22 fix - the bare `model.generateContent(prompt)` call had no
    // wall-clock deadline, so a Gemini stall (overloaded region, TCP
    // hang) would consume the inbox-sync worker slot indefinitely
    // and back up downstream sequence ticks. generateWithTimeout
    // wraps the call in an AbortController + 30s deadline; on
    // timeout it throws RetryableError which we catch below and fall
    // back to OTHER so the worker keeps moving through the inbox.
    const result = await generateWithTimeout(model, prompt, {
      timeoutMs: 30_000,
      label: "inbox_sync.classify",
    });
    const text = result.response.text();
    return JSON.parse(text) as ClassifyOutput;
  } catch (err) {
    logger.warn("inbox_sync.classify_failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    return { classification: "OTHER", confidence: 0.3, reason: "classify_error" };
  }
}

function extractEmailAddress(rfcAddr: string): string | null {
  // "Name <foo@bar.com>" or "foo@bar.com"
  const match = rfcAddr.match(/<([^>]+)>/) || rfcAddr.match(/([^\s,]+@[^\s,]+)/);
  return match ? match[1].trim().toLowerCase() : null;
}

export interface InboxSyncResult {
  scanned: number;
  matched: number;
  classified: number;
  paused: number;
  dnc: number;
}

/**
 * Process a single workspace's inbox sync. Iterates over every
 * connected EmailAccount in the workspace and pulls the last 24h of
 * inbox messages.
 */
export async function syncWorkspaceInbox(
  workspaceId: string,
  options: { sinceMs?: number } = {},
): Promise<InboxSyncResult> {
  const sinceMs = options.sinceMs ?? 24 * 60 * 60 * 1000;
  const result: InboxSyncResult = {
    scanned: 0,
    matched: 0,
    classified: 0,
    paused: 0,
    dnc: 0,
  };

  // EmailAccount has no `status` column; we treat any account that the
  // rep opted into reply attribution for AS the connected set, which is
  // the only set the inbox sync should touch anyway.
  const accounts = await prisma.emailAccount.findMany({
    where: { workspaceId, replyAttributionEnabled: true },
    select: { id: true },
  });

  for (const acc of accounts) {
    let messages: Awaited<ReturnType<typeof listRecentInboxMessages>>;
    try {
      messages = await listRecentInboxMessages(acc.id, sinceMs);
    } catch (err) {
      logger.warn("inbox_sync.list_failed", {
        accountId: acc.id,
        err: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    result.scanned += messages.length;

    for (const msg of messages) {
      const fromAddr = extractEmailAddress(msg.from);
      if (!fromAddr) continue;

      // Match by checking if the WebsiteAudit.contactEmails or
      // the Lead's discovered emails contain this sender. `contactEmails`
      // is a Json column (string[] semantically); use array_contains for
      // the JsonFilter equivalent of the native `has` operator.
      const audit = await prisma.websiteAudit.findFirst({
        where: {
          lead: { workspaceId },
          contactEmails: { array_contains: [fromAddr] },
        },
        include: { lead: { select: { id: true, businessName: true } } },
      });

      if (!audit?.lead) continue;
      result.matched += 1;

      // De-dup: if we already wrote an EMAIL_REPLIED activity for this
      // (lead, externalMessageId) skip. The message id from the
      // provider is stored inside payload.threadId so the index
      // hits.
      const already = await prisma.leadActivity.findFirst({
        where: {
          workspaceId,
          leadId: audit.lead.id,
          kind: "EMAIL_REPLIED",
          payload: { path: ["messageId"], equals: msg.id },
        },
        select: { id: true },
      });
      if (already) continue;

      const classification = await classifyReply(msg.subject, msg.from);
      result.classified += 1;

      await prisma.leadActivity.create({
        data: {
          workspaceId,
          leadId: audit.lead.id,
          kind: "EMAIL_REPLIED",
          payload: {
            messageId: msg.id,
            from: fromAddr,
            subject: msg.subject,
            receivedAt: msg.date.toISOString(),
            classification: classification.classification,
            confidence: classification.confidence,
            reason: classification.reason,
          },
        },
      });

      // Pause active sequences on positive replies — keep nurture
      // running on OOO since the prospect is still in-motion. A
      // negative reply also pauses (don't re-attempt) but doesn't
      // mark DNC unless explicit.
      if (
        classification.classification === "POSITIVE" ||
        classification.classification === "NEGATIVE"
      ) {
        const paused = await pauseSequenceForReply(audit.lead.id, workspaceId);
        if (paused > 0) result.paused += paused;
      }

      // Honour explicit unsubscribe immediately — KVKK / GDPR floor.
      if (classification.classification === "UNSUBSCRIBE") {
        await prisma.lead.update({
          where: { id: audit.lead.id },
          data: {
            dnc: true,
            optedOutAt: new Date(),
            consentSource: "EMAIL_UNSUBSCRIBE",
            consentRecordedAt: new Date(),
          },
        });
        await prisma.leadSequenceState.updateMany({
          where: { leadId: audit.lead.id, workspaceId, state: "ACTIVE" },
          data: {
            state: "PAUSED",
            pausedAt: new Date(),
            pausedReason: "DNC",
          },
        });
        result.dnc += 1;
      }
    }
  }

  logger.info("inbox_sync.workspace.done", { workspaceId, ...result });
  return result;
}
