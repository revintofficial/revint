import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  normalizeByProvider,
  type TelephonyProvider,
} from "@/lib/telephony/normalize";

export const runtime = "nodejs";

const VALID_PROVIDERS: TelephonyProvider[] = ["twilio", "aircall", "justcall"];

/**
 * Phase 2 (optional) — universal telephony webhook.
 *
 * Twilio / Aircall / Justcall all POST to:
 *   /api/webhooks/telephony/{provider}?token=<workspace-specific-secret>
 *
 * M12 fix - the workspace is now resolved by the per-workspace
 * `Workspace.telephonyWebhookSecret` (issued once during workspace
 * setup). The legacy "shared TELEPHONY_WEBHOOK_TOKEN env var +
 * `?workspaceId=...` query param" pattern was a cross-tenant footgun:
 * any caller with the global token could claim any workspaceId and
 * write activities into a tenant they don't own. With per-workspace
 * secrets, a leaked token only addresses one tenant and the
 * `workspaceId` claim is provably tied to the secret used.
 *
 * Twilio's official `X-Twilio-Signature` HMAC remains optional;
 * when present we verify it as a defense-in-depth check on top of
 * the per-workspace secret.
 *
 * M13 fix - the de-dup pre-check (findFirst on JSON path
 * `payload.externalCallId`) had a TOCTOU race: two parallel webhook
 * deliveries for the same call could both pass the pre-check and
 * insert duplicate activities. The new schema column
 * `LeadActivity.externalCallId` is constrained by
 * `@@unique([workspaceId, leadId, kind, externalCallId])`, so a
 * duplicate is rejected at the DB layer (P2002) and we map it to
 * a 200 "deduped" response.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    const { provider } = await params;
    if (!VALID_PROVIDERS.includes(provider as TelephonyProvider)) {
      return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
    }

    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // M12 - resolve workspace from the per-workspace secret. We use
    // findFirst (not findUnique) so a wrong/expired token returns
    // null instead of leaking shape info via Prisma errors. The
    // unique index on the column makes this a single-row index hit.
    const workspace = await prisma.workspace.findFirst({
      where: { telephonyWebhookSecret: token },
      select: { id: true },
    });
    if (!workspace) {
      logger.warn("api.telephony_webhook.token_unknown", { provider });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const workspaceId = workspace.id;

    let payload: Record<string, unknown>;
    let rawBody = "";
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      rawBody = await request.text();
      try {
        payload = JSON.parse(rawBody) as Record<string, unknown>;
      } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
      }
    } else {
      // Twilio default is application/x-www-form-urlencoded.
      rawBody = await request.text();
      const params = new URLSearchParams(rawBody);
      payload = Object.fromEntries(params.entries());
    }

    // Optional: Twilio signs every webhook with X-Twilio-Signature
    // (HMAC-SHA1 over the URL + sorted params). When present, we
    // verify it against the per-workspace secret as a second
    // factor. Absent header means the workspace hasn't enabled
    // Twilio signature verification (Aircall / Justcall don't ship
    // a comparable header by default).
    const twilioSig = request.headers.get("x-twilio-signature");
    if (provider === "twilio" && twilioSig) {
      const ok = verifyTwilioSignature(token, request.url, payload, twilioSig);
      if (!ok) {
        logger.warn("api.telephony_webhook.twilio_sig_mismatch", { workspaceId });
        return NextResponse.json({ error: "Signature mismatch" }, { status: 401 });
      }
    }

    const event = normalizeByProvider(provider as TelephonyProvider, payload);
    if (!event) {
      logger.warn("api.telephony_webhook.unrecognized_payload", { provider });
      return NextResponse.json({ ok: true, ignored: true });
    }

    if (!event.disposition) {
      // Mid-call event (call.created, ringing, etc.). Acknowledge but
      // don't write anything — only terminal events become activities.
      return NextResponse.json({ ok: true, accepted: true, terminal: false });
    }

    const phone = event.toNumber || event.fromNumber;
    if (!phone) {
      return NextResponse.json({ ok: true, ignored: "no_phone" });
    }

    const digits = phone.replace(/[^\d]/g, "");
    if (!digits) {
      return NextResponse.json({ ok: true, ignored: "no_digits" });
    }

    // Match by suffix: provider numbers vary in country-code formatting,
    // so we match the last 10-12 digits against any lead in this
    // workspace whose phone column ends with the same suffix.
    const suffix = digits.slice(-10);
    const lead = await prisma.lead.findFirst({
      where: {
        workspaceId,
        phone: { endsWith: suffix },
      },
      select: { id: true, dnc: true },
    });
    if (!lead) {
      logger.info("api.telephony_webhook.no_lead_match", {
        provider,
        workspaceId,
        suffix,
      });
      return NextResponse.json({ ok: true, ignored: "no_lead_match" });
    }

    const now = new Date();
    let nextActionDueAt: Date | null = null;
    switch (event.disposition) {
      case "ANSWERED_INTERESTED":
      case "BOOKED_MEETING":
        nextActionDueAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        break;
      case "VOICEMAIL":
        nextActionDueAt = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
        break;
      case "NO_ANSWER":
        nextActionDueAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        break;
      case "ANSWERED_NOT_INTERESTED":
      case "WRONG_NUMBER":
        nextActionDueAt = null;
        break;
      default:
        nextActionDueAt = null;
    }

    // M13 - rely on the @@unique([workspaceId, leadId, kind,
    // externalCallId]) constraint to enforce idempotency at the DB
    // layer. We attempt the create + lead update in a single
    // transaction; on P2002 we return a clean 200 "deduped" so
    // retries from the provider are absorbed cleanly. (Prisma
    // throws PrismaClientKnownRequestError with code P2002 when a
    // unique constraint trips.)
    try {
      await prisma.$transaction([
        prisma.lead.update({
          where: { id: lead.id },
          data: {
            lastContactedAt: now,
            lastDisposition: event.disposition,
            nextActionDueAt,
            sequenceStep: { increment: 1 },
          },
        }),
        prisma.leadActivity.create({
          data: {
            workspaceId,
            leadId: lead.id,
            kind: "CALL_LOGGED",
            externalCallId: event.externalCallId,
            payload: {
              disposition: event.disposition,
              durationSec: event.durationSec,
              recordingUrl: event.recordingUrl,
              externalCallId: event.externalCallId,
              provider,
              agentExternalId: event.agentExternalId,
              notes: event.notes,
              source: "telephony_webhook",
            },
          },
        }),
      ]);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "P2002") {
        return NextResponse.json({ ok: true, deduped: true });
      }
      throw err;
    }

    logger.info("api.telephony_webhook.logged", {
      provider,
      leadId: lead.id,
      workspaceId,
      disposition: event.disposition,
    });

    return NextResponse.json({
      ok: true,
      leadId: lead.id,
      disposition: event.disposition,
    });
  } catch (err) {
    logger.error("api.telephony_webhook.error", { err });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * Twilio webhook signature (HMAC-SHA1 over `URL + sorted(form params)`).
 * Verifies the request originated from Twilio with the configured
 * auth token. We hash with the per-workspace secret here — operators
 * configure the same value as the Twilio account/auth token so the
 * signature lines up.
 */
function verifyTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, unknown>,
  signature: string,
): boolean {
  // Twilio sorts form params alphabetically by key, concatenates
  // key + value, and prepends the full URL.
  const sortedKeys = Object.keys(params).sort();
  const data =
    url +
    sortedKeys.map((k) => `${k}${String(params[k] ?? "")}`).join("");
  const hmac = createHmac("sha1", authToken).update(data).digest("base64");
  try {
    const a = Buffer.from(hmac);
    const b = Buffer.from(signature);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
