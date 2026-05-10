/**
 * OUTCOME_ATTRIBUTOR worker (event-driven, deterministic).
 *
 * Closes the learning loop. Triggered by terminal events:
 *   - `inbox_reply_received`           (sentiment positive/negative)
 *   - `disposition_logged`             (call disposition: BOOKED_MEETING, NOT_INTERESTED, …)
 *   - `watchlist_stage_changed`        (when transitioning into WON or LOST)
 *
 * Walks the active LeadNextAction + InsightApplication rows for the
 * lead, writes outcomes, bumps `InsightPerformance` aggregate counters,
 * and adjusts `LeadTrigger.confidence` (false-positive learning).
 *
 * No Gemini call. The outcome label is derived from the event payload
 * deterministically, so the function is replay-safe — re-running an
 * outcome attribution for the same event is idempotent because each
 * write sites on `outcome IS NULL`.
 *
 * Emits `outcome_attributed` downstream so the SDR_BRAIN can refresh
 * its NBA against the new evidence (cycle closed).
 */
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { CallDisposition, Prisma } from "@/generated/prisma/client";
import type {
  AgentWorkerContext,
  AgentWorkerOutput,
  AgentWorkerRun,
} from "./types";

type OutcomeLabel =
  | "REPLY_POSITIVE"
  | "REPLY_NEGATIVE"
  | "IGNORED"
  | "MEETING_BOOKED"
  | "WON"
  | "LOST"
  | "REJECTED";

interface AttributorInputs {
  event: "inbox_reply_received" | "disposition_logged" | "watchlist_stage_changed";
  /** Sentiment from inbox_reply_received. */
  sentiment?: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  /** Disposition from disposition_logged. */
  disposition?: CallDisposition;
  /** New stage from watchlist_stage_changed. */
  newStage?: "WON" | "LOST" | "FOLLOWUP";
}

function mapEventToOutcome(inputs: AttributorInputs): OutcomeLabel | null {
  switch (inputs.event) {
    case "inbox_reply_received": {
      if (inputs.sentiment === "POSITIVE") return "REPLY_POSITIVE";
      if (inputs.sentiment === "NEGATIVE") return "REPLY_NEGATIVE";
      return null;
    }
    case "disposition_logged": {
      switch (inputs.disposition) {
        case "BOOKED_MEETING":
          return "MEETING_BOOKED";
        case "ANSWERED_INTERESTED":
          return "REPLY_POSITIVE";
        case "ANSWERED_NOT_INTERESTED":
          return "REJECTED";
        case "OPTED_OUT":
          return "REJECTED";
        default:
          return null;
      }
    }
    case "watchlist_stage_changed": {
      if (inputs.newStage === "WON") return "WON";
      if (inputs.newStage === "LOST") return "LOST";
      return null;
    }
    default:
      return null;
  }
}

