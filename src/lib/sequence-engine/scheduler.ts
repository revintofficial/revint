/**
 * Install a 60s repeatable `sequence_tick` job onto the agent-runs
 * queue. Idempotent — BullMQ keys repeatable jobs by (name, opts) so
 * calling this on every worker restart just reuses the existing
 * schedule.
 */
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { logger } from "@/lib/logger";

const TICK_NAME = "sequence_tick";
const TICK_EVERY_MS = 60 * 1000;

export async function installSequenceTickCron(): Promise<void> {
  const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });
  const queue = new Queue("agent-runs", { connection });
  await queue.add(
    TICK_NAME,
    { type: "sequence_tick" },
    {
      // Repeatable jobs in BullMQ are deduped by (name, repeat key)
      // so re-installing on boot is safe.
      repeat: { every: TICK_EVERY_MS },
      removeOnComplete: 50,
      removeOnFail: 50,
      jobId: `cron:${TICK_NAME}`,
    },
  );
  logger.info("sequence_engine.cron.installed", { everyMs: TICK_EVERY_MS });
}
