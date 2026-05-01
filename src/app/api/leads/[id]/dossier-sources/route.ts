/**
 * GET /api/leads/[id]/dossier-sources
 *
 * Single round-trip backend for the AI Dossier source-chip preview +
 * side drawer. The dossier markdown contains tokens like `[run:APIFY_FACEBOOK_DEEP]`
 * or `[memory:SOCIAL_POST]`; the lead detail page hits this endpoint
 * once when a dossier is rendered and uses the response to populate
 * each chip's hover preview and the drawer body.
 *
 * Why a dedicated endpoint (instead of leaning on /api/leads/[id]):
 *   - Agent run outputs and semantic memory rows aren't shipped on the
 *     base lead payload — they're large, kind-specific, and only
 *     interesting once a dossier exists.
 *   - The summarizer in `dossier-summary.ts` strips full outputJson
 *     down to 3-5 KeyMetrics per worker so we ship ~200 bytes per run
 *     instead of dozens of KB.
 *   - Memory snippets are truncated to 200 chars per row + capped at
 *     5 rows per kind so the response stays comfortably under 10 KB
 *     even for leads with deep enrichment history.
 *
 * Multi-tenant: every read is scoped via `requireUser().workspaceId`.
 * Lead is verified with `findFirst({ id, workspaceId })` so a foreign
 * lead id returns 404 instead of leaking presence. Memory uses the
 * `listByLead` facade in `src/lib/ai-core/memory.ts` (direct
 * `prisma.semanticMemory.*` is forbidden by project rules).
 */
import { NextResponse } from "next/server";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { internalError } from "@/lib/api-errors";
import { listByLead as listMemoryByLead } from "@/lib/ai-core/memory";
import { getNicheBySlug, getParentOf } from "@/lib/niches";
import {
  summarizeForDossier,
  type DossierSourceSummary,
} from "@/lib/agent-workers/dossier-summary";
import type { AgentWorkerKind, MemoryKind } from "@/generated/prisma/client";

const MAX_MEMORY_SNIPPETS_PER_KIND = 5;
const MEMORY_SNIPPET_CHARS = 200;

interface AgentRunSummary {
  runId: string;
  workerKind: AgentWorkerKind;
  finishedAt: string | null;
  artifactUrl: string | null;
  summary: DossierSourceSummary;
}

