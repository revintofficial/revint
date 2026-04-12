import { Queue } from "bullmq";
import { getRedis } from "./redis";

let discoveryQueue: Queue | null = null;
let crawlQueue: Queue | null = null;
let analyzeQueue: Queue | null = null;

export function getDiscoveryQueue(): Queue {
  if (!discoveryQueue) {
    discoveryQueue = new Queue("discovery", { connection: getRedis() });
  }
  return discoveryQueue;
}

export function getCrawlQueue(): Queue {
  if (!crawlQueue) {
    crawlQueue = new Queue("crawl", { connection: getRedis() });
  }
  return crawlQueue;
}

export function getAnalyzeQueue(): Queue {
  if (!analyzeQueue) {
    analyzeQueue = new Queue("analyze", { connection: getRedis() });
  }
  return analyzeQueue;
}
