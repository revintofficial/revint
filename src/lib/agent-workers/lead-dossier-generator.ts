/**
 * LEAD_DOSSIER_GENERATOR worker.
 *
 * Encapsulates the previously-uncached `/api/leads/[id]/explain`
 * Gemini call inside an AgentRun so the result can be cached on
 * `AgentRun.outputJson` and served instantly until the underlying
 * data (reviews, audit, Apify enrichment) changes.
 *
 * The route at `/api/leads/[id]/explain` now does:
 *   1. findFirst SUCCEEDED LEAD_DOSSIER_GENERATOR run.
 *   2. If finishedAt > most-recent updateAt of source rows, return
 *      cached markdown.
 *   3. Otherwise inline `executeAgentRun` for this kind, then return.
 *
 * Output shape (`AgentWorkerOutput.output`):
 *   {
 *     markdown: string,
 *     stats: { agentRunCount, memoryRowCount, reviewCount, voiceNoteCount },
 *     generatedAt: ISO string,
 *   }
 */
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { generateLeadDossier, type LeadDossierPayload } from "@/lib/gemini";
import { listByLead as listMemoryByLead } from "@/lib/ai-core/memory";
import type {
  AgentWorkerContext,
  AgentWorkerOutput,
  AgentWorkerRun,
  MemoryWrite,
} from "./types";

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

export interface LeadDossierWorkerOutput {
  markdown: string;
  generatedAt: string;
  stats: {
    agentRunCount: number;
    memoryRowCount: number;
    reviewCount: number;
    voiceNoteCount: number;
  };
}

/**
 * Builds the LeadDossierPayload for a given workspace + lead. Shared
 * by the worker and the legacy route fallback so both code paths
 * produce identical prompts.
 */
export async function buildDossierPayload(
  workspaceId: string,
  leadId: string,
): Promise<LeadDossierPayload | null> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, workspaceId },
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
  if (!lead) return null;

  const agentRunRows = await prisma.agentRun.findMany({
    where: {
      workspaceId,
      leadId,
      status: "SUCCEEDED",
      // Exclude self so the cached dossier markdown doesn't end up
      // re-fed into the next dossier prompt (would balloon token cost
      // and make the model summarize its own past output).
      workerKind: { not: "LEAD_DOSSIER_GENERATOR" },
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
    workspaceId,
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

  // Hard cap pass: shed oldest rows so the prompt fits comfortably
  // inside Gemini's effective context budget. Identical strategy to
  // the previous /api/leads/[id]/explain route so cache hits and
  // misses produce the same dossier.
  let serializedLength = JSON.stringify(payload).length;
  while (
    payload.agentRuns.length > 10 &&
    serializedLength > MAX_TOTAL_PAYLOAD_BYTES
  ) {
    payload.agentRuns.pop();
    serializedLength = JSON.stringify(payload).length;
  }
  while (
    payload.semanticMemory.length > 15 &&
    serializedLength > MAX_TOTAL_PAYLOAD_BYTES
  ) {
    payload.semanticMemory.pop();
    serializedLength = JSON.stringify(payload).length;
  }

  return payload;
}

export const run: AgentWorkerRun = async (ctx): Promise<AgentWorkerOutput> => {
  if (!ctx.lead) throw new Error("LEAD_DOSSIER_GENERATOR requires a lead context");
  const leadId = ctx.lead.id;

  const payload = await buildDossierPayload(ctx.workspaceId, leadId);
  if (!payload) {
    return {
      output: { skipped: true, reason: "lead_not_found" },
      costTokens: 0,
    };
  }

  const startedAt = Date.now();
  const markdown = await generateLeadDossier(payload, ctx.workspace.language ?? "en");
  const elapsed = Date.now() - startedAt;

  const stats = {
    agentRunCount: payload.agentRuns.length,
    memoryRowCount: payload.semanticMemory.length,
    reviewCount: payload.googleReviews.length,
    voiceNoteCount: payload.voiceNotes.length,
  };

  logger.info("agent_workers.lead_dossier_generator.done", {
    leadId,
    ms: elapsed,
    ...stats,
    outputChars: markdown.length,
  });

  const output: LeadDossierWorkerOutput = {
    markdown,
    generatedAt: new Date().toISOString(),
    stats,
  };

  return {
    output,
    // Crude prompt+output token estimate. The actual Gemini billing
    // is done downstream; this is for the workspace quota meter.
    costTokens: Math.ceil(
      (JSON.stringify(payload).length + markdown.length) / 4,
    ),
  };
};

/**
 * Dossier output is intentionally NOT mirrored to LEAD_PROFILE memory
 * — the embed_profile sentinel writes a more compact + retrieval-
 * friendly profile after SALES_OPPORTUNITY_SCORER. Two writers for
 * the same memory key would surface duplicate hits in the copilot.
 */
export const memoryWrites = (
  _output: unknown,
  _ctx: AgentWorkerContext,
): MemoryWrite[] => [];
