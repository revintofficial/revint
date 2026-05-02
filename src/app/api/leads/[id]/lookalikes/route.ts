/**
 * GET /api/leads/[id]/lookalikes
 *
 * Finds the top-K most semantically similar leads in the same
 * workspace, based on the LEAD_PROFILE memory embedding. Primary use
 * case: a WON lead whose embedding becomes the prototype; the UI
 * renders the top matches as "leads like this one to target next".
 *
 * Response: 200 { lookalikes: [{ leadId, similarity, metadata }] }
 * Returns [] when the lead has no LEAD_PROFILE row yet (intelligence
 * chain hasn't finished for it).
 */
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { query } from "@/lib/ai-core/memory";

const DEFAULT_K = 10;

export const GET = withAuth(async (session, req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const topK = Math.min(
    25,
    Math.max(1, parseInt(url.searchParams.get("topK") ?? `${DEFAULT_K}`, 10) || DEFAULT_K),
  );

  // L6 fix - findFirst({id, workspaceId}) instead of findUnique +
  // post-check. Same IDOR shape as L1-L5. Note: the downstream
  // `query` call already passes `workspaceId: session.workspaceId`
  // and the Map-based join below scopes by workspace too, so the
  // exposure was always limited - but the pattern itself is the
  // bug we're fixing across the codebase.
  const lead = await prisma.lead.findFirst({
    where: { id, workspaceId: session.workspaceId },
    select: { workspaceId: true },
  });
  if (!lead) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const profile = await prisma.semanticMemory.findFirst({
    where: {
      workspaceId: session.workspaceId,
      kind: "LEAD_PROFILE",
      refType: "lead",
      refId: id,
    },
    select: { id: true, text: true },
  });

  if (!profile) {
    return NextResponse.json({ lookalikes: [], reason: "no_profile_embedding" });
  }

  const hits = await query({
    workspaceId: session.workspaceId,
    kinds: ["LEAD_PROFILE"],
    text: profile.text,
    topK: topK + 1, // +1 because the source lead will match itself
  });

  const lookalikes = hits
    .filter((h) => h.leadId && h.leadId !== id)
    .slice(0, topK)
    .map((h) => ({
      leadId: h.leadId,
      similarity: h.similarity,
      metadata: h.metadata,
    }));

  // Hydrate basic lead fields so the UI can render a list without a
  // second round trip.
  const leadIds = lookalikes.map((l) => l.leadId!).filter(Boolean);
  const leads = leadIds.length
    ? await prisma.lead.findMany({
        where: { id: { in: leadIds }, workspaceId: session.workspaceId },
        select: {
          id: true,
          businessName: true,
          borough: true,
          rating: true,
          reviewCount: true,
          hasWebsite: true,
          salesOpportunity: {
            select: {
              opportunityScore: true,
              status: true,
              // Legacy STARTER/GROWTH/SALES (deprecated P0.4) — still
              // selected so old rows render their tier in the look-
              // alike panel; new rows surface a configured
              // ServicePackage via recommendedPackageId.
              suggestedOffer: true,
              recommendedPackageId: true,
            },
          },
        },
      })
    : [];

  const leadById = new Map(leads.map((l) => [l.id, l] as const));

  return NextResponse.json({
    lookalikes: lookalikes.map((l) => ({
      ...l,
      lead: leadById.get(l.leadId!) ?? null,
    })),
  });
});
