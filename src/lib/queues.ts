import { Queue } from "bullmq";
import { getRedis } from "./redis";

let discoveryQueue: Queue | null = null;
let crawlQueue: Queue | null = null;
let analyzeQueue: Queue | null = null;
let reviewAnalysisQueue: Queue | null = null;
let emailVerificationQueue: Queue | null = null;
let inboxSyncQueue: Queue | null = null;

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

// P0.1 - Review Intelligence v1
export function getReviewAnalysisQueue(): Queue {
  if (!reviewAnalysisQueue) {
    reviewAnalysisQueue = new Queue("review-analysis", { connection: getRedis() });
  }
  return reviewAnalysisQueue;
}

// P0.4 - Email verification
export function getEmailVerificationQueue(): Queue {
  if (!emailVerificationQueue) {
    emailVerificationQueue = new Queue("email-verification", { connection: getRedis() });
  }
  return emailVerificationQueue;
}

// P1.4 - Reply attribution v1 (inbox sync)
export function getInboxSyncQueue(): Queue {
  if (!inboxSyncQueue) {
    inboxSyncQueue = new Queue("inbox-sync", { connection: getRedis() });
  }
  return inboxSyncQueue;
}