export const run: AgentWorkerRun = async (
  ctx: AgentWorkerContext,
): Promise<AgentWorkerOutput> => {
  if (!ctx.lead) throw new Error("OUTCOME_ATTRIBUTOR requires a lead context");
  const lead = ctx.lead;
  const workspaceId = ctx.workspaceId;
  const inputs = (ctx.runInputs ?? {}) as unknown as AttributorInputs;
  const outcome = mapEventToOutcome(inputs);

  if (!outcome) {
    logger.info("agent_workers.outcome_attributor.skipped_no_mappable_outcome", {
      leadId: lead.id,
      event: inputs.event,
      sentiment: inputs.sentiment,
      disposition: inputs.disposition,
      newStage: inputs.newStage,
    });
    return {
      output: { skipped: true, reason: "no_mappable_outcome", inputs },
      costTokens: 0,
    };
  }

  const now = new Date();

  // 1. Active LeadNextAction (final, non-preliminary, not yet superseded).
  const activeNba = await prisma.leadNextAction.findFirst({
    where: {
      workspaceId,
      leadId: lead.id,
      isPreliminary: false,
      supersededAt: null,
      outcome: null,
    },
    orderBy: { createdAt: "desc" },
  });

  if (activeNba) {
    await prisma.leadNextAction.update({
      where: { id: activeNba.id },
      data: { outcome, outcomeAt: now },
    });
  }

  // 2. Active InsightApplication rows (no outcome yet).
  const activeApplications = await prisma.insightApplication.findMany({
    where: { workspaceId, leadId: lead.id, outcome: null },
  });

  if (activeApplications.length > 0) {
    await prisma.insightApplication.updateMany({
      where: { id: { in: activeApplications.map((a) => a.id) } },
      data: { outcome, outcomeAt: now, attributedBy: ctx.runId },
    });
  }

  // 3. Bump InsightPerformance aggregate. We bucket by
  // (workspaceId, insightId, nicheSlug, triggerType, framework, segmentTier)
  // — the unique key on the table — so analytics queries can sum
  // across whichever dimension they care about.
  const lead_account = lead.accountId
    ? await prisma.account.findUnique({
        where: { id: lead.accountId },
        select: { tier: true },
      })
    : null;
  const niche = lead.subNicheSlug ?? lead.nicheSlug;
  // A NBA may cite multiple triggers — we attribute the outcome to the
  // first cited trigger as the "primary attribution" key. Multi-cite
  // attribution is a Phase 2 enhancement.
  const primaryTriggerType = activeNba?.triggerIds[0]
    ? (
        await prisma.leadTrigger.findUnique({
          where: { id: activeNba.triggerIds[0] },
          select: { type: true },
        })
      )?.type ?? null
    : null;

  for (const app of activeApplications) {
    const data = perfDelta(outcome);
    // Prisma's compound-unique-with-nullables typing rejects literal
    // null even though the underlying Postgres index allows it. Cast
    // through `Prisma.InsightPerformanceWhereUniqueInput` so the
    // generated client shape stays the source of truth.
    await prisma.insightPerformance.upsert({
      where: {
        workspaceId_insightId_nicheSlug_triggerType_framework_segmentTier: {
          workspaceId,
          insightId: app.insightId,
          nicheSlug: niche ?? null,
          triggerType: primaryTriggerType,
          framework: app.framework,
          segmentTier: lead_account?.tier ?? null,
        },
      } as Prisma.InsightPerformanceWhereUniqueInput,
      create: {
        workspaceId,
        insightId: app.insightId,
        nicheSlug: niche ?? null,
        triggerType: primaryTriggerType,
        framework: app.framework,
        segmentTier: lead_account?.tier ?? null,
        applied: 1,
        ...data,
      } as unknown as Prisma.InsightPerformanceUncheckedCreateInput,
      update: { ...data, applied: { increment: 1 } },
    });
  }

  // 4. Adjust LeadTrigger.confidence — small Bayesian-ish nudges so a
  // stuck-trigger workflow can't run away with the score.
  if (activeNba?.triggerIds.length) {
    if (outcome === "REPLY_POSITIVE" || outcome === "MEETING_BOOKED" || outcome === "WON") {
      await prisma.leadTrigger.updateMany({
        where: { id: { in: activeNba.triggerIds } },
        data: {
          validatedCount: { increment: 1 },
          confidence: { increment: 0.05 },
        },
      });
    } else if (outcome === "REPLY_NEGATIVE" || outcome === "REJECTED" || outcome === "LOST") {
      await prisma.leadTrigger.updateMany({
        where: { id: { in: activeNba.triggerIds } },
        data: {
          falsePositiveCount: { increment: 1 },
          confidence: { decrement: 0.05 },
        },
      });
    }
  }

  logger.info("agent_workers.outcome_attributor.done", {
    leadId: lead.id,
    workspaceId,
    event: inputs.event,
    outcome,
    nbaUpdated: activeNba != null,
    applicationsUpdated: activeApplications.length,
    primaryTriggerType,
  });

  // 5. Emit outcome_attributed downstream so a brain_refresh chain
  // can re-run the SDR_BRAIN with the freshly attributed evidence.
  await ctx.emit("outcome_attributed" as never, {
    workspaceId,
    leadId: lead.id,
    outcome,
    sourceEvent: inputs.event,
  });

  return {
    output: {
      outcome,
      nbaUpdated: activeNba != null,
      applicationsUpdated: activeApplications.length,
      primaryTriggerType,
    },
    costTokens: 0,
  };
};

function perfDelta(outcome: OutcomeLabel) {
  switch (outcome) {
    case "REPLY_POSITIVE":
      return { replyPositive: { increment: 1 } };
    case "REPLY_NEGATIVE":
      return { replyNegative: { increment: 1 } };
    case "IGNORED":
      return { ignored: { increment: 1 } };
    case "REJECTED":
      // Treat as negative reply for performance accounting.
      return { replyNegative: { increment: 1 } };
    case "MEETING_BOOKED":
      return { meetingBooked: { increment: 1 } };
    case "WON":
      return { won: { increment: 1 } };
    case "LOST":
      return { replyNegative: { increment: 1 } };
  }
}
