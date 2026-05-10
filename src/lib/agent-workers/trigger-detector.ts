/**
 * TRIGGER_DETECTOR worker (T2 light Gemini + deterministic rules).
 *
 * Walks the lead's enrichment substrate (review analysis, social
 * scrape, hiring signals from APIFY_LINKEDIN_COMPANY, SERP results,
 * audit features) and writes `LeadTrigger` rows for the patterns that
 * fire. A short Gemini call ranks ambiguous candidates; deterministic
 * rules handle the obvious wins.
 *
 * Idempotency: each `LeadTrigger` has `@@unique([workspaceId, leadId,
 * type, detectedAt])` so re-running the detector within the same
 * minute produces no duplicates.
 *
 * Pure-rules-first design — Gemini is only used to bucket free-form
 * evidence (e.g. "is this Indeed posting actually a marketing role?")
 * into one of the existing LeadTriggerType enum values.
 */
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type {
  LeadTriggerType,
  Prisma,
} from "@/generated/prisma/client";
import { getStructuredInferenceProvider, type SchemaDefinition } from "@/lib/ai-core/providers";
import type {
  AgentWorkerContext,
  AgentWorkerOutput,
  AgentWorkerRun,
  MemoryWrite,
} from "./types";

interface DetectedTrigger {
  type: LeadTriggerType;
  severity: number;
  confidence: number;
  evidence: { source: string; refId?: string; quote?: string; url?: string };
  impactPrediction?: string;
  urgencyWindowDays: number;
}

/** Default urgency windows per trigger type (days). */
const URGENCY_WINDOW: Record<LeadTriggerType, number> = {
  NEW_LOCATION_OPENING: 90,
  CHAIN_EXPANSION: 90,
  HIRING_MARKETING: 90,
  HIRING_OPS: 60,
  HIRING_TECH: 60,
  BAD_SERVICE_REVIEWS: 30,
  RATING_DROP: 30,
  MENU_REDESIGN_SIGNAL: 60,
  BOOKING_PROVIDER_CHANGE: 60,
  DELIVERY_EXPANSION: 60,
  INTERNATIONAL_AUDIENCE_GROWTH: 90,
  SEASONAL_TOURISM: 30,
  COMPETITOR_PRESSURE: 60,
  REBRANDING: 90,
  FUNDING_RAISED: 180,
  EXEC_CHANGE: 90,
};

