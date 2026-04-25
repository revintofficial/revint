/**
 * Apify mock builders used by every `apify-*.test.ts` worker test.
 *
 * The individual test is still responsible for calling
 *   vi.mock("@/lib/apify", () => require("../_helpers/mock-apify"))
 * (or the inline equivalent). This file only provides the factory
 * functions; it does NOT call vi.mock itself because the module
 * registration must happen at the TOP of each test file - a helper
 * imported lazily can't achieve that.
 *
 * Usage pattern inside a test:
 *
 *   import { vi } from "vitest";
 *   import * as ApifyMock from "../_helpers/mock-apify";
 *
 *   vi.mock("@/lib/apify", () => ApifyMock);
 *
 *   beforeEach(() => ApifyMock.resetApifyMock());
 *   it("happy path", async () => {
 *     ApifyMock.setRunSyncResponse([{ placeId: "p1", reviews: [...] }], 55);
 *     ...
 *   });
 */
import { vi } from "vitest";
import type { ApifyRunResult } from "@/lib/apify";

// ---------- module-level state (reset by resetApifyMock) ----------

let configured = true;
let nextItems: unknown[] = [];
let nextCost = 0;
let nextStatus: ApifyRunResult["status"] = "SUCCEEDED";
let nextDuration = 100;
let throwNext: Error | null = null;

export function resetApifyMock(): void {
  configured = true;
  nextItems = [];
  nextCost = 0;
  nextStatus = "SUCCEEDED";
  nextDuration = 100;
  throwNext = null;
  runSync.mockClear();
  runAsync.mockClear();
  fetchRun.mockClear();
}

export function setConfigured(value: boolean): void {
  configured = value;
}

export function setRunSyncResponse<T>(items: T[], costUsdCents = 0): void {
  nextItems = items as unknown[];
  nextCost = costUsdCents;
  nextStatus = "SUCCEEDED";
}

export function setRunSyncFailure(status: ApifyRunResult["status"] = "FAILED"): void {
  nextItems = [];
  nextCost = 0;
  nextStatus = status;
}

export function setRunSyncThrows(err: Error): void {
  throwNext = err;
}

// ---------- exports mirroring the real `@/lib/apify` module ----------

export function isConfigured(): boolean {
  return configured;
}

export const runSync = vi.fn(
  async <T = unknown>(): Promise<ApifyRunResult<T>> => {
    if (throwNext) {
      const err = throwNext;
      throwNext = null;
      throw err;
    }
    return {
      runId: "apify_run_mock",
      items: nextItems as T[],
      costUsdCents: nextCost,
      durationMs: nextDuration,
      status: nextStatus,
    };
  },
);

export const runAsync = vi.fn(
  async (
    _actorId: string,
    _input: unknown,
    _opts: {
      webhookUrl: string;
      webhookSecret?: string;
      agentRunId: string;
      timeoutSec?: number;
      memoryMbytes?: number;
    },
  ): Promise<{ runId: string; statusUrl: string }> => {
    return {
      runId: "apify_run_mock",
      statusUrl: "https://api.apify.com/v2/actor-runs/apify_run_mock",
    };
  },
);

export const fetchRun = vi.fn(
  async (_runId: string): Promise<ApifyRunResult<unknown>> => {
    return {
      runId: "apify_run_mock",
      items: nextItems,
      costUsdCents: nextCost,
      durationMs: nextDuration,
      status: nextStatus,
    };
  },
);

export function verifyWebhookSecret(headers: Headers): boolean {
  const expected = process.env.APIFY_WEBHOOK_SECRET;
  if (!expected) return true;
  return headers.get("x-apify-webhook-secret") === expected;
}

// Re-export the error classes the real module exports so tests can
// `instanceof`-check failures.
export class ApifyNotConfiguredError extends Error {
  constructor() {
    super("APIFY_TOKEN not set - Apify workers unavailable");
    this.name = "ApifyNotConfiguredError";
  }
}

export class ApifyRunError extends Error {
  runId?: string;
  status: string;
  constructor(message: string, status: string, runId?: string) {
    super(message);
    this.status = status;
    this.runId = runId;
  }
}
