// Flag must be set BEFORE the workers import ../lib/prisma so the pool
// sizing helper in src/lib/prisma.ts sees it.
process.env.IS_WORKER = "1";

import { startDiscoveryWorker } from "./discovery-worker";
import { startCrawlWorker } from "./crawl-worker";
import { startAnalyzeWorker } from "./analyze-worker";
import { startReviewAnalysisWorker } from "./review-analysis-worker";
import { startEmailVerificationWorker } from "./email-verification-worker";
import { startAgentRunWorker } from "./agent-run-worker";
import { startSeoOpsWorker } from "./seo-ops-worker";
import { logger } from "../lib/logger";

function maskRedisUrl(raw: string | undefined): string {
  if (!raw) return "<UNSET>";
  try {
    const u = new URL(raw);
    const host = u.hostname || "<no-host>";
    const port = u.port || "<no-port>";
    const proto = u.protocol.replace(":", "");
    const hasPassword = u.password ? "yes" : "no";
    return `${proto}://***:${hasPassword}@${host}:${port}`;
  } catch {
    return "<UNPARSEABLE>";
  }
}

logger.info("worker.supervisor.starting", {
  redisUrlPresent: Boolean(process.env.REDIS_URL),
  redisUrlMasked: maskRedisUrl(process.env.REDIS_URL),
  databaseUrlPresent: Boolean(process.env.DATABASE_URL),
  nodeEnv: process.env.NODE_ENV ?? "<unset>",
});

const discoveryWorker = startDiscoveryWorker();
const crawlWorker = startCrawlWorker();
const analyzeWorker = startAnalyzeWorker();
const reviewAnalysisWorker = startReviewAnalysisWorker();
const emailVerificationWorker = startEmailVerificationWorker();
const agentRunWorker = startAgentRunWorker();
const seoOpsWorker = startSeoOpsWorker();

logger.info("worker.supervisor.started");

async function shutdown() {
  logger.info("worker.supervisor.shutdown");
  await Promise.all([
    discoveryWorker.close(),
    crawlWorker.close(),
    analyzeWorker.close(),
    reviewAnalysisWorker.close(),
    emailVerificationWorker.close(),
    agentRunWorker.close(),
    seoOpsWorker.close(),
  ]);
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