export const run: AgentWorkerRun = async (
  ctx: AgentWorkerContext,
): Promise<AgentWorkerOutput> => {
  if (!ctx.lead) throw new Error("TRIGGER_DETECTOR requires a lead context");
  const lead = ctx.lead;
  const workspaceId = ctx.workspaceId;

  const detected: DetectedTrigger[] = [];

  // ---- Rule 1: rating drop / bad reviews from ReviewAnalysis ----
  if (lead.reviewAnalysis) {
    const ra = lead.reviewAnalysis;
    const sentiment = (ra.sentimentBreakdown as { negative?: number } | null) ?? null;
    const negativePct = sentiment?.negative ?? 0;
    const painPhrases = Array.isArray(ra.painPhrases) ? (ra.painPhrases as string[]) : [];
    if (negativePct > 0.25 && painPhrases.length >= 3) {
      detected.push({
        type: "BAD_SERVICE_REVIEWS",
        severity: Math.round(Math.min(100, negativePct * 250)),
        confidence: 0.7,
        evidence: {
          source: "ReviewAnalysis",
          refId: ra.id,
          quote: painPhrases.slice(0, 2).join(" / "),
        },
        impactPrediction: "Customer churn risk — opener should lead with retention angle.",
        urgencyWindowDays: URGENCY_WINDOW.BAD_SERVICE_REVIEWS,
      });
    }
    if (lead.rating != null && lead.rating < 4 && (lead.reviewCount ?? 0) >= 30) {
      detected.push({
        type: "RATING_DROP",
        severity: Math.round((4.5 - lead.rating) * 30),
        confidence: 0.55,
        evidence: { source: "Lead.rating", quote: `Rating ${lead.rating} below 4.0` },
        urgencyWindowDays: URGENCY_WINDOW.RATING_DROP,
      });
    }
  }

  // ---- Rule 2: booking provider change signal from audit ----
  if (lead.websiteAudit) {
    const a = lead.websiteAudit;
    if (a.bookingProvider && a.hasBookingSystem === false) {
      detected.push({
        type: "BOOKING_PROVIDER_CHANGE",
        severity: 60,
        confidence: 0.6,
        evidence: {
          source: "WebsiteAudit",
          refId: a.id,
          quote: `Detected booking provider "${a.bookingProvider}" but live system not present.`,
        },
        urgencyWindowDays: URGENCY_WINDOW.BOOKING_PROVIDER_CHANGE,
      });
    }
  }

  // ---- Rule 3: hiring signals from LinkedIn / SERP semantic memory ----
  // Pre-loaded by the executor via memoryReads (HIRING_SIGNAL kind).
  const hiringHits = ctx.memory.filter((m) => m.kind === "HIRING_SIGNAL");
  if (hiringHits.length > 0) {
    // Bucket into MARKETING / OPS / TECH using simple keyword rules; for
    // ambiguous cases we'd ask Gemini, but the cheap rule covers ~80%.
    for (const hit of hiringHits.slice(0, 5)) {
      const text = hit.text.toLowerCase();
      let type: LeadTriggerType | null = null;
      if (/(marketing|brand|growth|content)/.test(text)) type = "HIRING_MARKETING";
      else if (/(operations|operator|ops|fulfillment|delivery)/.test(text)) type = "HIRING_OPS";
      else if (/(engineer|developer|tech|software|cto|cio|data)/.test(text)) type = "HIRING_TECH";
      if (!type) continue;
      detected.push({
        type,
        severity: 55,
        confidence: 0.6,
        evidence: { source: "SemanticMemory:HIRING_SIGNAL", refId: hit.id, quote: hit.text.slice(0, 200) },
        urgencyWindowDays: URGENCY_WINDOW[type],
      });
    }
  }

  // ---- Rule 4: SERP-detected expansion signals (new locations, intl) ----
  const serpHits = ctx.memory.filter((m) => m.kind === "SERP_SNAPSHOT");
  for (const hit of serpHits.slice(0, 3)) {
    const text = hit.text.toLowerCase();
    if (/(new location|opening|grand opening|now open)/.test(text)) {
      detected.push({
        type: "NEW_LOCATION_OPENING",
        severity: 70,
        confidence: 0.55,
        evidence: { source: "SemanticMemory:SERP_SNAPSHOT", refId: hit.id, quote: hit.text.slice(0, 200) },
        urgencyWindowDays: URGENCY_WINDOW.NEW_LOCATION_OPENING,
      });
    }
    if (/(international|expand abroad|new country|launching in)/.test(text)) {
      detected.push({
        type: "INTERNATIONAL_AUDIENCE_GROWTH",
        severity: 50,
        confidence: 0.5,
        evidence: { source: "SemanticMemory:SERP_SNAPSHOT", refId: hit.id, quote: hit.text.slice(0, 200) },
        urgencyWindowDays: URGENCY_WINDOW.INTERNATIONAL_AUDIENCE_GROWTH,
      });
    }
  }

  // ---- Optional Gemini bucketing for ambiguous evidence ----
  // For Phase 1 we only call Gemini when there's interesting Reddit /
  // social text but no rule fired — keeps token spend low.
  const ambiguousTexts = ctx.memory
    .filter((m) => m.kind === "REDDIT_MENTION" || m.kind === "SOCIAL_POST")
    .slice(0, 5);
  if (ambiguousTexts.length > 0 && detected.length === 0) {
    try {
      const provider = getStructuredInferenceProvider();
      const schema: SchemaDefinition = {
        type: "OBJECT",
        properties: {
          triggers: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                type: { type: "STRING" },
                severity: { type: "NUMBER" },
                confidence: { type: "NUMBER" },
                quote: { type: "STRING" },
              },
              required: ["type", "severity", "confidence", "quote"],
            },
          },
        },
        required: ["triggers"],
      };
      const allowedTypes: LeadTriggerType[] = Object.keys(URGENCY_WINDOW) as LeadTriggerType[];
      const result = await provider.structuredInfer<{
        triggers: Array<{ type: string; severity: number; confidence: number; quote: string }>;
      }>({
        prompt: `Classify each item below into ONE of: ${allowedTypes.join(", ")}, or skip with type="SKIP". Severity 0-100, confidence 0-1.

${ambiguousTexts.map((t, i) => `[${i}] ${t.text.slice(0, 400)}`).join("\n\n")}

Return JSON only.`,
        schema,
        temperature: 0.2,
        maxTokens: 1024,
        timeoutMs: 30_000,
        label: "trigger_detector_bucket",
      });
      for (const t of result.data.triggers) {
        if (!allowedTypes.includes(t.type as LeadTriggerType)) continue;
        detected.push({
          type: t.type as LeadTriggerType,
          severity: Math.max(0, Math.min(100, Math.round(t.severity))),
          confidence: Math.max(0, Math.min(1, t.confidence)),
          evidence: { source: "Gemini:trigger_detector_bucket", quote: t.quote.slice(0, 200) },
          urgencyWindowDays: URGENCY_WINDOW[t.type as LeadTriggerType],
        });
      }
    } catch (err) {
      logger.warn("agent_workers.trigger_detector.gemini_bucket_failed", {
        leadId: lead.id,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ---- Persist detected triggers (idempotent on the unique key) ----
  let writtenCount = 0;
  for (const t of detected) {
    try {
      await prisma.leadTrigger.create({
        data: {
          workspaceId,
          leadId: lead.id,
          type: t.type,
          severity: t.severity,
          confidence: t.confidence,
          evidence: t.evidence as unknown as Prisma.InputJsonValue,
          impactPrediction: t.impactPrediction ?? null,
          urgencyWindowDays: t.urgencyWindowDays,
        },
      });
      writtenCount += 1;
    } catch {
      // Unique constraint collision = same trigger detected within
      // the same minute (detectedAt is the dedup axis). Safe to ignore.
    }
  }

  logger.info("agent_workers.trigger_detector.done", {
    leadId: lead.id,
    workspaceId,
    detectedCount: detected.length,
    writtenCount,
  });

  return {
    output: {
      detected,
      writtenCount,
    },
    costTokens: 0,
  };
};

export function memoryWrites(output: unknown, ctx: AgentWorkerContext): MemoryWrite[] {
  if (!ctx.leadId) return [];
  const o = output as { detected: DetectedTrigger[] };
  return o.detected.slice(0, 6).map((t) => ({
    kind: "TRIGGER_EVIDENCE",
    text: `${t.type}: ${t.evidence.quote ?? ""}`.slice(0, 400),
    leadId: ctx.leadId!,
    refType: "LeadTrigger",
    refId: undefined, // we don't have the new id back from create() in batch
    metadata: { type: t.type, severity: t.severity, confidence: t.confidence },
  }));
}
