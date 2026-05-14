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
 *
 * Phase 2.1 (V2 Richness Absorption) rewire:
 *   The audit flagged this worker as THIN — it was building a tiny
 *   string from `(rating, count, first pain phrase)` and asking
 *   Gemini to invent objections from scratch. Meanwhile
 *   `LEAD_INTELLIGENCE_BRIEF` already runs upstream and writes a
 *   `replyObjections` array PLUS a `confirmedPainPoints` whitelist
 *   that names the buyer's actual friction points. Bypassing that
 *   data caused the worker to hallucinate objections that
 *   contradicted the brief.
 *
 *   The rewire below:
 *     1. Reads the latest LEAD_INTELLIGENCE_BRIEF AgentRun cache
 *        for this lead (no extra Gemini round-trip).
 *     2. Treats `brief.replyObjections` as a SEED list — each one
 *        becomes a predicted Objection row directly, with the
 *        opener-seed used as the preemptive response template.
 *     3. Asks Gemini to ENRICH the seed list with categories +
 *        likelihoods + extra rows, but ONLY citing the verified
 *        signals (confirmedPainPoints + confirmedMissingFeatures +
 *        rating/count + audit booleans).
 *
 *   When the brief hasn't run yet we fall back to the legacy
 *   "from-scratch" path so we still produce useful predictions for
 *   leads in the pre-brief window. The fallback path stays in this
 *   file for backwards compat; the new path is the default whenever
 *   a brief exists.
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

// =====================================================================
// Truth Layer v1 — T-F NBA Hygiene: predicted-objection source
// attribution.
//
// Master plan §3 / T-F: when the operator has publicly replied to a
// negative review (the canonical "voice of the operator" signal),
// downstream predicted objections MUST be seeded from that reply
// instead of from a generic segment template. The reply is the most
// truthful proxy for what the operator will themselves say in the
// first call ("we have started accepting reservations on weekends..."
// telegraphs the objection "we are already fixing it, why pay you?").
//
// The detection helper is intentionally a pure function over a narrow
// input shape: it does NOT touch Prisma, the Gemini SDK, or env vars.
// This lets the unit test (`objection-predictor-source.test.ts`) call
// it directly with fixture slices and avoid the BullMQ-worker
// scaffolding. The worker `run()` below also calls it, so production
// + test agree on the same source-attribution rule.
// =====================================================================

export type ObjectionSource =
  | "owner_reply"
  | "segment_fallback"
  | "model_inferred";

export interface ObjectionSourceInput {
  /**
   * Trimmed owner-reply text. `null` when no public operator reply is
   * available. We accept the trimmed string (not an array) because the
   * caller projects whichever shape T-D / fixtures expose down to a
   * single representative reply.
   */
  ownerReplyText: string | null;
  /**
   * Whether the upstream `LEAD_INTELLIGENCE_BRIEF` produced any seed
   * objections we could enrich. Mirrors `BriefSlice.replyObjections.length > 0`.
   */
  briefHasReplyObjections: boolean;
}

/**
 * Resolve the canonical source attribution for a predicted-objection
 * generation pass. Priority (first match wins):
 *   1. `owner_reply`        — operator publicly addressed the issue;
 *                             use the reply text verbatim as seed.
 *   2. `model_inferred`     — `LEAD_INTELLIGENCE_BRIEF` already
 *                             enriched a seed list; we re-ask Gemini
 *                             to enrich + categorise.
 *   3. `segment_fallback`   — no upstream signal, fall back to the
 *                             niche/audit template (legacy path).
 */
export function detectObjectionSource(
  input: ObjectionSourceInput,
): ObjectionSource {
  if (input.ownerReplyText && input.ownerReplyText.trim().length > 0) {
    return "owner_reply";
  }
  if (input.briefHasReplyObjections) return "model_inferred";
  return "segment_fallback";
}

/**
 * Project the owner-reply signal off `lead.reviewAnalysis`. T-D may
 * eventually add a structured `ownerReplies[]` array; until then the
 * fixture-level `_ownerReplyExample` field is the explicit channel
 * (see `tests/fixtures/leads/casa-polanco.json` etc.). Returns the
 * trimmed reply or `null` when no signal exists.
 */
export function extractOwnerReplyText(
  reviewAnalysis: { painPhrases?: unknown } | null | undefined,
): string | null {
  if (!reviewAnalysis || typeof reviewAnalysis !== "object") return null;
  const record = reviewAnalysis as Record<string, unknown>;

  // Future-compat: T-D may add an `ownerReplies` Json column whose
  // element shape is `string` or `{ text: string }`. Handle both.
  const replies = record.ownerReplies;
  if (Array.isArray(replies)) {
    for (const r of replies) {
      if (typeof r === "string" && r.trim().length > 0) return r.trim();
      if (
        r &&
        typeof r === "object" &&
        typeof (r as Record<string, unknown>).text === "string"
      ) {
        const text = ((r as Record<string, unknown>).text as string).trim();
        if (text.length > 0) return text;
      }
    }
  }

  // Today: the fixture-level marker the master plan §3 / T-F test
  // surface explicitly references.
  const example = record._ownerReplyExample;
  if (typeof example === "string" && example.trim().length > 0) {
    return example.trim();
  }
  return null;
}

