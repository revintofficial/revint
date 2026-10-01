/**
 * Task 2 — the worker supervisor boots only the queues something still
 * enqueues into. `review-analysis` and `email-verification` were
 * duplicates of AI Core workers (REVIEW_ANALYST / EMAIL_VERIFIER on
 * `agent-runs`) and raced them on the same rows.
 *
 * Source-level assertion on purpose: importing `src/workers/index.ts`
 * would open Redis connections and install process handlers.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync("src/workers/index.ts", "utf8");
// Ignore commented-out rollback hints.
const code = src
  .split("\n")
  .filter((line) => !line.trim().startsWith("//"))
  .join("\n");

describe("worker supervisor boot", () => {
  it("does not boot the legacy review and email queues", () => {
    expect(src).not.toMatch(/startReviewAnalysisWorker\(/);
    expect(src).not.toMatch(/startEmailVerificationWorker\(/);
    expect(src).toMatch(/startAgentRunWorker\(/);
  });

  it("does not import the legacy review and email workers", () => {
    expect(code).not.toMatch(/review-analysis-worker/);
    expect(code).not.toMatch(/email-verification-worker/);
    expect(code).not.toMatch(/reviewAnalysisWorker\.close\(/);
    expect(code).not.toMatch(/emailVerificationWorker\.close\(/);
  });

  it("keeps the queues that are still fed: discovery, agent-runs, seo-ops", () => {
    expect(code).toMatch(/startDiscoveryWorker\(/);
    expect(code).toMatch(/startAgentRunWorker\(/);
    expect(code).toMatch(/startSeoOpsWorker\(/);
    expect(code).toMatch(/agentRunWorker\.close\(/);
  });

  it("still does not boot the crawl and analyze workers", () => {
    expect(code).not.toMatch(/startCrawlWorker\(/);
    expect(code).not.toMatch(/startAnalyzeWorker\(/);
  });
});
