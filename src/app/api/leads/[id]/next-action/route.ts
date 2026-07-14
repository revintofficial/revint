/**
 * GET /api/leads/[id]/next-action
 *
 * Returns the current Next Best Action surface for a lead. The shape is
 * what the lead-detail page's NBA card consumes:
 *
 *   {
 *     preliminary: LeadNextAction | null,    // (legacy) preliminary prediction
 *     final:       LeadNextAction | null,    // intelligence brief output
 *     triggers:    LeadTrigger[],            // active triggers cited
 *     insight:     CommercialInsight | null, // applied insight (latest)
 *     reasoningGraph: ReasoningGraph | null, // typed unwrap of `final.reasoningGraph`
 *     arbitrationRecords: ContradictionRecord[], // typed unwrap
 *   }
 *
 * V2-cleanup — the BANT-only preliminary NBA path was removed along with
 * the BANT_INFERRER worker. `preliminary` is left in the response shape
 * for legacy clients but is always `null` going forward; the brief
 * writes a single final NBA at the end of the chain.
 *
 * Multi-tenant: the inner `findFirst` is workspace-scoped via `requireUser`.
 * No data is returned for leads outside the active workspace, even if the
 * caller knows the id (404 instead of 401 to avoid disclosure).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { internalError } from "@/lib/api-errors";
import type {
  ReasoningGraph,
  ContradictionRecord,
} from "@/lib/sdr-brain/reasoning-graph";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId } = await requireUser();
    const { id } = await params;

    // Confirm the lead belongs to the active workspace before any fan-out.
    const lead = await prisma.lead.findFirst({
      where: { id, workspaceId },
      select: { id: true },
    });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const [preliminary, finalNba, triggers] = await Promise.all([
      prisma.leadNextAction.findFirst({
        where: { workspaceId, leadId: id, isPreliminary: true, supersededAt: null },
        orderBy: { createdAt: "desc" },
      }),
      prisma.leadNextAction.findFirst({
        where: { workspaceId, leadId: id, isPreliminary: false, supersededAt: null },
        orderBy: { createdAt: "desc" },
      }),
      prisma.leadTrigger.findMany({
        where: { workspaceId, leadId: id, decayedAt: null },
        orderBy: { detectedAt: "desc" },
        take: 10,
      }),
    ]);

    let insight: {
      id: string;
      industryMyth: string;
      reframe: string;
      economicImpact: string | null;
    } | null = null;
    if (finalNba?.primaryAngleId) {
      const ins = await prisma.commercialInsight.findFirst({
        where: {
          id: finalNba.primaryAngleId,
          OR: [{ workspaceId }, { workspaceId: null }],
        },
        select: {
          id: true,
          industryMyth: true,
          reframe: true,
          economicImpact: true,
        },
      });
      insight = ins ?? null;
    }

    return NextResponse.json({
      preliminary,
      final: finalNba,
      triggers,
      insight,
      reasoningGraph: (finalNba?.reasoningGraph as ReasoningGraph | null) ?? null,
      arbitrationRecords:
        (finalNba?.arbitrationRecords as ContradictionRecord[] | null) ?? [],
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.leads.next-action.GET", err);
  }
}
