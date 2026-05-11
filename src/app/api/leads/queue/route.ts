/**
 * GET /api/leads/queue
 *
 * Phase 3 — bottom-sticky "Today X/Y" queue strip.
 *
 * Returns the next handful of leads the rep should work, sorted by
 * `nextActionDueAt asc nulls last, salesConfidence desc`. Filters
 * archived / discarded / snoozed leads out, and (when the rep didn't
 * pass `assignedToUserId`) defaults to the calling user's own leads.
 *
 * MULTI-TENANT SCOPE AUDIT (PLAN §6 — second-highest cross-tenant
 * leak risk in the entire plan, only the aggregator is higher):
 * - `requireUser()` resolves a trusted `workspaceId` and `userId`.
 * - Every Prisma `where` clause carries `workspaceId`.
 * - The `assignedToUserId` query param is OPTIONAL but its acceptable
 *   value is the caller's own user id only — passing another user's
 *   id is silently coerced to the caller's id (no 403 leak; we never
 *   confirm that someone else's id is valid).
 *
 * RACE / OPTIMISTIC CLAIM (PLAN §6 risk #14):
 * - In PRO_TEAM workspaces two reps can both have a lead show up in
 *   their queue if the lead has `assignedToUserId = null`. The
 *   default `assignedToUserId = self` filter pins the queue to leads
 *   the rep actually owns; reps without an assignee see only their
 *   own work. AGENCY-tier rollup is a future phase.
 *
 * PLAN GATING (PLAN §5.3):
 * - FREE: queue strip is locked. We return
 *   `{ items: [], totalToday: 0, doneToday: 0, locked: true }` so the
 *   client renders the static "Done — start your day" string instead.
 * - PRO and above: full queue with auto-advance.
 *
 * PERF BUDGET: ≤ 80ms p95 hot DB. The query relies on the existing
 * `(workspaceId, assignedToUserId, nextActionDueAt)` index defined
 * on `Lead` at line ~705 of the schema. Verified present.
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { internalError } from "@/lib/api-errors";
import type { Prisma } from "@/generated/prisma/client";
import { buildQueueHeadline } from "@/lib/lead-detail/queue-headline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TAKE = 10;
const DEFAULT_TAKE = 3;

export interface QueueItem {
  id: string;
  name: string;
  accountTier: "TIER_1" | "TIER_2" | "TIER_3" | "TIER_4" | null;
  whyNow: string | null;
  nextActionEtaSeconds: number | null;
  salesConfidence: number | null;
  nextActionDueAt: string | null;
}

export interface QueueResponse {
  items: QueueItem[];
  totalToday: number;
  doneToday: number;
  locked: boolean;
}

function toEtaSeconds(due: Date | null, now: Date): number | null {
  if (!due) return null;
  const diff = Math.round((due.getTime() - now.getTime()) / 1000);
  return diff;
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function endOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
}

export async function GET(request: Request) {
  try {
    const session = await requireUser();
    const { workspaceId, user } = session;
    const plan = session.workspace.plan;

    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor");
    const takeParam = Number.parseInt(
      url.searchParams.get("take") ?? String(DEFAULT_TAKE),
      10,
    );
    const take = Math.max(1, Math.min(MAX_TAKE, Number.isFinite(takeParam) ? takeParam : DEFAULT_TAKE));

    if (plan === "FREE") {
      const lockedResponse: QueueResponse = {
        items: [],
        totalToday: 0,
        doneToday: 0,
        locked: true,
      };
      return NextResponse.json(lockedResponse, {
        headers: { "Cache-Control": "private, max-age=0, must-revalidate" },
      });
    }

    const requestedAssignee = url.searchParams.get("assignedToUserId");
    const assignedToUserId =
      requestedAssignee && requestedAssignee === user.id ? user.id : user.id;

    const now = new Date();

    const baseWhere: Prisma.LeadWhereInput = {
      workspaceId,
      assignedToUserId,
      archivedAt: null,
      discardedAt: null,
      OR: [
        { snoozeUntil: null },
        { snoozeUntil: { lte: now } },
      ],
    };

    const cursorClause: Prisma.LeadWhereInput | null = cursor
      ? { id: { not: cursor } }
      : null;

    const where: Prisma.LeadWhereInput = cursorClause
      ? { AND: [baseWhere, cursorClause] }
      : baseWhere;

    const todayWhere: Prisma.LeadWhereInput = {
      workspaceId,
      assignedToUserId,
      archivedAt: null,
      discardedAt: null,
      nextActionDueAt: { lte: endOfDay(now) },
      OR: [
        { snoozeUntil: null },
        { snoozeUntil: { lte: now } },
      ],
    };

    const doneTodayWhere: Prisma.LeadWhereInput = {
      workspaceId,
      assignedToUserId,
      lastContactedAt: { gte: startOfDay(now) },
    };

    const [rows, totalToday, doneToday] = await prisma.$transaction([
      prisma.lead.findMany({
        where,
        select: {
          id: true,
          businessName: true,
          nextActionDueAt: true,
          salesConfidence: true,
          account: { select: { tier: true } },
          triggers: {
            where: { decayedAt: null },
            orderBy: [{ severity: "desc" }, { confidence: "desc" }],
            take: 1,
            select: { type: true, impactPrediction: true, evidence: true },
          },
        },
        orderBy: [
          { nextActionDueAt: { sort: "asc", nulls: "last" } },
          { salesConfidence: "desc" },
        ],
        take,
      }),
      prisma.lead.count({ where: todayWhere }),
      prisma.lead.count({ where: doneTodayWhere }),
    ]);

    const items: QueueItem[] = rows.map((r) => {
      const trigger = r.triggers[0] ?? null;
      // Phase 3: deterministic headline via shared helper so the queue
      // strip cites a real `LeadTriggerType` (no fake mock copy) and
      // Phase 8's REVIEW_VOLUME_* types render their delta numbers.
      const whyNow = buildQueueHeadline(trigger);
      return {
        id: r.id,
        name: r.businessName,
        accountTier: r.account?.tier ?? null,
        whyNow,
        nextActionEtaSeconds: toEtaSeconds(r.nextActionDueAt, now),
        salesConfidence: r.salesConfidence,
        nextActionDueAt: r.nextActionDueAt?.toISOString() ?? null,
      };
    });

    const response: QueueResponse = {
      items,
      totalToday,
      doneToday,
      locked: false,
    };
    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, max-age=0, must-revalidate" },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.leads.queue.GET", err);
  }
}
