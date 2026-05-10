/**
 * POST /api/leads/[id]/snooze
 *
 * Phase 3 — snooze a single lead so it disappears from today's queue.
 * Three body shapes (discriminated union on `kind`):
 *
 *   { kind: 'duration', days: 1 | 3 | 7 }
 *   { kind: 'custom', until: ISO-8601 string }   // ≤ 90 days from now
 *   { kind: 'until_trigger', triggerType: LeadTriggerType,
 *       maxHorizonDays?: number }                // defaults to 90
 *
 * For `duration` and `custom` the route sets `Lead.snoozeUntil` only;
 * `Lead.snoozeUntilTriggerType` is forced to null.
 *
 * For `until_trigger` the route sets `Lead.snoozeUntil = now + maxHorizonDays`
 * (the safety cap so a stuck "until trigger" snooze can't linger
 * forever) AND `Lead.snoozeUntilTriggerType = triggerType`. The
 * trigger-detector worker post-write hook clears BOTH columns the
 * moment a matching `LeadTrigger` lands in the workspace (see
 * `src/lib/agent-workers/trigger-detector.ts`, PLAN §6 risk #8).
 *
 * MULTI-TENANT SCOPE AUDIT:
 * - `requireUser()` is called first and resolves a trusted
 *   `workspaceId`. The body NEVER carries a workspaceId — it would
 *   be ignored if it did.
 * - `prisma.lead.findFirst({ where: { id, workspaceId } })` re-verifies
 *   ownership before any write. Cross-tenant request returns 404, NOT
 *   401/403 — we never confirm the existence of a foreign-workspace
 *   lead.
 * - Updates use `prisma.lead.update({ where: { id } })` only AFTER
 *   the find-first succeeded. (Switching to `updateMany` with the
 *   compound where would also work but the pre-check is cheaper than
 *   the round-trip we're already paying.)
 *
 * IDEMPOTENCY:
 * - Re-snoozing a lead with the same params returns
 *   `{ unchanged: true, ... }` and skips the write.
 *
 * PLAN GATING: snooze is FREE-friendly (PLAN §5.3). No upgrade gate.
 *
 * RETURNS: `{ snoozeUntil: ISO, snoozeUntilTriggerType: string|null,
 *             unchanged?: boolean, kind: 'duration'|'custom'|'until_trigger' }`
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { internalError } from "@/lib/api-errors";
import type { LeadTriggerType } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_DURATIONS = new Set<number>([1, 3, 7]);
const MAX_HORIZON_DAYS = 90;
const ALLOWED_TRIGGER_TYPES: ReadonlySet<LeadTriggerType> = new Set<LeadTriggerType>([
  "NEW_LOCATION_OPENING",
  "CHAIN_EXPANSION",
  "HIRING_MARKETING",
  "HIRING_OPS",
  "HIRING_TECH",
  "BAD_SERVICE_REVIEWS",
  "RATING_DROP",
  "MENU_REDESIGN_SIGNAL",
  "BOOKING_PROVIDER_CHANGE",
  "DELIVERY_EXPANSION",
  "INTERNATIONAL_AUDIENCE_GROWTH",
  "SEASONAL_TOURISM",
  "COMPETITOR_PRESSURE",
  "REBRANDING",
  "FUNDING_RAISED",
  "EXEC_CHANGE",
]);

type SnoozePayload =
  | { kind: "duration"; days: 1 | 3 | 7 }
  | { kind: "custom"; until: string }
  | { kind: "until_trigger"; triggerType: LeadTriggerType; maxHorizonDays?: number };

interface ParsedSnooze {
  payload: SnoozePayload;
  snoozeUntil: Date;
  snoozeUntilTriggerType: LeadTriggerType | null;
}

function parseSnoozeBody(
  body: unknown,
  now: Date,
): { ok: true; value: ParsedSnooze } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "body_required" };
  }
  const b = body as Record<string, unknown>;
  const kind = b.kind;

  if (kind === "duration") {
    const days = typeof b.days === "number" ? b.days : Number.NaN;
    if (!ALLOWED_DURATIONS.has(days)) {
      return { ok: false, error: "invalid_days" };
    }
    const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    return {
      ok: true,
      value: {
        payload: { kind: "duration", days: days as 1 | 3 | 7 },
        snoozeUntil: until,
        snoozeUntilTriggerType: null,
      },
    };
  }

  if (kind === "custom") {
    const raw = typeof b.until === "string" ? b.until : null;
    if (!raw) return { ok: false, error: "until_required" };
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: "invalid_until" };
    }
    if (parsed.getTime() <= now.getTime()) {
      return { ok: false, error: "until_must_be_future" };
    }
    const cap = new Date(now.getTime() + MAX_HORIZON_DAYS * 24 * 60 * 60 * 1000);
    if (parsed.getTime() > cap.getTime()) {
      return { ok: false, error: "until_exceeds_cap" };
    }
    return {
      ok: true,
      value: {
        payload: { kind: "custom", until: parsed.toISOString() },
        snoozeUntil: parsed,
        snoozeUntilTriggerType: null,
      },
    };
  }

  if (kind === "until_trigger") {
    const triggerType = String(b.triggerType ?? "") as LeadTriggerType;
    if (!ALLOWED_TRIGGER_TYPES.has(triggerType)) {
      return { ok: false, error: "invalid_trigger_type" };
    }
    const requested =
      typeof b.maxHorizonDays === "number" && Number.isFinite(b.maxHorizonDays)
        ? Math.floor(b.maxHorizonDays)
        : MAX_HORIZON_DAYS;
    if (requested <= 0) {
      return { ok: false, error: "invalid_max_horizon_days" };
    }
    const days = Math.min(requested, MAX_HORIZON_DAYS);
    const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    return {
      ok: true,
      value: {
        payload: { kind: "until_trigger", triggerType, maxHorizonDays: days },
        snoozeUntil: until,
        snoozeUntilTriggerType: triggerType,
      },
    };
  }

  return { ok: false, error: "unknown_kind" };
}

function approxEqual(a: Date | null, b: Date | null, toleranceMs = 1500): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a.getTime() - b.getTime()) <= toleranceMs;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId, user } = await requireUser();
    const { id } = await params;
    const now = new Date();

    const raw = await request.json().catch(() => null);
    const parsed = parseSnoozeBody(raw, now);
    if (!parsed.ok) {
      return NextResponse.json(
        { error: "Invalid snooze payload", code: parsed.error },
        { status: 400 },
      );
    }

    const lead = await prisma.lead.findFirst({
      where: { id, workspaceId },
      select: {
        id: true,
        snoozeUntil: true,
        snoozeUntilTriggerType: true,
      },
    });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const sameTrigger =
      lead.snoozeUntilTriggerType === parsed.value.snoozeUntilTriggerType;
    const sameDate = approxEqual(lead.snoozeUntil, parsed.value.snoozeUntil);
    if (sameTrigger && sameDate) {
      return NextResponse.json({
        unchanged: true,
        snoozeUntil: lead.snoozeUntil?.toISOString() ?? null,
        snoozeUntilTriggerType: lead.snoozeUntilTriggerType,
        kind: parsed.value.payload.kind,
      });
    }

    await prisma.$transaction([
      prisma.lead.update({
        where: { id },
        data: {
          snoozeUntil: parsed.value.snoozeUntil,
          snoozeUntilTriggerType: parsed.value.snoozeUntilTriggerType,
        },
      }),
      prisma.leadActivity.create({
        data: {
          workspaceId,
          leadId: id,
          userId: user.id,
          kind: "SNOOZED",
          payload: {
            until: parsed.value.snoozeUntil.toISOString(),
            kind: parsed.value.payload.kind,
            triggerType: parsed.value.snoozeUntilTriggerType,
          },
        },
      }),
    ]);

    return NextResponse.json({
      snoozeUntil: parsed.value.snoozeUntil.toISOString(),
      snoozeUntilTriggerType: parsed.value.snoozeUntilTriggerType,
      kind: parsed.value.payload.kind,
      unchanged: false,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.leads.snooze.POST", err);
  }
}
