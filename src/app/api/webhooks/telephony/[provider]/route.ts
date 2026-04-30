import { NextResponse } from "next/server";
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
 *   /api/webhooks/telephony/{provider}?token=<TELEPHONY_WEBHOOK_TOKEN>
 *
 * We:
 *   1. Verify a static shared token (TELEPHONY_WEBHOOK_TOKEN env var).
 *      Twilio's official X-Twilio-Signature HMAC verification is
 *      better but requires storing the auth token per-workspace; the
 *      shared-secret model lets the FineDine pilot ship in hours
 *      instead of weeks. Upgrade path is well-known.
 *   2. Normalize the payload to a `CallEvent`.
 *   3. Match the prospect phone to a Lead (workspaceId scoped).
 *   4. Write a CALL_LOGGED LeadActivity, update lastContactedAt /
 *      lastDisposition / nextActionDueAt — same write path as the
 *      manual Log Call modal so dashboards stay consistent.
 *
 * The webhook does NOT auto-mark a lead as DNC. Even Twilio "no-answer"
 * status doesn't carry consent intent — that flag stays human-driven
 * via the Log Call disposition modal.
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
    const expected = process.env.TELEPHONY_WEBHOOK_TOKEN;
    if (!expected) {
      logger.warn("api.telephony_webhook.token_unset", { provider });
      return NextResponse.json(
        { error: "telephony webhook token not configured on server" },
        { status: 503 },
      );
    }
    if (!token || token !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspaceId query param required" },
        { status: 400 },
      );
    }

    let payload: Record<string, unknown>;
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      payload = (await request.json()) as Record<string, unknown>;
    } else {
      // Twilio default is application/x-www-form-urlencoded.
      const text = await request.text();
      const params = new URLSearchParams(text);
      payload = Object.fromEntries(params.entries());
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

    // De-dup: a single call generates several webhook hits (ringing,
    // answered, hungup). We key on externalCallId so only the
    // terminal hit becomes an activity.
    const already = await prisma.leadActivity.findFirst({
      where: {
        workspaceId,
        leadId: lead.id,
        kind: "CALL_LOGGED",
        payload: { path: ["externalCallId"], equals: event.externalCallId },
      },
      select: { id: true },
    });
    if (already) {
      return NextResponse.json({ ok: true, deduped: true });
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
