/**
 * Starts the WORKSPACE_CONTEXT_EXTRACTOR calibration run for a workspace.
 *
 * Mirrors the canonical ad-hoc worker trigger in
 * `POST /api/leads/[id]/workers/[kind]`: insert a PENDING AgentRun
 * (workspace-level, leadId = null), then race a BullMQ enqueue against a
 * short deadline and fall back to inline execution when Redis is down.
 *
 * Best-effort: if quota/plan blocks the run we mark the draft FAILED with a
 * friendly message so the wizard shows the manual-entry fallback instead of
 * hard-blocking the company step.
 */
import type { Plan } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getAgentRunsQueue } from "@/lib/queues";
import { executeAgentRun } from "@/lib/agent-workers/execute";
import {
  assertWorkerQuota,
  PlanTooLowError,
  QuotaExceededError,
} from "@/lib/agent-workers/quota";

let redisDownUntil = 0;
const REDIS_DOWN_TTL_MS = 30_000;

async function tryEnqueue(runId: string, timeoutMs = 1500): Promise<boolean> {
  if (Date.now() < redisDownUntil) return false;
  try {
    const queue = getAgentRunsQueue();
    const addPromise = queue.add(
      `agent-run-${runId}`,
      { runId },
      {
        attempts: 2,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 500,
        removeOnFail: 500,
      },
    );
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("queue_enqueue_timeout")), timeoutMs),
    );
    await Promise.race([addPromise, timeout]);
    redisDownUntil = 0;
    return true;
  } catch {
    redisDownUntil = Date.now() + REDIS_DOWN_TTL_MS;
    return false;
  }
}

export interface StartCalibrationResult {
  started: boolean;
  runId?: string;
  reason?: string;
}

export async function startWorkspaceCalibration(args: {
  workspaceId: string;
  plan: Plan;
  userId: string;
  companyDomain: string;
  pricingPageUrl: string | null;
  companyName: string | null;
}): Promise<StartCalibrationResult> {
  const { workspaceId, plan, userId, companyDomain, pricingPageUrl, companyName } = args;

  // Move the draft into RUNNING up-front so the wizard can poll immediately.
  await prisma.workspaceOnboardingDraft.upsert({
    where: { workspaceId },
    create: { workspaceId, status: "RUNNING", error: null },
    update: { status: "RUNNING", error: null },
  });

  try {
    await assertWorkerQuota({ workspaceId, plan, kind: "WORKSPACE_CONTEXT_EXTRACTOR" });
  } catch (err) {
    const reason =
      err instanceof PlanTooLowError
        ? "plan_too_low"
        : err instanceof QuotaExceededError
          ? "quota_exceeded"
          : "quota_error";
    await prisma.workspaceOnboardingDraft.update({
      where: { workspaceId },
      data: {
        status: "FAILED",
        error: "Automatic calibration is unavailable on this plan. You can fill in your ICP and packages manually.",
      },
    });
    logger.info("onboarding.calibration.quota_blocked", { workspaceId, reason });
    return { started: false, reason };
  }

  const run = await prisma.agentRun.create({
    data: {
      workspaceId,
      leadId: null,
      userId,
      workerKind: "WORKSPACE_CONTEXT_EXTRACTOR",
      status: "PENDING",
      inputsJson: { companyDomain, pricingPageUrl, companyName } as never,
    },
    select: { id: true },
  });

  await prisma.workspaceOnboardingDraft.update({
    where: { workspaceId },
    data: { lastRunId: run.id },
  });

  const enqueued = await tryEnqueue(run.id);
  if (!enqueued) {
    logger.warn("onboarding.calibration.queue_unavailable_inline_fallback", {
      runId: run.id,
      workspaceId,
    });
    void executeAgentRun(run.id).catch((err) => {
      logger.error("onboarding.calibration.inline_fallback_error", {
        runId: run.id,
        err: err instanceof Error ? err.message : String(err),
      });
    });
  } else {
    logger.info("onboarding.calibration.enqueued", { runId: run.id, workspaceId });
  }

  return { started: true, runId: run.id };
}
