/**
 * MEDDPICC_EXTRACTOR worker.
 *
 * Reads a free-form input (voice note transcript, email thread, manual
 * notes) and extracts evidence-grounded MEDDPICC facts:
 *   - Metrics (avgOrderValue, monthlyRevenue, etc.)
 *   - Economic Buyer
 *   - Decision Criteria
 *   - Decision Process
 *   - Paper Process
 *   - Identify Pain
 *   - Champion
 *   - Competition
 *
 * Each fact is persisted as a `DealQualificationFact` row keyed by
 * `(workspaceId, watchlistItemId, fieldPath)`. New extractions for the
 * same fieldPath supersede the prior fact (set `supersededAt`) so the
 * timeline is preserved while reads always project the latest value.
 *
 * Triggered when a voice note is added on a watchlisted lead OR when
 * an inbound reply hits a deal in NEGOTIATION/PROPOSAL stage.
 */
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { Prisma } from "@/generated/prisma/client";
import { getStructuredInferenceProvider, type SchemaDefinition } from "@/lib/ai-core/providers";
import type {
  AgentWorkerContext,
  AgentWorkerOutput,
  AgentWorkerRun,
  MemoryWrite,
} from "./types";

interface MeddpiccFact {
  fieldPath: string;
  value: unknown;
  confidence: number;
  sourceQuote: string;
}

interface MeddpiccOutput {
  watchlistItemId: string | null;
  facts: MeddpiccFact[];
  fillCompletePct: number;
  riskScore: number;
}

const MEDDPICC_FIELDS = [
  "metric.avgOrderValue",
  "metric.monthlyRevenue",
  "metric.locationsCount",
  "economicBuyer.name",
  "economicBuyer.title",
  "decisionCriteria.primary",
  "decisionCriteria.secondary",
  "decisionProcess.steps",
  "decisionProcess.timeline",
  "paperProcess.contractApproval",
  "paperProcess.legalReview",
  "identifyPain.primary",
  "identifyPain.cost",
  "champion.name",
  "champion.influence",
  "competition.incumbent",
  "competition.evaluating",
];

