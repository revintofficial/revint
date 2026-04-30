/**
 * Install a 60s repeatable `sequence_tick` job onto the agent-runs
 * queue. Idempotent — BullMQ keys job schedulers by id so calling
 * this on every worker restart just reuses the existing schedule.
 *
 * BullMQ 5.x deprecated the `repeat` option on `queue.add(...)` in
 * favour of `queue.upsertJobScheduler(id, repeatOpts, jobTemplate)`.
 * The new API is also strictly idempotent (the scheduler id is the
 * dedup key) which removes the need for the legacy `cron:<name>`
 * jobId trick.
 */
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { logger } from "@/lib/logger";

const TICK_NAME = "sequence_tick";
const TICK_SCHEDULER_ID = "cron:sequence_tick";
const TICK_EVERY_MS = 60 * 1000;

export async function installSequenceTickCron(): Promise<void> {
  const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });
  const queue = new Queue("agent-runs", { connection });
  // BullMQ 5.x exposes `upsertJobScheduler` at runtime, but the TS
  // type for `Queue<unknown>` in this checkout doesn't surface it
  // (the d.ts files declare it on the parameterised `Queue<DataType,
  // ...>` overload, and bundler-mode resolution is widening the
  // generic to `unknown`). Cast through a narrow helper interface so
  // the call site stays type-safe at the argument level. TODO:
  // upgrade to bullmq's official TS types once @types alignment lands.
  const q = queue as unknown as {
    upsertJobScheduler: (
      id: string,
      repeat: { every: number },
      template: {
        name: string;
        data: Record<string, unknown>;
        opts?: { removeOnComplete?: number; removeOnFail?: number };
      },
    ) => Promise<unknown>;
  };
  await q.upsertJobScheduler(
    TICK_SCHEDULER_ID,
    { every: TICK_EVERY_MS },
    {
      name: TICK_NAME,
      data: { type: "sequence_tick" },
      opts: {
        removeOnComplete: 50,
        removeOnFail: 50,
      },
    },
  );
  logger.info("sequence_engine.cron.installed", { everyMs: TICK_EVERY_MS });
}
