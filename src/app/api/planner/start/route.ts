/**
 * POST /api/planner/start
 *
 * Starts an AI Core chain via the event bus. The UI uses this for
 * the "one-click pitch pack", "deep research", and "receptionist
 * with knowledge base" buttons on the lead detail page.
 *
 * Body: { event, leadId?, inputs? }
 *   event: one of the allowlisted user-initiated EventKind values
 *   leadId: required when the event is lead-scoped (all current ones)
 *   inputs: passed through to the first step's AgentRun.inputsJson
 *
 * Response:
 *   200 { sessionId } on success
 *   400 { error } on unknown event or missing leadId
 *   402 { error } if the workspace hit an Apify USD cap (for deep research)
 *   403 { error } if the lead does not belong to this workspace
 *   500 { error } on planner failure
 */
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { emit } from "@/lib/ai-core/events";
import type { EventKind } from "@/lib/agent-workers/types";

// Allowlist of events the UI is allowed to fire. Internal events like
// `lead_created` and `inbox_reply_received` are emitted by server-side
// code only; exposing them here would let a client trigger the full
// intelligence chain on any lead id.
//
// `user_bulk_pitch` is intentionally NOT here: bulk fan-out goes through
// /api/planner/bulk (one PlannerSession per lead), because no chain in
// chains.ts is registered for `user_bulk_pitch` and emitting it would
// throw "no chain registered".
const USER_EVENTS: ReadonlySet<EventKind> = new Set<EventKind>([
  "user_one_click_pitch",
  "user_deep_research",
  "user_receptionist_with_kb",
]);

export const POST = withAuth(async (session, req: Request) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { event, leadId, inputs } = (body ?? {}) as {
    event?: string;
    leadId?: string;
    inputs?: Record<string, unknown>;
  };

  if (!event || !USER_EVENTS.has(event as EventKind)) {
    return NextResponse.json(
      { error: `Unknown or disallowed event: ${event}` },
      { status: 400 },
    );
  }

  // All events here are lead-scoped; leadId must exist in the caller's
  // workspace. Bulk fan-out is handled by /api/planner/bulk.
  if (!leadId) {
    return NextResponse.json({ error: "leadId required" }, { status: 400 });
  }
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { workspaceId: true },
  });
  if (!lead || lead.workspaceId !== session.workspaceId) {
    return NextResponse.json(
      { error: "Lead not found in workspace" },
      { status: 403 },
    );
  }

  try {
    const sessionId = await emit(event as EventKind, {
      workspaceId: session.workspaceId,
      userId: session.user.id,
      leadId: leadId ?? null,
      inputs,
    });
    return NextResponse.json({ sessionId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Planner failed", detail: msg }, { status: 500 });
  }
});
