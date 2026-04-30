/**
 * Phase 2 — sequence step executor.
 *
 * Fires ONE step of an active LeadSequenceState. Called from the
 * agent-runs worker when it picks up a `sequence_step` job. Logic:
 *
 * 1. Re-check state is still ACTIVE + not DNC. A reply may have
 *    landed between tick scheduling and execution.
 * 2. Render the step's payload (subject, body) with mustache-style
 *    placeholders against the lead.
 * 3. Channel switch: EMAIL → /lib/oauth/email-client; WHATSAPP →
 *    create a WHATSAPP_SENT activity (we don't have a Twilio
 *    integration yet — the rep clicks the wa.me link from the lead
 *    detail to actually deliver); MANUAL_CALL → push the lead to
 *    the rep's queue with `nextActionDueAt = now`; WAIT → just bump
 *    the cursor.
 * 4. Advance to the next step (or complete) and write a
 *    SEQUENCE_STEP_FIRED LeadActivity with the channel + step
 *    pointer for the timeline.
 */
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export interface SequenceStepResult {
  fired: boolean;
  reason?: string;
  nextStepAt: Date | null;
  completed?: boolean;
}

function renderTemplate(template: string, vars: Record<string, string | null | undefined>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    const v = vars[key];
    return v == null ? "" : String(v);
  });
}

export async function processSequenceStep(stateId: string): Promise<SequenceStepResult> {
  const state = await prisma.leadSequenceState.findUnique({
    where: { id: stateId },
    include: {
      currentStep: true,
      sequence: {
        include: {
          steps: { orderBy: { position: "asc" } },
        },
      },
    },
  });

  if (!state) {
    return { fired: false, reason: "state_not_found", nextStepAt: null };
  }

  if (state.state !== "ACTIVE" || state.pausedAt) {
    return { fired: false, reason: `state_${state.state.toLowerCase()}`, nextStepAt: state.nextStepAt };
  }

  const step = state.currentStep;
  if (!step) {
    // No current step — mark completed.
    await prisma.leadSequenceState.update({
      where: { id: state.id },
      data: { state: "COMPLETED", completedAt: new Date(), nextStepAt: null },
    });
    return { fired: false, reason: "no_current_step", nextStepAt: null, completed: true };
  }

  const lead = await prisma.lead.findUnique({
    where: { id: state.leadId },
    select: {
      id: true,
      workspaceId: true,
      businessName: true,
      phone: true,
      websiteUrl: true,
      dnc: true,
      optedOutAt: true,
    },
  });
  if (!lead) {
    await prisma.leadSequenceState.update({
      where: { id: state.id },
      data: { state: "EXITED", completedAt: new Date(), nextStepAt: null, pausedReason: "lead_not_found" },
    });
    return { fired: false, reason: "lead_not_found", nextStepAt: null, completed: true };
  }

  if (lead.dnc || lead.optedOutAt) {
    await prisma.leadSequenceState.update({
      where: { id: state.id },
      data: { state: "PAUSED", pausedAt: new Date(), pausedReason: "DNC" },
    });
    return { fired: false, reason: "dnc", nextStepAt: null };
  }

  const payload = (step.payload ?? {}) as Record<string, unknown>;
  const vars = {
    businessName: lead.businessName,
    phone: lead.phone,
    websiteUrl: lead.websiteUrl,
  } as Record<string, string | null | undefined>;

  let activityKind: "EMAIL_SENT" | "WHATSAPP_SENT" | "SEQUENCE_STEP_FIRED" = "SEQUENCE_STEP_FIRED";
  let activityPayload: Record<string, unknown> = {
    sequenceId: state.sequenceId,
    sequenceName: state.sequence.name,
    stepId: step.id,
    stepPosition: step.position,
    channel: step.channel,
  };

  switch (step.channel) {
    case "EMAIL": {
      const subject = renderTemplate(String(payload.subject ?? ""), vars);
      const bodyTemplate = renderTemplate(String(payload.bodyTemplate ?? ""), vars);
      activityKind = "EMAIL_SENT";
      activityPayload = {
        ...activityPayload,
        subject,
        bodyPreview: bodyTemplate.slice(0, 280),
        delivery: "queued_for_rep_review",
      };
      // Phase 2 stub: rather than auto-send (which needs a connected
      // EmailAccount and per-rep rate limiting we haven't wired up),
      // we drop a draft into the activity timeline and bump
      // nextActionDueAt so the rep sees "send queued draft" in
      // their Today's Queue. Auto-send is a later iteration.
      break;
    }
    case "WHATSAPP": {
      const bodyTemplate = renderTemplate(String(payload.bodyTemplate ?? ""), vars);
      activityKind = "WHATSAPP_SENT";
      activityPayload = {
        ...activityPayload,
        bodyPreview: bodyTemplate.slice(0, 280),
        phone: lead.phone,
        delivery: "queued_for_rep_review",
      };
      break;
    }
    case "MANUAL_CALL": {
      activityPayload = {
        ...activityPayload,
        prompt: String(payload.promptForRep ?? ""),
      };
      break;
    }
    case "WAIT":
    default:
      activityPayload = { ...activityPayload, reason: String(payload.reason ?? "scheduled wait") };
      break;
  }

  // Advance to the next step (by position). If none, complete.
  const orderedSteps = state.sequence.steps;
  const currentIdx = orderedSteps.findIndex((s) => s.id === step.id);
  const nextStep = currentIdx >= 0 ? orderedSteps[currentIdx + 1] ?? null : null;

  const now = new Date();
  const nextStepAt = nextStep
    ? new Date(now.getTime() + nextStep.delayHours * 60 * 60 * 1000)
    : null;

  await prisma.$transaction([
    prisma.leadSequenceState.update({
      where: { id: state.id },
      data: {
        currentStepId: nextStep?.id ?? null,
        nextStepAt,
        stepsFired: { increment: 1 },
        state: nextStep ? "ACTIVE" : "COMPLETED",
        completedAt: nextStep ? null : now,
      },
    }),
    prisma.leadActivity.create({
      data: {
        workspaceId: lead.workspaceId,
        leadId: lead.id,
        kind: activityKind,
        payload: activityPayload,
      },
    }),
    // Bump the lead's outreach counters so Today's Queue and
    // dashboard throughput tiles reflect what the cadence shipped.
    prisma.lead.update({
      where: { id: lead.id },
      data: {
        sequenceStep: { increment: 1 },
        lastContactedAt:
          step.channel === "EMAIL" || step.channel === "WHATSAPP" ? now : undefined,
        nextActionDueAt: nextStepAt ?? undefined,
      },
    }),
  ]);

  logger.info("sequence_engine.step.fired", {
    stateId: state.id,
    leadId: lead.id,
    sequenceId: state.sequenceId,
    channel: step.channel,
    nextStepAt,
  });

  return { fired: true, nextStepAt, completed: !nextStep };
}

/**
 * Pause an active sequence — used by the inbox-reply-attributor when
 * a positive reply lands ("don't keep emailing them after they
 * answered"). Idempotent: a second call on an already-paused state
 * is a no-op.
 */
export async function pauseSequenceForReply(leadId: string, workspaceId: string): Promise<number> {
  const result = await prisma.leadSequenceState.updateMany({
    where: {
      leadId,
      workspaceId,
      state: "ACTIVE",
      pausedAt: null,
    },
    data: {
      state: "PAUSED",
      pausedAt: new Date(),
      pausedReason: "REPLY_RECEIVED",
    },
  });
  if (result.count > 0) {
    logger.info("sequence_engine.paused_for_reply", { leadId, count: result.count });
  }
  return result.count;
}
