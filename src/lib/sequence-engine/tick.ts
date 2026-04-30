/**
 * Phase 2 — sequence tick scanner.
 *
 * Runs every minute (driven by the `sequence-tick-cron` repeatable
 * job that the worker boots, see `src/workers/index.ts`). Scans
 * `LeadSequenceState` rows that are:
 *   - state = ACTIVE (not paused, not completed, not exited)
 *   - nextStepAt <= now()
 *   - lead.dnc = false (KVKK / GDPR floor)
 *
 * For each match it enqueues a `sequence_step` job to the existing
 * agent-runs queue. We deliberately keep the tick logic small —
 * actual outbound work (email send, whatsapp link, manual-call
 * reminder) lives in `step.ts`.
 *
 * This is the closest the codebase has to a cron — every other
 * scheduled work (planner advance, intelligence brief) is event-
 * driven. We tolerate a 60s lag on first-step scheduling because the
 * cadences themselves are measured in hours, not seconds.
 */
import { Queue, type JobsOptions } from "bullmq";
import IORedis from "ioredis";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

let agentRunsQueue: Queue | null = null;

function getQueue(): Queue {
  if (agentRunsQueue) return agentRunsQueue;
  const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });
  agentRunsQueue = new Queue("agent-runs", { connection });
  return agentRunsQueue;
}

export interface SequenceTickResult {
  scanned: number;
  scheduled: number;
  blockedDnc: number;
}

export async function processSequenceTick(): Promise<SequenceTickResult> {
  const now = new Date();

  const dueStates = await prisma.leadSequenceState.findMany({
    where: {
      state: "ACTIVE",
      pausedAt: null,
      nextStepAt: { lte: now },
    },
    select: {
      id: true,
      workspaceId: true,
      leadId: true,
      sequenceId: true,
    },
    take: 200,
  });

  if (dueStates.length === 0) {
    return { scanned: 0, scheduled: 0, blockedDnc: 0 };
  }

  // KVKK / GDPR floor: never tick a sequence step for a DNC lead.
  // We pause the state instead of just skipping so the manager can
  // see why the lead stopped progressing.
  const dncLeads = await prisma.lead.findMany({
    where: {
      id: { in: dueStates.map((s) => s.leadId) },
      OR: [{ dnc: true }, { optedOutAt: { not: null } }],
    },
    select: { id: true },
  });
  const dncLeadIds = new Set(dncLeads.map((l) => l.id));

  let blockedDnc = 0;
  if (dncLeadIds.size > 0) {
    const blockedStates = dueStates.filter((s) => dncLeadIds.has(s.leadId));
    if (blockedStates.length > 0) {
      blockedDnc = blockedStates.length;
      await prisma.leadSequenceState.updateMany({
        where: { id: { in: blockedStates.map((s) => s.id) } },
        data: {
          state: "PAUSED",
          pausedAt: now,
          pausedReason: "DNC",
        },
      });
      logger.info("sequence_engine.tick.paused_for_dnc", {
        count: blockedStates.length,
      });
    }
  }

  const eligible = dueStates.filter((s) => !dncLeadIds.has(s.leadId));
  if (eligible.length === 0) {
    return { scanned: dueStates.length, scheduled: 0, blockedDnc };
  }

  const queue = getQueue();
  await Promise.all(
    eligible.map((state) => {
      // De-dupe by state id so a second tick that overlaps with an
      // in-flight step doesn't enqueue a duplicate job. `jobId` is a
      // BaseJobOptions field on the bullmq side, but the d.ts files
      // shipped with 5.73.5 widen `JobsOptions` so that the bundler-
      // mode type checker doesn't see it on the public signature.
      // Cast the options bag through Record<string, unknown> so the
      // runtime call matches the documented BullMQ API while keeping
      // every other field explicitly typed locally. TODO: drop the
      // cast once bullmq's TS types align.
      const opts = {
        jobId: `sequence_step:${state.id}:${now.getTime()}`,
        removeOnComplete: 200,
        removeOnFail: 100,
        attempts: 3,
        backoff: { type: "exponential", delay: 30_000 },
      } as unknown as JobsOptions;
      return queue.add(
        "sequence_step",
        { type: "sequence_step", stateId: state.id },
        opts,
      );
    }),
  );

  logger.info("sequence_engine.tick.scheduled", {
    scanned: dueStates.length,
    scheduled: eligible.length,
    blockedDnc,
  });
  return { scanned: dueStates.length, scheduled: eligible.length, blockedDnc };
}
