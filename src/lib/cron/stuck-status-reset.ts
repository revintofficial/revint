/**
 * Pipeline stuck-status reset cron.
 *
 * Symptom this prevents: `Banana Tree Greenwich` (FineDine Beta) sat
 * at `crawl_status = CRAWLING` for ~12 hours after a BullMQ stalled
 * job dropped its lock. The legacy worker write path is the only
 * place `crawl_status` flips back to PENDING/CRAWLED — when the job
 * dies before that write, the lead is orphaned. PLAN §Phase 7 covers
 * this as the database-side complement to BullMQ's
 * `stalledInterval` / `maxStalledCount` reclamation: BullMQ moves
 * the job, but nothing moves the Lead row.
 *
 * Strategy: every 5 minutes, scan for Lead rows whose pipeline
 * `*_STATUS` column has been in an in-progress state for longer than
 * the worker's worst-case duration. Apify deep crawl normally
 * finishes in ≤ 5 minutes; the 30-minute threshold is conservative
 * enough to never trip a live job.
 *
 * Operates workspace-agnostically by design — a stalled job is a
 * platform-wide infrastructure problem and the reset is benign
 * (PENDING just re-queues the next time a worker scans). Multi-tenant
 * scope is preserved because every Lead row already carries its own
 * `workspace_id` and we never read/write across rows.
 */
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const TICK_NAME = "stuck_status_reset";
const TICK_SCHEDULER_ID = "cron:stuck_status_reset";
/**
 * Every 5 minutes. Combined with the 30-minute SQL threshold, a
 * truly-stuck lead is unsticking itself within at most ~35 minutes
 * of the worker process being healthy again.
 */
const TICK_EVERY_MS = 5 * 60 * 1000;
/**
 * 30 minutes. Apify deep crawl P95 is ~5 minutes; even the slowest
 * KB-builder worker finishes under 15 minutes. Setting the threshold
 * here below would risk yanking real, live work. Setting it higher
 * leaves users staring at a stuck status badge while the operator
 * has no recovery hook other than restart-the-world.
 */
const STUCK_THRESHOLD_MINUTES = 30;

export interface StuckStatusResetResult {
  crawlReset: number;
  analyzeReset: number;
  reviewAnalysisReset: number;
}

/**
 * Resets the three pipeline status columns on `leads` whose
 * `updated_at` predates the stuck threshold. Raw SQL is used over
 * Prisma `updateMany` so we can express the "older than N minutes"
 * clause in a single round-trip per column rather than a count + map.
 *
 * Idempotent: rows that have since been touched by a worker no
 * longer match the predicate, so re-running is a clean no-op.
 *
 * Returns per-column row counts for observability — every count
 * other than zero is worth a warning log because a healthy pipeline
 * should never need this reset.
 */
export async function resetStuckStatuses(): Promise<StuckStatusResetResult> {
  // We use `$executeRaw` with an interpolated interval because
  // Postgres's INTERVAL literal does not parameterise cleanly; the
  // numeric is a compile-time constant so there is no injection risk.
  const interval = `${STUCK_THRESHOLD_MINUTES} minutes`;

  const crawlReset = await prisma.$executeRawUnsafe(
    `UPDATE leads
        SET crawl_status = 'PENDING', updated_at = NOW()
      WHERE crawl_status = 'CRAWLING'
        AND updated_at < NOW() - INTERVAL '${interval}'`,
  );
  const analyzeReset = await prisma.$executeRawUnsafe(
    `UPDATE leads
        SET analyze_status = 'PENDING', updated_at = NOW()
      WHERE analyze_status = 'ANALYZING'
        AND updated_at < NOW() - INTERVAL '${interval}'`,
  );
  const reviewAnalysisReset = await prisma.$executeRawUnsafe(
    `UPDATE leads
        SET review_analysis_status = 'PENDING', updated_at = NOW()
      WHERE review_analysis_status = 'ANALYZING'
        AND updated_at < NOW() - INTERVAL '${interval}'`,
  );

  const result: StuckStatusResetResult = {
    crawlReset: Number(crawlReset),
    analyzeReset: Number(analyzeReset),
    reviewAnalysisReset: Number(reviewAnalysisReset),
  };

  if (
    result.crawlReset > 0 ||
    result.analyzeReset > 0 ||
    result.reviewAnalysisReset > 0
  ) {
    logger.warn("cron.stuck_status_reset.reset_rows", {
      ...result,
      thresholdMinutes: STUCK_THRESHOLD_MINUTES,
    });
  } else {
    logger.info("cron.stuck_status_reset.clean", {
      thresholdMinutes: STUCK_THRESHOLD_MINUTES,
    });
  }

  return result;
}

/**
 * Installs the repeatable BullMQ scheduler. Uses the SAME pattern as
 * `installSequenceTickCron` — single `agent-runs` queue, scheduler id
 * as the idempotency key, so this is safe to call on every worker
 * boot.
 */
export async function installStuckStatusResetCron(): Promise<void> {
  const connection = new IORedis(
    process.env.REDIS_URL || "redis://localhost:6379",
    { maxRetriesPerRequest: null },
  );
  const queue = new Queue("agent-runs", { connection });
  // Same `upsertJobScheduler` cast as in
  // `src/lib/sequence-engine/scheduler.ts` — bundler-mode resolution
  // widens `Queue<unknown>` so the typed method doesn't surface. See
  // that file for the rationale; keep the two casts in lockstep.
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
      data: { type: "stuck_status_reset" },
      opts: {
        removeOnComplete: 50,
        removeOnFail: 50,
      },
    },
  );
  logger.info("cron.stuck_status_reset.installed", { everyMs: TICK_EVERY_MS });
}
