/**
 * GET /api/leads/[id]/account/sister-leads
 *
 * Phase 4 — lazy-loaded sister-lead summary feed for the v2 ACCOUNT
 * block. The aggregator (`/decision-surface`) intentionally does NOT
 * eager-load sister rows because chains of 50+ branches would blow the
 * 250ms p95 budget for the 5% of leads with chains (PLAN §4 line 332).
 *
 * MULTI-TENANT SCOPE AUDIT (PLAN §6 risk #6 — the highest-severity
 * Phase 4 risk):
 *   - `requireUser()` first; `workspaceId` is the only trusted source.
 *   - Verifies the lead belongs to the caller's workspace BEFORE
 *     reading its `accountId` — a malicious caller can't pivot to a
 *     foreign account by passing a foreign lead id.
 *   - The helper `fetchSisterLeads` takes `workspaceId` as a
 *     non-optional first arg, so its `where` clause is always scoped.
 *
 * PLAN GATING (PLAN §5.3):
 *   - Sister-rows table is a PRO_TEAM+ surface.
 *   - FREE / PRO callers receive 200 with an empty `items` array and
 *     `locked: true` so the client can render the upgrade teaser
 *     without firing again.
 *
 * LATENCY: ≤ 100ms p95 for the first 20 rows. The helper batches
 * `findMany` + `count` into a single `Prisma.$transaction`.
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { internalError } from "@/lib/api-errors";
import {
  fetchSisterLeads,
  SISTER_LEADS_DEFAULT_TAKE,
  SISTER_LEADS_MAX_TAKE,
  type SisterLeadSummary,
} from "@/lib/lead-detail/sister-leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface SisterLeadsResponse {
  items: SisterLeadSummary[];
  total: number;
  nextCursor: string | null;
  /** Plan-gate hint so the client can render the upgrade teaser. */
  locked: boolean;
  /** Account context echoed back so the client can render headers without
   *  a second aggregator call when navigated to directly. */
  account: {
    id: string;
    name: string;
    tier: "TIER_1" | "TIER_2" | "TIER_3" | "TIER_4" | null;
    locationsCount: number | null;
  } | null;
}

function parseTake(raw: string | null): number {
  if (!raw) return SISTER_LEADS_DEFAULT_TAKE;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return SISTER_LEADS_DEFAULT_TAKE;
  return Math.min(SISTER_LEADS_MAX_TAKE, n);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireUser();
    const { workspaceId } = session;
    const plan = session.workspace.plan;
    const { id } = await params;

    const url = new URL(request.url);
    const take = parseTake(url.searchParams.get("take"));
    const cursor = url.searchParams.get("cursor");

    const lead = await prisma.lead.findFirst({
      where: { id, workspaceId },
      select: {
        id: true,
        accountId: true,
        account: {
          select: {
            id: true,
            name: true,
            tier: true,
            locationsCount: true,
          },
        },
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const accountPayload = lead.account
      ? {
          id: lead.account.id,
          name: lead.account.name,
          tier: lead.account.tier,
          locationsCount: lead.account.locationsCount,
        }
      : null;

    if (!lead.accountId) {
      const empty: SisterLeadsResponse = {
        items: [],
        total: 0,
        nextCursor: null,
        locked: false,
        account: null,
      };
      return NextResponse.json(empty);
    }

    const isUnlocked = plan === "PRO_TEAM" || plan === "AGENCY";
    if (!isUnlocked) {
      const locked: SisterLeadsResponse = {
        items: [],
        total: 0,
        nextCursor: null,
        locked: true,
        account: accountPayload,
      };
      return NextResponse.json(locked);
    }

    const result = await fetchSisterLeads({
      workspaceId,
      accountId: lead.accountId,
      currentLeadId: lead.id,
      take,
      cursor,
    });

    const response: SisterLeadsResponse = {
      items: result.items,
      total: result.total,
      nextCursor: result.nextCursor,
      locked: false,
      account: accountPayload,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.leads.account.sister-leads.GET", err);
  }
}
