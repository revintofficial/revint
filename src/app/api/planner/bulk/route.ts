/**
 * POST /api/planner/bulk
 *
 * Fans out a chain across many leads at once. Given a list of leadIds
 * and an allowlisted event, emits N separate PlannerSession rows (one
 * per lead). We intentionally do NOT build one giant DAG here: each
 * session can succeed or fail independently, and the orchestrator's
 * concurrency + Gemini rate limiter still governs actual throughput.
 *
 * Body: { event, leadIds: string[] }
 * Response: 200 { sessions: [{ leadId, sessionId, error? }] }
 *
 * Guardrails:
 *   - Max 50 leads per request (protects Gemini token quota).
 *   - Every lead id is verified to belong to the caller's workspace.
 */
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { emit } from "@/lib/ai-core/events";
import type { EventKind } from "@/lib/agent-workers/types";

const BULK_EVENTS: ReadonlySet<EventKind> = new Set<EventKind>([
  "user_one_click_pitch",
  "user_deep_research",
  "user_receptionist_with_kb",
]);

const MAX_LEADS_PER_REQUEST = 50;

export const POST = withAuth(async (session, req: Request) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { event, leadIds } = (body ?? {}) as {
    event?: string;
    leadIds?: unknown;
  };

  if (!event || !BULK_EVENTS.has(event as EventKind)) {
    return NextResponse.json(
      { error: `Event ${event} not allowed for bulk` },
      { status: 400 },
    );
  }

  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return NextResponse.json({ error: "leadIds must be a non-empty array" }, { status: 400 });
  }

  const ids = leadIds.filter((x): x is string => typeof x === "string");
  if (ids.length > MAX_LEADS_PER_REQUEST) {
    return NextResponse.json(
      { error: `Max ${MAX_LEADS_PER_REQUEST} leads per request` },
      { status: 400 },
    );
  }

  // Validate ownership in one query rather than per-lead.
  const leads = await prisma.lead.findMany({
    where: { id: { in: ids }, workspaceId: session.workspaceId },
    select: { id: true },
  });
  const ownedSet = new Set(leads.map((l) => l.id));

  const sessions: Array<{ leadId: string; sessionId?: string; error?: string }> = [];
  for (const leadId of ids) {
    if (!ownedSet.has(leadId)) {
      sessions.push({ leadId, error: "not_in_workspace" });
      continue;
    }
    try {
      const sessionId = await emit(event as EventKind, {
        workspaceId: session.workspaceId,
        userId: session.user.id,
        leadId,
      });
      sessions.push({ leadId, sessionId });
    } catch (err) {
      sessions.push({
        leadId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ sessions });
});
