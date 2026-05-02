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
import type { AgentWorkerKind, EventKind, Plan } from "@/generated/prisma/client";
import {
  ApifyBudgetExceededError,
  PerLeadDailyCapExceededError,
  PlanTooLowError,
  QuotaExceededError,
  assertWorkerQuota,
} from "@/lib/agent-workers/quota";

const BULK_EVENTS: ReadonlySet<EventKind> = new Set<EventKind>([
  "user_one_click_pitch",
  "user_deep_research",
  "user_receptionist_with_kb",
]);

/**
 * The "headline" worker we gate the bulk emit on for each chain. We
 * only check ONE worker per lead instead of every step in the chain
 * because (a) per-lead daily cap and per-workspace budget caps catch
 * runaways further down the DAG and (b) checking every step here would
 * race the orchestrator's own quota gate without adding safety. The
 * headline worker is the most expensive / most user-visible step, so a
 * 402 here gives the UI a precise upgrade prompt before any work fans
 * out.
 */
const BULK_EVENT_GATE: Record<
  "user_one_click_pitch" | "user_deep_research" | "user_receptionist_with_kb",
  AgentWorkerKind
> = {
  user_one_click_pitch: "WEBSITE_MOCKUP_GENERATOR",
  user_deep_research: "APIFY_GMAPS_DEEP",
  user_receptionist_with_kb: "AI_RECEPTIONIST_BUILDER",
};

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

  // M1 fix - the bulk endpoint used to emit chains for every lead in the
  // request without consulting quota first. A workspace at 0 remaining
  // mockups could fire 50 emit() calls, queue 50 PlannerSession rows,
  // and only fail at the quota gate inside the orchestrator -- by which
  // point the cycle counters were already polluted with stuck
  // PENDING/RUNNING rows. We now check the headline worker quota per
  // lead and surface 402-style errors in the per-lead result, returning
  // 207 Multi-Status when the request was a partial success.
  const gateKind = BULK_EVENT_GATE[event as keyof typeof BULK_EVENT_GATE];
  const plan = (session.workspace.plan as Plan) ?? "FREE";

  const sessions: Array<{
    leadId: string;
    sessionId?: string;
    error?: string;
    status?: number;
  }> = [];
  let anyEmitted = false;
  let anyDenied = false;

  for (const leadId of ids) {
    if (!ownedSet.has(leadId)) {
      sessions.push({ leadId, error: "not_in_workspace" });
      continue;
    }
    if (gateKind) {
      try {
        await assertWorkerQuota({
          workspaceId: session.workspaceId,
          plan,
          kind: gateKind,
          leadId,
        });
      } catch (err) {
        if (
          err instanceof QuotaExceededError ||
          err instanceof PlanTooLowError ||
          err instanceof ApifyBudgetExceededError ||
          err instanceof PerLeadDailyCapExceededError
        ) {
          sessions.push({ leadId, error: err.message, status: err.status });
          anyDenied = true;
          continue;
        }
        throw err;
      }
    }
    try {
      const sessionId = await emit(event as EventKind, {
        workspaceId: session.workspaceId,
        userId: session.user.id,
        leadId,
      });
      sessions.push({ leadId, sessionId });
      anyEmitted = true;
    } catch (err) {
      sessions.push({
        leadId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 402 only when EVERY eligible lead was denied for quota reasons
  // (so the UI can show a single upgrade prompt). 207 when there was a
  // mix of quota denials and successes, signalling partial fulfillment
  // explicitly. Otherwise keep the existing 200 contract — callers
  // already inspect per-lead `error` strings for non-quota failures
  // (not_in_workspace, emit errors), and changing that to 207 would
  // break any UI that branches on `res.ok`.
  let status = 200;
  if (anyDenied && anyEmitted) {
    status = 207;
  } else if (anyDenied && !anyEmitted) {
    status = 402;
  }

  return NextResponse.json({ sessions }, { status });
});
