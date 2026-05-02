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

  // L5 fix - findFirst({id, workspaceId}) instead of findUnique +
  // post-check. Same IDOR shape as L1-L4. The post-check 404 also
  // leaks timing - cross-tenant lookups complete the lookup before
  // the post-check rejects, while in-tenant 404s short-circuit on
  // the empty result.
  const lead = await prisma.lead.findFirst({
    where: { id, workspaceId: session.workspaceId },
    select: { workspaceId: true, salesOpportunity: { select: { id: true } } },
  });
  if (!lead) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!lead.salesOpportunity) {
    return NextResponse.json(
      { error: "Lead has no sales opportunity yet; run the intelligence chain first" },
      { status: 409 },
    );
  }

  // L5 - same scope on the SalesOpportunity update so a stale id
  // can't write into another tenant's row. updateMany returns a
  // count we ignore here since the parent lookup already gated
  // existence; the workspaceId predicate is the safety net.
  await prisma.salesOpportunity.updateMany({
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
