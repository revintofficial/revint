/**
 * sister-leads — pure query helper for the v2 ACCOUNT block (Phase 4).
 *
 * Returns the sister-lead summary rows for a given account, scoped to
 * the caller's workspace. Lazy-loaded by the client (only fires when
 * `AccountBlock` expands) so chains of 50+ branches do not pay the
 * aggregator cost on every lead-detail open. See PLAN §4 line 311 +
 * RETHINK §9 Q5.
 *
 * MULTI-TENANT SCOPE — PLAN §6 risk #6 (the highest-severity risk in
 * the whole Phase 4 plan):
 *   - `workspaceId` is the NON-OPTIONAL first arg so callers can't
 *     forget to pass it.
 *   - Every Prisma where clause includes `workspaceId`.
 *   - The integration test seeds two workspaces and proves isolation.
 *
 * Latency budget: ≤ 100ms p95 for the first 20 rows. Single
 * `Prisma.$transaction([items, count])` to keep round-trips low.
 */
import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import {
  deriveLeadDetailStage,
  type DealStageInput,
  type PipelineStageInput,
} from "@/lib/lead-detail/derive-stage";
import type { LeadDetailV2Stage } from "@/lib/lead-detail/use-pipeline-stage";

/**
 * Maximum rows the helper will ever return in one call. Even on the
 * largest known chain (50+ branches) the rep can paginate forward via
 * `cursor`. Hard-capped server-side regardless of any caller value.
 */
export const SISTER_LEADS_MAX_TAKE = 50;
export const SISTER_LEADS_DEFAULT_TAKE = 20;

export interface SisterLeadSummary {
  id: string;
  businessName: string;
  borough: string | null;
  subNicheSlug: string | null;
  subNicheLabel: string | null;
  stage: LeadDetailV2Stage;
  pipelineStatus: string;
  icpScorePct: number | null;
  salesConfidence: number | null;
  lastActivityAt: string | null;
  lastDisposition: string | null;
  isWon: boolean;
}

export interface FetchSisterLeadsArgs {
  /** Trusted workspaceId — must come from `requireUser()`. */
  workspaceId: string;
  /** Account id whose sister leads we want. */
  accountId: string;
  /** Lead currently being viewed; excluded from the result set. */
  currentLeadId: string;
  /** Page size (1..50). Defaults to 20. */
  take?: number;
  /** Lead id of the last row from the previous page. */
  cursor?: string | null;
}

export interface FetchSisterLeadsResult {
  items: SisterLeadSummary[];
  total: number;
  nextCursor: string | null;
}

const SUBNICHE_LABEL = (slug: string | null): string | null =>
  slug ? slug.replace(/[-_]/g, " ") : null;

function clampTake(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) return SISTER_LEADS_DEFAULT_TAKE;
  return Math.max(1, Math.min(SISTER_LEADS_MAX_TAKE, Math.floor(value)));
}

/**
 * Workspace-scoped sister-lead lookup. Both the items query and the
 * total-count query include `workspaceId` directly in the Prisma where
 * clause — never via a parent relation — so a leaked or shared
 * external `placeId` between two workspaces cannot collapse the
 * tenant boundary.
 */
export async function fetchSisterLeads(
  args: FetchSisterLeadsArgs,
): Promise<FetchSisterLeadsResult> {
  const take = clampTake(args.take);
  const cursor = args.cursor && args.cursor.length > 0 ? args.cursor : null;

  const where: Prisma.LeadWhereInput = {
    workspaceId: args.workspaceId,
    accountId: args.accountId,
    id: { not: args.currentLeadId },
    archivedAt: null,
  };

  // Fetch one extra row so we can detect whether a next page exists
  // without an extra count round-trip (the count below tracks the
  // unfiltered total for the UI, not pagination state).
  const peek = take + 1;

  const [rawRows, total] = await prisma.$transaction([
    prisma.lead.findMany({
      where,
      orderBy: [
        { lastContactedAt: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ],
      take: peek,
      ...(cursor
        ? { cursor: { id: cursor }, skip: 1 }
        : {}),
      select: {
        id: true,
        businessName: true,
        borough: true,
        subNicheSlug: true,
        pipelineStatus: true,
        icpFitScore: true,
        salesConfidence: true,
        lastContactedAt: true,
        lastDisposition: true,
        watchlistItem: {
          select: {
            dealStage: true,
            pipelineStage: true,
          },
        },
      },
    }),
    prisma.lead.count({ where }),
  ]);

  const hasNext = rawRows.length > take;
  const rows = hasNext ? rawRows.slice(0, take) : rawRows;

  const items: SisterLeadSummary[] = rows.map((row) => {
    const stage = deriveLeadDetailStage(
      { lastContactedAt: row.lastContactedAt },
      row.watchlistItem
        ? {
            dealStage: row.watchlistItem.dealStage as DealStageInput,
            pipelineStage: row.watchlistItem
              .pipelineStage as PipelineStageInput,
          }
        : null,
    );
    return {
      id: row.id,
      businessName: row.businessName,
      borough: row.borough ?? null,
      subNicheSlug: row.subNicheSlug ?? null,
      subNicheLabel: SUBNICHE_LABEL(row.subNicheSlug),
      stage,
      pipelineStatus: row.pipelineStatus,
      icpScorePct: row.icpFitScore ?? null,
      salesConfidence: row.salesConfidence ?? null,
      lastActivityAt: row.lastContactedAt
        ? row.lastContactedAt.toISOString()
        : null,
      lastDisposition: row.lastDisposition ?? null,
      isWon: stage === "WON",
    };
  });

  const nextCursor = hasNext ? items[items.length - 1].id : null;

  return { items, total, nextCursor };
}
