/**
 * POST /api/leads/[id]/mark-outcome
 *
 * Transitions a lead's SalesOpportunity.status to one of the
 * outcome terminals (INTERESTED / MEETING / WON / LOST) and fires
 * the `inbox_reply_received` chain. The chain runs the Phase-1
 * INBOX_REPLY_ATTRIBUTOR stub, then the sentinel writes the
 * appropriate OPENER_SUCCESS or OPENER_FAILURE memory row so the
 * workspace learns from the outcome.
 *
 * This is a manual bridge until the full Gmail / Outlook inbox-sync
 * worker ships and auto-detects replies.
 *
 * Body: { status: "INTERESTED" | "MEETING" | "WON" | "LOST" }
 * Response: 200 { sessionId, status }
 */
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { emit } from "@/lib/ai-core/events";
import type { OutreachStatus } from "@/generated/prisma/client";

const VALID: ReadonlySet<OutreachStatus> = new Set([
  "INTERESTED",
  "MEETING",
  "WON",
  "LOST",
]);

export const POST = withAuth(async (session, req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const status = (body as { status?: OutreachStatus })?.status;
  if (!status || !VALID.has(status)) {
    return NextResponse.json(
      { error: "status must be INTERESTED, MEETING, WON, or LOST" },
      { status: 400 },
    );
  }

  const lead = await prisma.lead.findUnique({
    where: { id },
    select: { workspaceId: true, salesOpportunity: { select: { id: true } } },
  });
  if (!lead || lead.workspaceId !== session.workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!lead.salesOpportunity) {
    return NextResponse.json(
      { error: "Lead has no sales opportunity yet; run the intelligence chain first" },
      { status: 409 },
    );
  }

  await prisma.salesOpportunity.update({
    where: { leadId: id },
    data: { status },
  });

  // Fire the chain; the Phase-1 attributor reads the status we just
  // wrote, then the sentinel writes OPENER_SUCCESS or OPENER_FAILURE
  // into SemanticMemory based on that status.
  const sessionId = await emit("inbox_reply_received", {
    workspaceId: session.workspaceId,
    userId: session.user.id,
    leadId: id,
  });

  return NextResponse.json({ sessionId, status });
});