/**
 * Subset of `LEAD_INTELLIGENCE_BRIEF` output we consume here. Kept
 * narrow so a schema drift in the brief doesn't ripple into this
 * worker (`outputJson` is `unknown` at the DB level).
 */
interface BriefSlice {
  headline: string | null;
  talkingPoints: string[];
  openerSeed: string | null;
  replyObjections: string[];
  confirmedPainPoints: string[];
  confirmedMissingFeatures: string[];
  redFlags: string[];
}

function pickStringArray(input: unknown, key: string): string[] {
  if (!input || typeof input !== "object") return [];
  const raw = (input as Record<string, unknown>)[key];
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is string => typeof x === "string" && x.trim().length > 0,
  );
}

function pickString(input: unknown, key: string): string | null {
  if (!input || typeof input !== "object") return null;
  const raw = (input as Record<string, unknown>)[key];
  return typeof raw === "string" && raw.trim().length > 0 ? raw : null;
}

function projectBriefSlice(raw: unknown): BriefSlice | null {
  if (!raw || typeof raw !== "object") return null;
  return {
    headline: pickString(raw, "headline"),
    talkingPoints: pickStringArray(raw, "talkingPoints"),
    openerSeed: pickString(raw, "openerSeed"),
    replyObjections: pickStringArray(raw, "replyObjections"),
    confirmedPainPoints: pickStringArray(raw, "confirmedPainPoints"),
    confirmedMissingFeatures: pickStringArray(raw, "confirmedMissingFeatures"),
    redFlags: pickStringArray(raw, "redFlags"),
  };
}

/**
 * Map a raw objection string into a category tag. Cheap heuristic
 * — pattern-match the brief's voice-of-buyer phrasing to one of
 * the well-known SDR taxonomy buckets. Anything that doesn't match
 * falls into a generic "GENERAL" bucket which is still useful for
 * dedup on subsequent re-runs.
 */
