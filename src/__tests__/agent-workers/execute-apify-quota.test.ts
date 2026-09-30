/**
 * Task 2 — an Apify quota response (402, or 403 with a quota type)
 * ends the AgentRun SUCCEEDED with `{ skipped: "apify_quota", statusCode }`
 * instead of FAILED. Fifteen runs were marked FAILED this way while the
 * lead itself was fine.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findRun: vi.fn(),
  updateRun: vi.fn(),
  findWorkspace: vi.fn(),
  createTelemetry: vi.fn(),
  runWorker: vi.fn(),
  getWorker: vi.fn(),
  resolveWorkerStart: vi.fn(),
  enqueueAdvance: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentRun: { findUnique: mocks.findRun, update: mocks.updateRun },
    workspace: { findUniqueOrThrow: mocks.findWorkspace },
    chainTelemetry: { create: mocks.createTelemetry },
  },
}));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/agent-workers/registry", () => ({
  getWorker: mocks.getWorker,
  runWorker: mocks.runWorker,
  resolveMemoryWrites: () => Promise.resolve(null),
  resolveWorkerStart: mocks.resolveWorkerStart,
  resolveWorkerFinalize: vi.fn(),
}));
vi.mock("@/lib/agent-workers/quota", () => ({ assertWorkerQuota: vi.fn() }));
vi.mock("@/lib/email/from", () => ({ getAppBaseUrl: () => "http://localhost:3000" }));
vi.mock("@/lib/ai-core/orchestrator", () => ({ enqueueAdvance: mocks.enqueueAdvance }));

import { executeAgentRun } from "@/lib/agent-workers/execute";
import { ApifyQuotaError, ApifyRunError } from "@/lib/apify";

const baseRun = {
  id: "run_1",
  workspaceId: "ws_1",
  plannerSessionId: "session_1",
  workerKind: "APIFY_SERP_RANK",
  status: "RUNNING",
  leadId: null,
  startedAt: new Date("2026-09-30T12:00:00Z"),
  costTokens: 0,
  costUsdCents: 0,
};

describe("executeAgentRun Apify quota", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findRun.mockResolvedValue(baseRun);
    mocks.findWorkspace.mockResolvedValue({ id: "ws_1", plan: "PRO" });
    mocks.getWorker.mockReturnValue({ mode: "sync", memoryReads: [], estimatedDurationMs: 60_000 });
    mocks.createTelemetry.mockResolvedValue({});
    mocks.updateRun.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...baseRun, ...data }));
  });

  it("ends the run SUCCEEDED with an apify_quota skip on a 402", async () => {
    mocks.runWorker.mockRejectedValue(new ApifyQuotaError("Apify a/b returned 402", 402));
    await executeAgentRun("run_1");

    expect(mocks.updateRun).toHaveBeenCalledTimes(1);
    const call = mocks.updateRun.mock.calls[0][0];
    expect(call.where).toEqual({ id: "run_1", workspaceId: "ws_1" });
    expect(call.data.status).toBe("SUCCEEDED");
    expect(call.data.outputJson).toEqual({ skipped: "apify_quota", reason: "apify_quota", statusCode: 402 });
    expect(mocks.enqueueAdvance).toHaveBeenCalledWith("session_1");
  });

  it("still fails on a non-quota Apify error", async () => {
    mocks.runWorker.mockRejectedValue(new ApifyRunError("Apify a/b returned 500", "HTTP_500"));
    await executeAgentRun("run_1");
    const call = mocks.updateRun.mock.calls[0][0];
    expect(call.data.status).toBe("FAILED");
  });
});
