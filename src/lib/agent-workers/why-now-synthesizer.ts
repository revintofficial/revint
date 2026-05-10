/**
 * WHY_NOW_SYNTHESIZER worker.
 *
 * Reads `LeadTrigger` rows + recent `TRIGGER_EVIDENCE` memory and
 * produces a single, ranked "why now" narrative for SDR_BRAIN.
 *
 * Output is intentionally lightweight — it does NOT write to
 * `LeadNextAction` directly. The SDR_BRAIN T3 worker consumes this
 * via semantic memory (REASONING_SUMMARY) and folds it into the
 * final reasoning graph + arbitration pass.
 */
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getStructuredInferenceProvider, type SchemaDefinition } from "@/lib/ai-core/providers";
import type {
  AgentWorkerContext,
  AgentWorkerOutput,
  AgentWorkerRun,
  MemoryWrite,
} from "./types";
import { REASONING_SUMMARY_REF_TYPES } from "./reasoning-ref-types";

interface WhyNowOutput {
  headline: string;
  urgencyScore: number;
  ranked: Array<{
    triggerType: string;
    triggerId: string | null;
    weight: number;
    rationale: string;
  }>;
  consolidatedQuote: string | null;
  recommendedTimingDays: number;
}

export const run: AgentWorkerRun = async (
  ctx: AgentWorkerContext,
): Promise<AgentWorkerOutput> => {
  if (!ctx.lead) throw new Error("WHY_NOW_SYNTHESIZER requires a lead context");
  const lead = ctx.lead;

  // Pull recent active triggers (decay-aware on read; we filter by
  // urgency window from the column, no need for a separate decay table).
  const triggers = await prisma.leadTrigger.findMany({
    where: { workspaceId: ctx.workspaceId, leadId: lead.id, isActive: true },
    orderBy: [{ severity: "desc" }, { confidence: "desc" }, { detectedAt: "desc" }],
    take: 12,
  });

  if (triggers.length === 0) {
    const empty: WhyNowOutput = {
      headline: "No high-confidence triggers detected yet.",
      urgencyScore: 10,
      ranked: [],
      consolidatedQuote: null,
      recommendedTimingDays: 30,
    };
    logger.info("agent_workers.why_now.empty", { leadId: lead.id });
    return { output: empty, costTokens: 0 };
  }

  // Compute weighted urgency = sum(severity * confidence * recency).
  // Recency curve: 1.0 within 7 days, 0.7 within 30, 0.4 within 60, 0.2 after.
  const now = Date.now();
  const ranked = triggers.map((t) => {
    const ageDays = (now - t.detectedAt.getTime()) / (1000 * 60 * 60 * 24);
    const recency = ageDays <= 7 ? 1 : ageDays <= 30 ? 0.7 : ageDays <= 60 ? 0.4 : 0.2;
    const weight = (t.severity / 100) * t.confidence * recency;
    const ev = t.evidence as { quote?: string; source?: string } | null;
    return {
      triggerType: t.type,
      triggerId: t.id,
      weight: Math.round(weight * 1000) / 1000,
      rationale: ev?.quote ? ev.quote.slice(0, 200) : `${t.type} (severity ${t.severity})`,
    };
  });

  ranked.sort((a, b) => b.weight - a.weight);
  const top = ranked.slice(0, 5);
  const urgencyScore = Math.min(
    100,
    Math.round(top.reduce((acc, r) => acc + r.weight, 0) * 25),
  );

  // Quick Gemini consolidation -> single sentence opener-friendly quote.
  let headline = `${top[0]?.triggerType ?? "TRIGGER"} signal detected for ${lead.businessName ?? "this lead"}.`;
  let consolidatedQuote: string | null = null;
  try {
    const provider = getStructuredInferenceProvider();
    const schema: SchemaDefinition = {
      type: "OBJECT",
      properties: {
        headline: { type: "STRING" },
        consolidatedQuote: { type: "STRING" },
      },
      required: ["headline", "consolidatedQuote"],
    };
    const result = await provider.structuredInfer<{ headline: string; consolidatedQuote: string }>({
      prompt: `Lead: ${lead.businessName ?? "(no name)"} (${lead.subNicheSlug ?? lead.nicheSlug ?? "unknown"}).
Top triggers (most relevant first):
${top.map((r, i) => `${i + 1}. ${r.triggerType} - ${r.rationale}`).join("\n")}

Write:
- headline: 1 short sentence (<= 14 words) explaining why NOW is the right moment to reach out.
- consolidatedQuote: 1 sentence an SDR can paraphrase in their cold email opener (no emojis, no exclamation).

Return JSON only.`,
      schema,
      temperature: 0.4,
      maxTokens: 256,
      timeoutMs: 20_000,
      label: "why_now_consolidate",
    });
    headline = result.data.headline.trim();
    consolidatedQuote = result.data.consolidatedQuote.trim();
  } catch (err) {
    logger.warn("agent_workers.why_now.gemini_failed", {
      leadId: lead.id,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  // Recommended timing = min urgency window across the top 3 triggers.
  const recommendedTimingDays = Math.min(
    ...triggers.slice(0, 3).map((t) => t.urgencyWindowDays),
  );

  const output: WhyNowOutput = {
    headline,
    urgencyScore,
    ranked: top,
    consolidatedQuote,
    recommendedTimingDays,
  };

  logger.info("agent_workers.why_now.done", {
    leadId: lead.id,
    workspaceId: ctx.workspaceId,
    triggerCount: triggers.length,
    urgencyScore,
  });

  return { output, costTokens: 256 };
};

export function memoryWrites(output: unknown, ctx: AgentWorkerContext): MemoryWrite[] {
  if (!ctx.leadId) return [];
  const o = output as WhyNowOutput;
  return [
    {
      kind: "REASONING_SUMMARY",
      text: `WHY_NOW: ${o.headline} | urgency=${o.urgencyScore} | timingDays=${o.recommendedTimingDays}`,
      leadId: ctx.leadId,
      refType: REASONING_SUMMARY_REF_TYPES.WhyNowSynthesizer,
      metadata: {
        urgencyScore: o.urgencyScore,
        recommendedTimingDays: o.recommendedTimingDays,
        topTriggers: o.ranked.map((r) => r.triggerType),
      },
    },
  ];
}