function categorizeObjection(text: string): string {
  const lower = text.toLowerCase();
  if (/price|cost|budget|expens|afford/.test(lower)) return "PRICE";
  if (/time|busy|later|right now|momento|şu an/.test(lower)) return "TIMING";
  if (/boss|partner|owner|need to ask|approval/.test(lower)) return "AUTHORITY";
  if (/need|do we even|don't need|fine without/.test(lower)) return "NEED";
  if (/trust|legit|scam|guarantee|reference/.test(lower)) return "TRUST";
  if (/already (use|have|using)|competitor|switch/.test(lower)) return "COMPETITOR";
  if (/integration|stack|api|connect/.test(lower)) return "INTEGRATION";
  if (/effort|hard|complicated|too much work/.test(lower)) return "EFFORT";
  return "GENERAL";
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
  if (audit?.hasEcommerce) features.push("has online ordering");
  if (audit?.bookingProvider) features.push(`booking provider: ${audit.bookingProvider}`);
  if (lead.rating != null) features.push(`rating ${lead.rating}/5`);
  if (lead.reviewCount != null) features.push(`${lead.reviewCount} reviews`);
  if (review?.painPhrases) {
    const phrases = (review.painPhrases as string[]).slice(0, 3);
    if (phrases.length > 0) features.push(`pain phrases: ${phrases.join(", ")}`);
  }

  // Phase 2.1 — read the latest LEAD_INTELLIGENCE_BRIEF run so we
  // can seed the predictor with grounded objections the brief
  // already inferred. Single DB query, no extra Gemini round-trip.
  const latestBriefRun = await prisma.agentRun.findFirst({
    where: {
      workspaceId: ctx.workspaceId,
      leadId: lead.id,
      workerKind: "LEAD_INTELLIGENCE_BRIEF",
      status: { in: ["SUCCEEDED", "SUCCEEDED_NO_MEMORY"] },
    },
    orderBy: { finishedAt: "desc" },
    select: { outputJson: true },
  });
  const brief = projectBriefSlice(latestBriefRun?.outputJson ?? null);

  // Truth Layer T-F: resolve the canonical source attribution BEFORE
  // we branch on the seed shape. The owner-reply path uses the reply
  // text verbatim; the brief path keeps the existing enrichment;
  // the segment fallback is the legacy from-scratch prompt. Telemetry
  // fires unconditionally (additive — gated by neither the avoidance
  // flag nor the brief presence) so the T-H dashboard can chart
  // owner_reply / model_inferred / segment_fallback share over time.
  const ownerReplyText = extractOwnerReplyText(review);
  const objectionSource = detectObjectionSource({
    ownerReplyText,
    briefHasReplyObjections: !!(brief && brief.replyObjections.length > 0),
  });
  logger.info("[truth-telemetry]", {
    event: "truth.nba.objection_source",
    leadId: lead.id,
    workspaceId: ctx.workspaceId,
    source: objectionSource,
  });

  let predicted: PredictedObjection[] = [];

  if (objectionSource === "owner_reply" && ownerReplyText) {
    // Owner-reply path: the operator's public reply IS the canonical
    // voice-of-buyer signal — they have already telegraphed what the
    // first call objection will sound like ("we are already fixing
    // it, why pay you?"). We seed Gemini with the verbatim reply
    // plus any brief context we have, and ask for a fan-out into
    // categorised objection rows. If Gemini fails we fall back to a
    // single seed row built directly from the reply text so the rep
    // never sees an empty list.
    const briefContext: string[] = [];
    if (brief?.headline) briefContext.push(`brief headline: ${brief.headline}`);
    if (brief && brief.confirmedPainPoints.length > 0) {
      briefContext.push(
        `confirmed pains: ${brief.confirmedPainPoints.slice(0, 5).join(" | ")}`,
      );
    }
    if (brief && brief.confirmedMissingFeatures.length > 0) {
      briefContext.push(
        `missing features: ${brief.confirmedMissingFeatures
          .slice(0, 5)
          .join(" | ")}`,
      );
    }
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
              required: [
                "category",
                "text",
                "likelihood",
                "preemptiveResponse",
              ],
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
        prompt: `You are inferring the TOP buyer objections for a cold outreach pitch, grounded in the operator's own public review reply.

Lead: ${lead.businessName ?? "(no name)"} (niche: ${lead.subNicheSlug ?? lead.nicheSlug ?? "unknown"})
Signals: ${features.join(" | ") || "(none)"}
Brief context: ${briefContext.join(" | ") || "(none)"}

Operator's public reply (verbatim — this IS the canonical voice of the operator):
"""
${ownerReplyText}
"""

Constraints:
- Treat the reply as the ground truth. The first objection MUST be the implicit objection the reply itself reveals (e.g. "we are already fixing it ourselves", "we are working with another vendor", "this is already in progress").
- category: short label (PRICE, TIMING, AUTHORITY, NEED, TRUST, COMPETITOR, INTEGRATION, EFFORT, GENERAL).
- text: how the operator would actually phrase the objection on a cold call (1 sentence, voice of buyer).
- likelihood: 0-1.
- preemptiveResponse: 1-2 sentences the SDR can fold into the opener to defuse it. MUST cite the reply OR a signal listed above — do NOT invent new pains.
- quote: copy the relevant fragment of the operator's reply that grounds this objection.
- Order by likelihood DESC.

Return JSON only. Max 5 entries total.`,
        schema,
        temperature: 0.25,
        maxTokens: 1024,
        timeoutMs: 30_000,
        label: "objection_predictor_owner_reply",
      });
      predicted = result.data.objections.slice(0, 5).map((o) => ({
        category: o.category.slice(0, 60),
        text: o.text.slice(0, 600),
        likelihood: Math.max(0, Math.min(1, o.likelihood)),
        preemptiveResponse: o.preemptiveResponse.slice(0, 800),
        evidence: {
          source: "OWNER_REPLY:objection_predictor",
          quote: (o.quote ?? ownerReplyText).slice(0, 200),
        },
      }));
    } catch (err) {
      logger.warn("agent_workers.objection_predictor.owner_reply_gemini_failed", {
        leadId: lead.id,
        err: err instanceof Error ? err.message : String(err),
      });
      // Hard fallback: surface the reply itself as a single seed row
      // so the rep at least sees "the operator publicly said X" as
      // the implied objection. Categorisation goes through the
      // local heuristic.
      predicted = [
        {
          category: categorizeObjection(ownerReplyText),
          text: ownerReplyText.slice(0, 600),
          likelihood: 0.75,
          preemptiveResponse:
            "Reference the operator's public reply: acknowledge their in-progress fix, then position our service as accelerating the timeline.",
          evidence: {
            source: "OWNER_REPLY:seed",
            quote: ownerReplyText.slice(0, 200),
          },
        },
      ];
    }
  } else if (
    objectionSource === "model_inferred" &&
    brief &&
    brief.replyObjections.length > 0
  ) {
    // Brief-grounded path: every objection text starts as a verified
    // brief signal, then Gemini fills in the category + likelihood +
    // preemptive response. We still ask the LLM for up to 2 EXTRA
    // entries from the niche/audit context so the rep gets the full
    // 5 slots when the brief was conservative.
    const seedObjections = brief.replyObjections.slice(0, 5);
    const briefContext: string[] = [];
    if (brief.headline) briefContext.push(`brief headline: ${brief.headline}`);
    if (brief.confirmedPainPoints.length > 0) {
      briefContext.push(
        `confirmed pains: ${brief.confirmedPainPoints.slice(0, 5).join(" | ")}`,
      );
    }
    if (brief.confirmedMissingFeatures.length > 0) {
      briefContext.push(
        `missing features: ${brief.confirmedMissingFeatures
          .slice(0, 5)
          .join(" | ")}`,
      );
    }
    if (brief.redFlags.length > 0) {
      briefContext.push(`red flags: ${brief.redFlags.slice(0, 3).join(" | ")}`);
    }

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
              required: [
                "category",
                "text",
                "likelihood",
                "preemptiveResponse",
              ],
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
        prompt: `You are enriching a pre-computed list of likely buyer objections for a cold outreach pitch.

Lead: ${lead.businessName ?? "(no name)"} (niche: ${lead.subNicheSlug ?? lead.nicheSlug ?? "unknown"})
Signals: ${features.join(" | ") || "(none)"}
Brief context: ${briefContext.join(" | ") || "(none)"}

Seed objections (from LEAD_INTELLIGENCE_BRIEF, verbatim voice of buyer):
${seedObjections.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Constraints:
- Return EXACTLY the same number of seed entries first (keep their text verbatim), then add UP TO 2 more if the signals support them.
- category: short label (PRICE, TIMING, AUTHORITY, NEED, TRUST, COMPETITOR, INTEGRATION, EFFORT, GENERAL).
- text: voice of buyer, 1 sentence — keep the seed's wording for seeded rows.
- likelihood: 0-1 (seed rows: 0.6-0.9; new rows: <= 0.6).
- preemptiveResponse: 1-2 sentences the SDR can fold into the opener to defuse this objection. MUST only cite signals listed in "Brief context" or "Signals" — do NOT invent new pains.
- Order by likelihood DESC.

Return JSON only. Max 5 entries total.`,
        schema,
        temperature: 0.25,
        maxTokens: 1024,
        timeoutMs: 30_000,
        label: "objection_predictor_brief",
      });
      predicted = result.data.objections.slice(0, 5).map((o) => ({
        category: o.category.slice(0, 60),
        text: o.text.slice(0, 600),
        likelihood: Math.max(0, Math.min(1, o.likelihood)),
        preemptiveResponse: o.preemptiveResponse.slice(0, 800),
        evidence: {
          source: "LEAD_INTELLIGENCE_BRIEF:objection_predictor",
          quote: o.quote?.slice(0, 200),
        },
      }));
    } catch (err) {
      logger.warn("agent_workers.objection_predictor.brief_gemini_failed", {
        leadId: lead.id,
        err: err instanceof Error ? err.message : String(err),
      });
      // Hard fallback to the seed-only path: if Gemini fails we
      // still emit the brief's objections directly (categorized via
      // the local heuristic) so the rep gets SOMETHING usable.
      predicted = seedObjections.map((text) => ({
        category: categorizeObjection(text),
        text: text.slice(0, 600),
        likelihood: 0.7,
        preemptiveResponse:
          brief.openerSeed?.slice(0, 800) ??
          "Acknowledge the concern, name a customer who shared the same worry, share the 30-day outcome.",
        evidence: {
          source: "LEAD_INTELLIGENCE_BRIEF:seed",
          quote: text.slice(0, 200),
        },
      }));
    }
  } else {
    // Legacy from-scratch path: the brief hasn't run yet, so we
    // continue to use the original prompt with the audit/review
    // feature string. We log a counter so we can monitor how often
    // the new path is bypassed in production.
    logger.info("agent_workers.objection_predictor.no_brief_fallback", {
      leadId: lead.id,
      workspaceId: ctx.workspaceId,
    });
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
              required: [
                "category",
                "text",
                "likelihood",
                "preemptiveResponse",
              ],
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
        evidence: {
          source: "Gemini:objection_predictor",
          quote: o.quote?.slice(0, 200),
        },
      }));
    } catch (err) {
      logger.warn("agent_workers.objection_predictor.gemini_failed", {
        leadId: lead.id,
        err: err instanceof Error ? err.message : String(err),
      });
    }
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
    output: {
      predicted,
      writtenCount,
      // Truth Layer T-F: surface the source attribution on the worker
      // output so downstream consumers (UI / dashboards / replay tests)
      // can pivot on it without re-deriving from log lines.
      objectionSource,
    },
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
