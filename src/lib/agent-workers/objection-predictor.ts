/**
 * OBJECTION_PREDICTOR worker.
 *
 * Forecasts the most likely objections this prospect will raise BEFORE
 * outreach, and seeds a pre-built "preemptive response" the SDR can use
 * in their opener / discovery script. Writes Objection rows with
 * source = PREDICTED so the inbox-reply-attributor can later mark them
 * as REAL when they actually surface.
 *
 * Design notes:
 *   - Niche packs supply the seed objection list; the worker re-ranks
 *     based on lead-specific signals (rating, review themes, audit
 *     features, watchlist stage history).
 *   - We cap at 5 to keep the SDR_BRAIN prompt budget bounded.
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

interface PredictedObjection {
  category: string;
  text: string;
  likelihood: number;
  preemptiveResponse: string;
  evidence: { source: string; quote?: string };
}

export const run: AgentWorkerRun = async (
  ctx: AgentWorkerContext,
): Promise<AgentWorkerOutput> => {
  if (!ctx.lead) throw new Error("OBJECTION_PREDICTOR requires a lead context");
  const lead = ctx.lead;

  const audit = lead.websiteAudit;
  const review = lead.reviewAnalysis;

  // Build a compact context block.
  const features: string[] = [];
  if (audit?.hasBookingSystem) features.push("has booking system");
  else features.push("no booking system");
  if (audit?.hasOnlineOrdering) features.push("has online ordering");
  if (audit?.bookingProvider) features.push(`booking provider: ${audit.bookingProvider}`);
  if (audit?.posProvider) features.push(`POS: ${audit.posProvider}`);
  if (lead.rating != null) features.push(`rating ${lead.rating}/5`);
  if (lead.reviewCount != null) features.push(`${lead.reviewCount} reviews`);
  if (review?.painPhrases) {
    const phrases = (review.painPhrases as string[]).slice(0, 3);
    if (phrases.length > 0) features.push(`pain phrases: ${phrases.join(", ")}`);
  }

  let predicted: PredictedObjection[] = [];
  try {
    const provider = getStructuredInferenceProvider();
    const schema: SchemaDefinition = {
      type: "OBJECT",
      properties: {
        objections: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              category: { type: "STRING" },
              text: { type: "STRING" },
              likelihood: { type: "NUMBER" },
              preemptiveResponse: { type: "STRING" },
              quote: { type: "STRING" },
            },
            required: ["category", "text", "likelihood", "preemptiveResponse"],
          },
        },
      },
      required: ["objections"],
    };
    const result = await provider.structuredInfer<{
      objections: Array<{
        category: string;
        text: string;
        likelihood: number;
        preemptiveResponse: string;
        quote?: string;
      }>;
    }>({
      prompt: `Predict the TOP 5 objections this prospect is most likely to raise to a cold outreach pitch.

Lead: ${lead.businessName ?? "(no name)"} (niche: ${lead.subNicheSlug ?? lead.nicheSlug ?? "unknown"})
Signals: ${features.join(" | ") || "(none)"}

Constraints:
- category: short label (PRICE, TIMING, AUTHORITY, NEED, TRUST, COMPETITOR, INTEGRATION, EFFORT, etc.)
- text: how the prospect would actually phrase it (1 sentence, voice of buyer)
- likelihood: 0-1 (how likely they are to raise this)
- preemptiveResponse: 1-2 sentences the SDR can fold into the opener to defuse it
- Order by likelihood DESC

Return JSON only. Max 5 entries.`,
      schema,
      temperature: 0.3,
      maxTokens: 1024,
      timeoutMs: 30_000,
      label: "objection_predictor",
    });
    predicted = result.data.objections.slice(0, 5).map((o) => ({
      category: o.category.slice(0, 60),
      text: o.text.slice(0, 600),
      likelihood: Math.max(0, Math.min(1, o.likelihood)),
      preemptiveResponse: o.preemptiveResponse.slice(0, 800),
      evidence: { source: "Gemini:objection_predictor", quote: o.quote?.slice(0, 200) },
    }));
  } catch (err) {
    logger.warn("agent_workers.objection_predictor.gemini_failed", {
      leadId: lead.id,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  // Persist as PREDICTED Objection rows. Dedup on (workspaceId, leadId,
  // category, source) so re-runs update rather than duplicate.
  let writtenCount = 0;
  for (const o of predicted) {
    try {
      const existing = await prisma.objection.findFirst({
        where: {
          workspaceId: ctx.workspaceId,
          leadId: lead.id,
          source: "PREDICTED",
          category: o.category,
        },
      });
      if (existing) {
        await prisma.objection.update({
          where: { id: existing.id },
          data: {
            text: o.text,
            rebuttalUsed: o.preemptiveResponse,
            evidenceRefType: o.evidence.source,
            evidenceRefId: o.evidence.quote ?? null,
          },
        });
      } else {
        await prisma.objection.create({
          data: {
            workspaceId: ctx.workspaceId,
            leadId: lead.id,
            source: "PREDICTED",
            category: o.category,
            text: o.text,
            rebuttalUsed: o.preemptiveResponse,
            evidenceRefType: o.evidence.source,
            evidenceRefId: o.evidence.quote ?? null,
          },
        });
      }
      writtenCount += 1;
    } catch (err) {
      logger.warn("agent_workers.objection_predictor.persist_failed", {
        leadId: lead.id,
        category: o.category,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info("agent_workers.objection_predictor.done", {
    leadId: lead.id,
    workspaceId: ctx.workspaceId,
    predictedCount: predicted.length,
    writtenCount,
  });

  return {
    output: { predicted, writtenCount },
    costTokens: 1024,
  };
};

export function memoryWrites(output: unknown, ctx: AgentWorkerContext): MemoryWrite[] {
  if (!ctx.leadId) return [];
  const o = output as { predicted: PredictedObjection[] };
  if (o.predicted.length === 0) return [];
  return [
    {
      kind: "REASONING_SUMMARY",
      text: `OBJECTIONS_PREDICTED: ${o.predicted
        .slice(0, 3)
        .map((p) => `${p.category}(${Math.round(p.likelihood * 100)}%)`)
        .join(", ")}`,
      leadId: ctx.leadId,
      refType: REASONING_SUMMARY_REF_TYPES.ObjectionPredictor,
      metadata: {
        topCategories: o.predicted.map((p) => p.category),
      },
    },
  ];
}
