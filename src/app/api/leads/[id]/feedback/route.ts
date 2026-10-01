/**
 * POST /api/leads/[id]/feedback
 *
 * An SDR marks a brief as used or not used. Appends one HumanReview row
 * (lens = null, source = SDR) and one AdminAuditEvent (`sdr.feedback`).
 * The workspace comes from the session, never from the body.
 *
 * Body: { agentRunId: string, used: boolean, reason: SdrReason | null, note: string | null }
 * 200 { ok: true, id }
 * 400 { error } invalid body / unused without a reason / unknown reason / note too long
 * 401 / 403 / 404 { error } via withAuth
 */
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { isSdrReason, recordSdrFeedback } from "@/lib/control/sdr-feedback";

export const runtime = "nodejs";

const MESSAGES: Record<string, string> = {
  "reason required": "Kullanmadıysan bir neden seç.",
  "invalid reason": "Neden geçersiz.",
  "note too long": "Not çok uzun.",
};

export const POST = withAuth(async (session, request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id: leadId } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  const raw = body as Record<string, unknown>;
  const agentRunId = typeof raw.agentRunId === "string" ? raw.agentRunId.trim() : "";
  if (!leadId || !agentRunId || typeof raw.used !== "boolean") {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  if (raw.reason != null && !isSdrReason(raw.reason)) {
    return NextResponse.json({ error: MESSAGES["invalid reason"] }, { status: 400 });
  }
  if (raw.note != null && typeof raw.note !== "string") {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  try {
    const created = await recordSdrFeedback({
      workspaceId: session.workspaceId,
      leadId,
      agentRunId,
      used: raw.used,
      reason: isSdrReason(raw.reason) ? raw.reason : null,
      note: typeof raw.note === "string" ? raw.note : null,
      userId: session.user.id,
    });
    return NextResponse.json({ ok: true, id: created.id });
  } catch (error) {
    if (error instanceof Error && Object.hasOwn(MESSAGES, error.message)) {
      return NextResponse.json({ error: MESSAGES[error.message] }, { status: 400 });
    }
    throw error;
  }
});