export const run: AgentWorkerRun = async (
  ctx: AgentWorkerContext,
): Promise<AgentWorkerOutput> => {
  if (!ctx.lead) throw new Error("MEDDPICC_EXTRACTOR requires a lead context");
  const lead = ctx.lead;

  // Find the active watchlist item for this lead. MEDDPICC only makes
  // sense for deals in pipeline; bail out cleanly otherwise.
  const watchlistItem = await prisma.watchlistItem.findFirst({
    where: { workspaceId: ctx.workspaceId, leadId: lead.id },
    orderBy: { createdAt: "desc" },
  });
  if (!watchlistItem) {
    logger.info("agent_workers.meddpicc.no_watchlist", { leadId: lead.id });
    return {
      output: { watchlistItemId: null, facts: [], fillCompletePct: 0, riskScore: 0 },
      costTokens: 0,
    };
  }

  // Source text for extraction. Prefer recent voice-note transcripts
  // (passed in via runInputs.sourceText), falling back to memory hits.
  const sourceText =
    typeof ctx.runInputs?.sourceText === "string"
      ? (ctx.runInputs.sourceText as string)
      : ctx.memory
          .filter((m) => m.kind === "VOICE_NOTE" || m.kind === "COPILOT_TURN")
          .slice(0, 6)
          .map((m) => m.text)
          .join("\n---\n");

  if (!sourceText || sourceText.trim().length < 40) {
    logger.info("agent_workers.meddpicc.no_source", { leadId: lead.id });
    return {
      output: {
        watchlistItemId: watchlistItem.id,
        facts: [],
        fillCompletePct: 0,
        riskScore: 0,
      },
      costTokens: 0,
    };
  }

  let facts: MeddpiccFact[] = [];
  try {
    const provider = getStructuredInferenceProvider();
    const schema: SchemaDefinition = {
      type: "OBJECT",
      properties: {
        facts: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              fieldPath: { type: "STRING" },
              value: { type: "STRING" },
              confidence: { type: "NUMBER" },
              sourceQuote: { type: "STRING" },
            },
            required: ["fieldPath", "value", "confidence", "sourceQuote"],
          },
        },
      },
      required: ["facts"],
    };
    const result = await provider.structuredInfer<{
      facts: Array<{ fieldPath: string; value: string; confidence: number; sourceQuote: string }>;
    }>({
      prompt: `Extract MEDDPICC facts from the source text below.

Allowed fieldPath values:
${MEDDPICC_FIELDS.map((f) => `- ${f}`).join("\n")}

Rules:
- Only emit a fact when the source text directly supports it (sourceQuote MUST be a verbatim substring).
- confidence is 0-1; use 0.5 for paraphrased / inferred, 0.8+ only when literally stated.
- value is a string; numbers should be passed as strings (e.g. "1200" for $1,200 AOV).
- Skip fields not supported by the source.

Source:
"""
${sourceText.slice(0, 6000)}
"""

Return JSON only.`,
      schema,
      temperature: 0.1,
      maxTokens: 1536,
      timeoutMs: 30_000,
      label: "meddpicc_extract",
    });
    facts = result.data.facts
      .filter((f) => MEDDPICC_FIELDS.includes(f.fieldPath))
      .filter((f) => sourceText.includes(f.sourceQuote.slice(0, 80)))
      .slice(0, MEDDPICC_FIELDS.length)
      .map((f) => ({
        fieldPath: f.fieldPath,
        value: f.value,
        confidence: Math.max(0, Math.min(1, f.confidence)),
        sourceQuote: f.sourceQuote.slice(0, 600),
      }));
  } catch (err) {
    logger.warn("agent_workers.meddpicc.gemini_failed", {
      leadId: lead.id,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  // Persist facts. Supersede prior facts for the same fieldPath.
  for (const f of facts) {
    try {
      await prisma.dealQualificationFact.updateMany({
        where: {
          workspaceId: ctx.workspaceId,
          watchlistItemId: watchlistItem.id,
          fieldPath: f.fieldPath,
          supersededAt: null,
        },
        data: { supersededAt: new Date() },
      });
      await prisma.dealQualificationFact.create({
        data: {
          workspaceId: ctx.workspaceId,
          watchlistItemId: watchlistItem.id,
          fieldPath: f.fieldPath,
          value: f.value as unknown as Prisma.InputJsonValue,
          confidence: f.confidence,
          sourceQuote: f.sourceQuote,
          extractedBy: "MEDDPICC_EXTRACTOR",
        },
      });
    } catch (err) {
      logger.warn("agent_workers.meddpicc.persist_failed", {
        leadId: lead.id,
        fieldPath: f.fieldPath,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Roll up DealQualification fillCompletePct + riskScore.
  const allFacts = await prisma.dealQualificationFact.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      watchlistItemId: watchlistItem.id,
      supersededAt: null,
    },
    select: { fieldPath: true, confidence: true },
  });
  const filledPaths = new Set(allFacts.map((f) => f.fieldPath));
  const fillCompletePct = Math.round((filledPaths.size / MEDDPICC_FIELDS.length) * 100);
  const avgConfidence =
    allFacts.length > 0
      ? allFacts.reduce((s, f) => s + f.confidence, 0) / allFacts.length
      : 0;
  const riskScore = Math.max(0, Math.min(100, Math.round((1 - avgConfidence) * 60 + (100 - fillCompletePct) * 0.4)));

  await prisma.dealQualification.upsert({
    where: { watchlistItemId: watchlistItem.id },
    create: {
      watchlistItemId: watchlistItem.id,
      workspaceId: ctx.workspaceId,
      fillCompletePct,
      riskScore,
      lastExtractedAt: new Date(),
    },
    update: {
      fillCompletePct,
      riskScore,
      lastExtractedAt: new Date(),
    },
  });

  const output: MeddpiccOutput = {
    watchlistItemId: watchlistItem.id,
    facts,
    fillCompletePct,
    riskScore,
  };

  logger.info("agent_workers.meddpicc.done", {
    leadId: lead.id,
    workspaceId: ctx.workspaceId,
    factCount: facts.length,
    fillCompletePct,
    riskScore,
  });

  return { output, costTokens: 1536 };
};

export function memoryWrites(output: unknown, ctx: AgentWorkerContext): MemoryWrite[] {
  if (!ctx.leadId) return [];
  const o = output as MeddpiccOutput;
  if (o.facts.length === 0) return [];
  return o.facts.slice(0, 8).map((f) => ({
    kind: "MEDDPICC_FACT",
    text: `${f.fieldPath}: ${typeof f.value === "string" ? f.value : JSON.stringify(f.value)} -- "${f.sourceQuote.slice(0, 200)}"`,
    leadId: ctx.leadId!,
    refType: "DealQualificationFact",
    metadata: {
      fieldPath: f.fieldPath,
      confidence: f.confidence,
      watchlistItemId: o.watchlistItemId,
    },
  }));
}
