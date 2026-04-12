import { startDiscoveryWorker } from "./discovery-worker";
import { startCrawlWorker } from "./crawl-worker";
import { startAnalyzeWorker } from "./analyze-worker";

console.log("Starting all workers...");

const discoveryWorker = startDiscoveryWorker();
const crawlWorker = startCrawlWorker();
const analyzeWorker = startAnalyzeWorker();

console.log("All workers started successfully");

async function shutdown() {
  console.log("Shutting down workers...");
  await Promise.all([
    discoveryWorker.close(),
    crawlWorker.close(),
    analyzeWorker.close(),
  ]);
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