interface MemorySnippetGroup {
  kind: MemoryKind;
  count: number;
  latest: Array<{
    id: string;
    text: string;
    refType: string | null;
    refId: string | null;
    createdAt: string;
  }>;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireUser();
    const { id: leadId } = await params;

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, workspaceId: session.workspaceId },
      include: {
        websiteAudit: true,
        salesOpportunity: true,
        reviewAnalysis: true,
        googleReviews: {
          orderBy: { publishTime: "desc" },
          take: 5,
          select: {
            id: true,
            authorName: true,
            rating: true,
            text: true,
            relativeTime: true,
            publishTime: true,
          },
        },
        voiceNotes: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            transcript: true,
            createdAt: true,
          },
        },
      },
    });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Run the latest-per-kind reduction in JS rather than via SQL — Prisma
    // doesn't support `DISTINCT ON` cleanly and the result set is bounded
    // (50 rows max, one per worker kind) so the perf hit is negligible.
    const [agentRunRows, memoryRows, voiceNoteCount, servicePackages] = await Promise.all([
      prisma.agentRun.findMany({
        where: {
          workspaceId: session.workspaceId,
          leadId,
          status: "SUCCEEDED",
          // Skip the dossier worker itself — its output is the markdown
          // we're rendering, citing it would create a self-referential chip.
          workerKind: { not: "LEAD_DOSSIER_GENERATOR" },
        },
        orderBy: { finishedAt: "desc" },
        take: 100,
        select: {
          id: true,
          workerKind: true,
          finishedAt: true,
          artifactUrl: true,
          outputJson: true,
        },
      }),
      listMemoryByLead({
        workspaceId: session.workspaceId,
        leadId,
        take: 60,
      }),
      prisma.voiceNote.count({
        where: { workspaceId: session.workspaceId, leadId },
      }),
      prisma.servicePackage.findMany({
        where: { workspaceId: session.workspaceId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          priceLabel: true,
          features: true,
          isPopular: true,
        },
      }),
    ]);

    // Reduce to latest run per worker kind. The orderBy above already has
    // most recent first, so the first hit wins.
    const latestByKind = new Map<AgentWorkerKind, typeof agentRunRows[number]>();
    for (const row of agentRunRows) {
      if (!latestByKind.has(row.workerKind)) latestByKind.set(row.workerKind, row);
    }
    const runs: Record<string, AgentRunSummary> = {};
    for (const [kind, row] of latestByKind.entries()) {
      runs[kind] = {
        runId: row.id,
        workerKind: kind,
        finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
        artifactUrl: row.artifactUrl,
        summary: summarizeForDossier(kind, row.outputJson),
      };
    }

    // Group memory rows by kind, keep the first N per group (already sorted
    // newest-first by listByLead), and truncate text. We never ship the full
    // memory text — those rows can be PROSPECT_KB_CHUNK pages of website copy.
    const memoryByKind = new Map<MemoryKind, MemorySnippetGroup>();
    for (const row of memoryRows) {
      let group = memoryByKind.get(row.kind);
      if (!group) {
        group = { kind: row.kind, count: 0, latest: [] };
        memoryByKind.set(row.kind, group);
      }
      group.count += 1;
      if (group.latest.length < MAX_MEMORY_SNIPPETS_PER_KIND) {
        const text = row.text ?? "";
        group.latest.push({
          id: row.id,
          text:
            text.length > MEMORY_SNIPPET_CHARS
              ? `${text.slice(0, MEMORY_SNIPPET_CHARS)}…`
              : text,
          refType: row.refType,
          refId: row.refId,
          createdAt: row.createdAt.toISOString(),
        });
      }
    }
    const memory: Record<string, MemorySnippetGroup> = {};
    for (const [kind, group] of memoryByKind.entries()) {
      memory[kind] = group;
    }

    // Niche pack — same resolution rule as the dossier prompt builder so
    // the chip's drawer body matches what the markdown was generated against.
    const subNicheSlug = lead.subNicheSlug as string | null;
    const nicheSlug = lead.nicheSlug as string | null;
    const resolvedSlug =
      subNicheSlug ??
      nicheSlug ??
      (subNicheSlug ? getParentOf(subNicheSlug) : null) ??
      null;
    const resolvedPack = resolvedSlug ? getNicheBySlug(resolvedSlug) ?? null : null;

    const reviewAnalysis = lead.reviewAnalysis;

    return NextResponse.json({
      leadId,
      lead: {
        id: lead.id,
        businessName: lead.businessName,
        primaryType: lead.primaryType,
        formattedAddress: lead.formattedAddress,
        rating: lead.rating,
        reviewCount: lead.reviewCount,
        websiteUrl: lead.websiteUrl,
        phone: lead.phone,
        nicheSlug,
        subNicheSlug,
        subNicheSource: lead.subNicheSource,
        subNicheConfidence: lead.subNicheConfidence,
      },
      websiteAudit: lead.websiteAudit,
      salesOpportunity: lead.salesOpportunity,
      reviewAnalysis: reviewAnalysis
        ? {
            leadScore: reviewAnalysis.leadScore,
            summary: reviewAnalysis.summary,
            weaknessKpis: reviewAnalysis.weaknessKpis,
            strengthKpis: reviewAnalysis.strengthKpis,
            painPhrases: reviewAnalysis.painPhrases,
            strengthPhrases: reviewAnalysis.strengthPhrases,
            sentimentBreakdown: reviewAnalysis.sentimentBreakdown,
            switchSignals: reviewAnalysis.switchSignals,
            reviewsAnalyzedCount: reviewAnalysis.reviewsAnalyzedCount,
            analyzedAt: reviewAnalysis.analyzedAt
              ? reviewAnalysis.analyzedAt.toISOString()
              : null,
          }
        : null,
      reviews: lead.googleReviews.map((r) => ({
        id: r.id,
        authorName: r.authorName,
        rating: r.rating,
        text: r.text,
        relativeTime: r.relativeTime,
        publishTime: r.publishTime ? r.publishTime.toISOString() : null,
      })),
      voiceNotes: {
        count: voiceNoteCount,
        latest: lead.voiceNotes[0]
          ? {
              id: lead.voiceNotes[0].id,
              transcriptPreview:
                (lead.voiceNotes[0].transcript ?? "").slice(0, 280) +
                ((lead.voiceNotes[0].transcript ?? "").length > 280 ? "…" : ""),
              createdAt: lead.voiceNotes[0].createdAt.toISOString(),
            }
          : null,
      },
      nichePack: resolvedPack
        ? {
            slug: resolvedSlug,
            label: resolvedPack.label,
            tagline: resolvedPack.tagline,
            pitchAngle: resolvedPack.pitchAngle,
            highValueSignals: resolvedPack.highValueSignals ?? [],
            featuredProductModules: resolvedPack.featuredProductModules ?? [],
          }
        : null,
      servicePackages,
      runs,
      memory,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.lead.dossier_sources.error", err);
  }
}
