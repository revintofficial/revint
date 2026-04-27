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
import { internalError } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";
import { emit } from "@/lib/ai-core/events";
import { getChain } from "@/lib/ai-core/chains";
import {
  assertWorkerQuota,
  PlanTooLowError,
  QuotaExceededError,
  ApifyBudgetExceededError,
  PerLeadDailyCapExceededError,
} from "@/lib/agent-workers/quota";
import type { EventKind } from "@/lib/agent-workers/types";
import type { AgentWorkerKind } from "@/generated/prisma/client";

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

  // Pre-flight quota check. Without this the endpoint returns 200
  // with a sessionId, the session enqueues AgentRun rows, and each
  // one fails with 402 at worker-time -- so the user sees 'running'
  // in the UI for a few seconds and then a silent nothing. By
  // inspecting the chain's required (non-optional) steps up front
  // we can respond 402 synchronously and never create a stillborn
  // session.
  const chain = getChain(event as EventKind);
  if (!chain) {
    return NextResponse.json(
      { error: `No chain registered for event: ${event}` },
      { status: 400 },
    );
  }
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: session.workspaceId },
    select: { plan: true },
  });
  const requiredKinds: AgentWorkerKind[] = Array.from(
    new Set(
      chain
        .filter((s) => !s.optional)
        .map((s) => s.workerKind as AgentWorkerKind),
    ),
  );
  for (const kind of requiredKinds) {
    try {
      await assertWorkerQuota({
        workspaceId: session.workspaceId,
        plan: workspace.plan,
        kind,
        leadId,
      });
    } catch (err) {
      if (err instanceof PlanTooLowError) {
        return NextResponse.json(
          {
            error: "plan_too_low",
            workerKind: err.kind,
            requiredPlan: err.minPlan,
          },
          { status: 402 },
        );
      }
      if (err instanceof ApifyBudgetExceededError) {
        return NextResponse.json(
          {
            error: "apify_budget_exhausted",
            usedCents: err.usedCents,
            limitCents: err.limitCents,
          },
          { status: 402 },
        );
      }
      if (err instanceof PerLeadDailyCapExceededError) {
        return NextResponse.json(
          {
            error: "per_lead_daily_cap_exceeded",
            leadId: err.leadId,
            used: err.used,
            limit: err.limit,
          },
          { status: 402 },
        );
      }
      if (err instanceof QuotaExceededError) {
        return NextResponse.json(
          {
            error: "worker_quota_exceeded",
            workerKind: err.kind,
            used: err.used,
            limit: err.limit,
          },
          { status: 402 },
        );
      }
      throw err;
    }
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
    return internalError("api.planner.start_error", err);
  }
});
