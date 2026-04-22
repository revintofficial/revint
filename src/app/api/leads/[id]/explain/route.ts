/**
 * POST /api/leads/[id]/explain
 *
 * Lead Dossier endpoint. Gathers every collected signal about a lead
 * (website audit, sales opportunity, review analysis, raw Google
 * reviews, voice notes, every SUCCEEDED AgentRun output, and semantic
 * memory rows) and pipes the whole raw payload to Gemini 2.5 Flash
 * which returns an English Markdown brief. No caching - the lead detail
 * hero band "AI dossier" button hits this fresh on every click.
 *
 * Multi-tenant: every query filters by `session.workspaceId`; the lead
 * lookup uses `findFirst` so cross-workspace lead ids return 404.
 *
 * Token guard: any single agent-run `outputJson` larger than 60 KB is
 * replaced with a truncation marker so a single oversized run (e.g. a
 * Website Mockup HTML artifact) can't push the prompt past Gemini's
 * 1M input context or blow the timeout budget.
 */
import { NextResponse } from "next/server";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { generateLeadDossier, type LeadDossierPayload } from "@/lib/gemini";
import { listByLead as listMemoryByLead } from "@/lib/ai-core/memory";

const MAX_OUTPUT_JSON_BYTES = 60_000;
const MAX_TOTAL_PAYLOAD_BYTES = 120_000;

function truncateUnknown(value: unknown, label: string): unknown {
  if (value == null) return value;
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return `<unserialisable ${label}>`;
  }
  if (serialized.length <= MAX_OUTPUT_JSON_BYTES) return value;
  return {
    __truncated: true,
    reason: `${label} exceeded ${MAX_OUTPUT_JSON_BYTES} bytes (actual ${serialized.length})`,
    preview: serialized.slice(0, 2_000),
  };
}

export async function POST(
  _request: Request,
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
          take: 50,
          select: {
            authorName: true,
            rating: true,
            text: true,
            relativeTime: true,
            publishTime: true,
          },
        },
        voiceNotes: {
          orderBy: { createdAt: "desc" },
          take: 30,
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

    const agentRunRows = await prisma.agentRun.findMany({
      where: {
        workspaceId: session.workspaceId,
        leadId,
        status: "SUCCEEDED",
      },
      orderBy: { finishedAt: "desc" },
      take: 50,
      select: {
        workerKind: true,
        status: true,
        finishedAt: true,
        inputsJson: true,
        outputJson: true,
        artifactUrl: true,
      },
    });

    const memoryRows = await listMemoryByLead({
      workspaceId: session.workspaceId,
      leadId,
      take: 60,
    });

    const {
      websiteAudit,
      salesOpportunity,
      reviewAnalysis,
      googleReviews,
      voiceNotes,
      ...leadBase
    } = lead;

    const payload: LeadDossierPayload = {
      lead: leadBase as unknown as Record<string, unknown>,
      websiteAudit: (websiteAudit ?? null) as Record<string, unknown> | null,
      salesOpportunity: (salesOpportunity ?? null) as Record<string, unknown> | null,
      reviewAnalysis: (reviewAnalysis ?? null) as Record<string, unknown> | null,
      googleReviews: googleReviews as unknown as Array<Record<string, unknown>>,
      voiceNotes: voiceNotes as unknown as Array<Record<string, unknown>>,
      agentRuns: agentRunRows.map((r) => ({
        workerKind: r.workerKind,
        status: r.status,
        finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
        inputs: truncateUnknown(r.inputsJson, `AgentRun(${r.workerKind}).inputsJson`),
        output: truncateUnknown(r.outputJson, `AgentRun(${r.workerKind}).outputJson`),
        artifactUrl: r.artifactUrl,
      })),
      semanticMemory: memoryRows.map((m) => ({
        kind: m.kind,
        refType: m.refType,
        refId: m.refId,
        text: m.text.length > 1_500 ? `${m.text.slice(0, 1_500)}...` : m.text,
        metadata: m.metadata,
        createdAt: m.createdAt.toISOString(),
      })),
    };

    let serializedPayload: string;
    try {
      serializedPayload = JSON.stringify(payload);
    } catch (err) {
      logger.error("api.lead.explain.serialise_error", { leadId, err });
      return NextResponse.json(
        { error: "Failed to serialise lead payload" },
        { status: 500 },
      );
    }

    if (serializedPayload.length > MAX_TOTAL_PAYLOAD_BYTES) {
      // Hard cap pass 2: drop the oldest agent runs and trim memory
      // rows so the final prompt stays well under Gemini's budget.
      while (
        payload.agentRuns.length > 10 &&
        JSON.stringify(payload).length > MAX_TOTAL_PAYLOAD_BYTES
      ) {
        payload.agentRuns.pop();
      }
      while (
        payload.semanticMemory.length > 15 &&
        JSON.stringify(payload).length > MAX_TOTAL_PAYLOAD_BYTES
      ) {
        payload.semanticMemory.pop();
      }
    }

    const startedAt = Date.now();
    const markdown = await generateLeadDossier(payload, "en");

    logger.info("api.lead.explain.generated", {
      leadId,
      ms: Date.now() - startedAt,
      agentRunCount: payload.agentRuns.length,
      memoryRowCount: payload.semanticMemory.length,
      reviewCount: payload.googleReviews.length,
      outputChars: markdown.length,
    });

    return NextResponse.json({
      leadId,
      markdown,
      generatedAt: new Date().toISOString(),
      stats: {
        agentRunCount: payload.agentRuns.length,
        memoryRowCount: payload.semanticMemory.length,
        reviewCount: payload.googleReviews.length,
        voiceNoteCount: payload.voiceNotes.length,
      },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.lead.explain.error", {
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      {
        error: "Failed to generate lead dossier",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
