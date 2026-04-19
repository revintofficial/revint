import { startDiscoveryWorker } from "./discovery-worker";
import { startCrawlWorker } from "./crawl-worker";
import { startAnalyzeWorker } from "./analyze-worker";
import { startReviewAnalysisWorker } from "./review-analysis-worker";
import { startEmailVerificationWorker } from "./email-verification-worker";

console.log("Starting all workers...");

const discoveryWorker = startDiscoveryWorker();
const crawlWorker = startCrawlWorker();
const analyzeWorker = startAnalyzeWorker();
const reviewAnalysisWorker = startReviewAnalysisWorker();
const emailVerificationWorker = startEmailVerificationWorker();

console.log("All workers started successfully");

async function shutdown() {
  console.log("Shutting down workers...");
  await Promise.all([
    discoveryWorker.close(),
    crawlWorker.close(),
    analyzeWorker.close(),
    reviewAnalysisWorker.close(),
    emailVerificationWorker.close(),
  ]);
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
