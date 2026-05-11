/**
 * SPIN_EXTRACTOR worker.
 *
 * Classifies free-form discovery text (voice note transcript or rep
 * notes) into a `DiscoverySession` + per-sentence `DiscoveryItem`s
 * tagged with `SpinKind` (SITUATION / PROBLEM / IMPLICATION /
 * NEED_PAYOFF). The dashboard renders the four buckets so reps can
 * see at a glance whether they've actually surfaced pain + payoff
 * vs. only collecting situational facts.
 */
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { Prisma, SpinKind } from "@/generated/prisma/client";
import { getStructuredInferenceProvider, type SchemaDefinition } from "@/lib/ai-core/providers";
import type {
  AgentWorkerContext,
  AgentWorkerOutput,
  AgentWorkerRun,
  MemoryWrite,
} from "./types";

interface SpinExtraction {
  sessionId: string;
  items: Array<{
    spinKind: SpinKind;
    text: string;
    confidence: number;
    evidence: string;
  }>;
  bucketCounts: Record<SpinKind, number>;
}

const ALLOWED: SpinKind[] = ["SITUATION", "PROBLEM", "IMPLICATION", "NEED_PAYOFF"];

export const run: AgentWorkerRun = async (
  ctx: AgentWorkerContext,
): Promise<AgentWorkerOutput> => {
  if (!ctx.lead) throw new Error("SPIN_EXTRACTOR requires a lead context");
  const lead = ctx.lead;

  const sourceText =
    typeof ctx.runInputs?.sourceText === "string" ? (ctx.runInputs.sourceText as string) : "";
  const sourceRefId =
    typeof ctx.runInputs?.sourceRefId === "string"
      ? (ctx.runInputs.sourceRefId as string)
      : null;
  const sourceLabel =
    typeof ctx.runInputs?.source === "string" ? (ctx.runInputs.source as string) : "MANUAL";

  if (!sourceText || sourceText.trim().length < 30) {
    logger.info("agent_workers.spin.no_source", { leadId: lead.id });
    return {
      output: { sessionId: null, items: [], bucketCounts: emptyCounts() },
      costTokens: 0,
    };
  }

  // Find an active watchlist item if any so the session links into the deal.
  const watchlistItem = await prisma.watchlistItem.findFirst({
    where: { leadId: lead.id, lead: { workspaceId: ctx.workspaceId } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  // Create the session first; items follow once we have the ID.
  const session = await prisma.discoverySession.create({
    data: {
      workspaceId: ctx.workspaceId,
      leadId: lead.id,
      watchlistItemId: watchlistItem?.id ?? null,
      source: sourceLabel,
      sourceRefId,
      notes: sourceText.slice(0, 4000),
      conductedBy: ctx.userId ?? null,
    },
  });

  let items: SpinExtraction["items"] = [];
  try {
    const provider = getStructuredInferenceProvider();
    const schema: SchemaDefinition = {
      type: "OBJECT",
      properties: {
        items: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              spinKind: { type: "STRING" },
              text: { type: "STRING" },
              confidence: { type: "NUMBER" },
              evidence: { type: "STRING" },
            },
            required: ["spinKind", "text", "confidence", "evidence"],
          },
        },
      },
      required: ["items"],
    };
    const result = await provider.structuredInfer<{
      items: Array<{ spinKind: string; text: string; confidence: number; evidence: string }>;
    }>({
      prompt: `Classify each meaningful sentence in the discovery transcript below into ONE of:
SITUATION, PROBLEM, IMPLICATION, NEED_PAYOFF.

Definitions:
- SITUATION: factual current state (number of locations, current POS, etc.)
- PROBLEM: pain or dissatisfaction expressed by the prospect
- IMPLICATION: downstream effect of the problem (revenue loss, NPS hit, churn)
- NEED_PAYOFF: prospect-articulated value of solving the problem

Rules:
- Only include sentences that fit one of the four kinds. Skip filler.
- text: a concise paraphrase (1 sentence)
- evidence: verbatim quote from the transcript (must be a substring)
- confidence: 0-1; only ≥0.7 when the sentence is unambiguous

Transcript:
"""
${sourceText.slice(0, 6000)}
"""

Return JSON only.`,
      schema,
      temperature: 0.1,
      maxTokens: 2048,
      timeoutMs: 30_000,
      label: "spin_classify",
    });
    items = result.data.items
      .filter((i) => ALLOWED.includes(i.spinKind as SpinKind))
      .filter((i) => sourceText.includes(i.evidence.slice(0, 80)))
      .map((i) => ({
        spinKind: i.spinKind as SpinKind,
        text: i.text.slice(0, 600),
        confidence: Math.max(0, Math.min(1, i.confidence)),
        evidence: i.evidence.slice(0, 800),
      }));
  } catch (err) {
    logger.warn("agent_workers.spin.gemini_failed", {
      leadId: lead.id,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  if (items.length > 0) {
    await prisma.discoveryItem.createMany({
      data: items.map((i) => ({
        sessionId: session.id,
        spinKind: i.spinKind,
        text: i.text,
        evidence: i.evidence,
        evidenceSpan: { quote: i.evidence } as unknown as Prisma.InputJsonValue,
        confidence: i.confidence,
      })),
    });
  }

  const bucketCounts = emptyCounts();
  for (const i of items) bucketCounts[i.spinKind] += 1;

  logger.info("agent_workers.spin.done", {
    leadId: lead.id,
    sessionId: session.id,
    itemCount: items.length,
    bucketCounts,
  });

  return {
    output: { sessionId: session.id, items, bucketCounts },
    costTokens: 2048,
  };
};

function emptyCounts(): Record<SpinKind, number> {
  return { SITUATION: 0, PROBLEM: 0, IMPLICATION: 0, NEED_PAYOFF: 0 };
}

export function memoryWrites(output: unknown, ctx: AgentWorkerContext): MemoryWrite[] {
  if (!ctx.leadId) return [];
  const o = output as SpinExtraction;
  if (o.items.length === 0) return [];
  return o.items.slice(0, 10).map((i) => ({
    kind: "SPIN_ITEM",
    text: `${i.spinKind}: ${i.text} -- "${i.evidence.slice(0, 200)}"`,
    leadId: ctx.leadId!,
    refType: "DiscoveryItem",
    metadata: { spinKind: i.spinKind, sessionId: o.sessionId, confidence: i.confidence },
  }));
}
