/**
 * AI Core - sentinel implementations.
 *
 * Sentinels are tiny DB-only operations that the orchestrator runs
 * inline as DAG steps (instead of enqueueing a worker + registry +
 * quota check + worker output). Each lives behind a string id in
 * `SENTINEL_STEPS` (chains.ts); the orchestrator matches on the id
 * and calls the corresponding function here.
 *
 * Rules for adding new sentinels:
 *   - Must be fast (< 5 seconds). If slower, promote to a full
 *     worker with its own AgentRun row.
 *   - Must be idempotent. DAG retries should not double-write.
 *   - Must not call external APIs (embedding counts; see below).
 *     Embedding goes through `ai-core/embed.ts` which already has
 *     retries + backoff, so it's acceptable inside a sentinel.
 */
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { upsert, upsertAndEmbed, enqueueReembed } from "./memory";
import { EmbeddingError } from "./embed";

/**
 * Embeds a compact LEAD_PROFILE summary into SemanticMemory so the
 * lead immediately participates in copilot retrieval + lookalike
 * searches. Called at the tail of the `lead_created` and
 * `user_deep_research` chains.
 *
 * Idempotency: `upsert` matches on refType+refId so re-running
 * overwrites the existing row.
 */
export async function embedLeadProfile(args: {
  workspaceId: string;
  leadId: string;
}): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: args.leadId },
    include: {
      websiteAudit: true,
      salesOpportunity: true,
      reviewAnalysis: true,
    },
  });

  if (!lead || lead.workspaceId !== args.workspaceId) {
    logger.warn("sentinel.embed_lead_profile.missing", { leadId: args.leadId });
    return;
  }

  const lines: string[] = [];
  lines.push(`Business: ${lead.businessName}`);
  if (lead.primaryType) lines.push(`Category: ${lead.primaryType}`);
  lines.push(`Address: ${lead.formattedAddress}`);
  if (lead.borough) lines.push(`Borough: ${lead.borough}`);
  if (lead.rating !== null) {
    lines.push(`Rating: ${lead.rating} (${lead.reviewCount ?? 0} reviews)`);
  }
  lines.push(`Has website: ${lead.hasWebsite ? "yes" : "no"}`);

  const audit = lead.websiteAudit;
  if (audit) {
    if (audit.title) lines.push(`Site title: ${audit.title}`);
    if (audit.metaDescription) lines.push(`Meta: ${audit.metaDescription}`);
    const services = Array.isArray(audit.servicesDetected)
      ? (audit.servicesDetected as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
    if (services.length) lines.push(`Services: ${services.slice(0, 8).join(", ")}`);
    const flags: string[] = [];
    if (!audit.mobileFriendlyGuess) flags.push("not mobile friendly");
    if (!audit.hasBookingSystem) flags.push("no booking");
    if (!audit.hasWhatsappLink) flags.push("no WhatsApp");
    if (!audit.https) flags.push("no HTTPS");
    if (flags.length) lines.push(`Weaknesses: ${flags.join(", ")}`);
  }

  const review = lead.reviewAnalysis;
  if (review) {
    if (review.summary) lines.push(`Review summary: ${review.summary}`);
    const pains = Array.isArray(review.painPhrases)
      ? (review.painPhrases as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
    if (pains.length) lines.push(`Pain phrases: ${pains.slice(0, 6).join("; ")}`);
    if (review.leadScore !== null && review.leadScore !== undefined) {
      lines.push(`Review lead score: ${review.leadScore}`);
    }
  }

  const opp = lead.salesOpportunity;
  if (opp) {
    lines.push(`Opportunity score: ${opp.opportunityScore}`);
    if (opp.bestSalesAngle) lines.push(`Sales angle: ${opp.bestSalesAngle}`);
    const codes = Array.isArray(opp.reasonCodes)
      ? (opp.reasonCodes as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
    if (codes.length) lines.push(`Reason codes: ${codes.slice(0, 8).join(", ")}`);
    const pains = Array.isArray(opp.likelyPainPoints)
      ? (opp.likelyPainPoints as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
    if (pains.length) lines.push(`Likely pains: ${pains.slice(0, 6).join("; ")}`);
    if (opp.expectedPriceBand) lines.push(`Price band: ${opp.expectedPriceBand}`);
  }

  const text = lines.join("\n");
  const upsertArgs = {
    workspaceId: args.workspaceId,
    kind: "LEAD_PROFILE" as const,
    text,
    leadId: args.leadId,
    refType: "lead",
    refId: args.leadId,
    metadata: {
      opportunityScore: opp?.opportunityScore ?? null,
      reviewScore: review?.leadScore ?? null,
      hasWebsite: lead.hasWebsite,
      status: opp?.status ?? null,
    },
  };

  // Degraded path. The April-26 outage on workspace
  // 5496e39e-cc76-41bd-b18b-f1128fb9e41b had Gemini's embedding
  // endpoint returning 429s for the whole batch; the sentinel was
  // mandatory at that time and crashed the planner_session even
  // though every other step succeeded. Mirror the
  // `persistMemoryWrites` fallback in `agent-workers/execute.ts`:
  // when embedding fails, persist the row WITHOUT a vector and
  // enqueue an `embed` job so the worker backfills when Gemini
  // recovers. Any non-EmbeddingError still propagates so real bugs
  // (DB outage, dim mismatch) fail loudly.
  try {
    await upsertAndEmbed(upsertArgs);
    logger.info("sentinel.embed_lead_profile.done", {
      leadId: args.leadId,
      textLen: text.length,
    });
    return;
  } catch (err) {
    if (!(err instanceof EmbeddingError)) throw err;
    const memoryId = await upsert(upsertArgs);
    await enqueueReembed(memoryId, args.workspaceId);
    logger.warn("sentinel.embed_lead_profile.degraded", {
      leadId: args.leadId,
      memoryId,
      textLen: text.length,
      err: err.message,
    });
  }
}

/**
 * Writes OPENER_SUCCESS / OPENER_FAILURE memory for the learning
 * loop. Called at the tail of the `inbox_reply_received` chain after
 * INBOX_REPLY_ATTRIBUTOR has updated the SalesOpportunity status.
 *
 * Implementation note: we key on the SalesOpportunity status AFTER
 * attribution. Interested/Meeting/Won -> success. Everything else
 * (not yet) writes no memory; a bare "unsubscribe" reply shouldn't
 * become a FAILURE example until the signal is strong.
 */
export async function writeOpenerOutcome(args: {
  workspaceId: string;
  leadId: string;
}): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: args.leadId },
    include: { salesOpportunity: true },
  });

  if (!lead || lead.workspaceId !== args.workspaceId) {
    logger.warn("sentinel.write_opener_outcome.missing", { leadId: args.leadId });
    return;
  }

  const opp = lead.salesOpportunity;
  if (!opp?.personalizedFirstMessage) {
    // No stored opener text to learn from.
    return;
  }

  const status = opp.status;
  const isSuccess =
    status === "INTERESTED" || status === "MEETING" || status === "WON";
  const isFailure = status === "LOST";

  if (!isSuccess && !isFailure) return;

  const kind = isSuccess ? "OPENER_SUCCESS" : "OPENER_FAILURE";

  await upsertAndEmbed({
    workspaceId: args.workspaceId,
    kind,
    text: opp.personalizedFirstMessage,
    leadId: args.leadId,
    refType: "opener_outcome",
    refId: `${args.leadId}:${status}`,
    metadata: {
      leadId: args.leadId,
      status,
      opportunityScore: opp.opportunityScore,
      suggestedOffer: opp.suggestedOffer,
    },
  });

  logger.info("sentinel.write_opener_outcome.done", {
    leadId: args.leadId,
    kind,
  });
}
