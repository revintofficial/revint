// Flag must be set BEFORE the workers import ../lib/prisma so the pool
// sizing helper in src/lib/prisma.ts sees it.
process.env.IS_WORKER = "1";

import { startDiscoveryWorker } from "./discovery-worker";
import { startCrawlWorker } from "./crawl-worker";
import { startAnalyzeWorker } from "./analyze-worker";
import { startReviewAnalysisWorker } from "./review-analysis-worker";
import { startEmailVerificationWorker } from "./email-verification-worker";
import { startAgentRunWorker } from "./agent-run-worker";
import { logger } from "../lib/logger";

logger.info("worker.supervisor.starting");

const discoveryWorker = startDiscoveryWorker();
const crawlWorker = startCrawlWorker();
const analyzeWorker = startAnalyzeWorker();
const reviewAnalysisWorker = startReviewAnalysisWorker();
const emailVerificationWorker = startEmailVerificationWorker();
const agentRunWorker = startAgentRunWorker();

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
  ]);
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
