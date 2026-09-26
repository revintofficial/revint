import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findRun: vi.fn(),
  updateRun: vi.fn(),
  findWorkspace: vi.fn(),
  createTelemetry: vi.fn(),
  warn: vi.fn(),
  getWorker: vi.fn(),
  resolveWorkerStart: vi.fn(),
  getAppBaseUrl: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentRun: { findUnique: mocks.findRun, update: mocks.updateRun },
    workspace: { findUniqueOrThrow: mocks.findWorkspace },
    chainTelemetry: { create: mocks.createTelemetry },
  },
}));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: mocks.warn, error: vi.fn() } }));
vi.mock("@/lib/agent-workers/registry", () => ({
  getWorker: mocks.getWorker,
  runWorker: () => Promise.resolve({ output: { ok: true }, costTokens: 42, costUsdCents: 3 }),
  resolveMemoryWrites: () => Promise.resolve(null),
  resolveWorkerStart: mocks.resolveWorkerStart,
  resolveWorkerFinalize: vi.fn(),
}));
vi.mock("@/lib/agent-workers/quota", () => ({ assertWorkerQuota: vi.fn() }));
vi.mock("@/lib/email/from", () => ({ getAppBaseUrl: mocks.getAppBaseUrl }));
vi.mock("@/lib/ai-core/orchestrator", () => ({ enqueueAdvance: vi.fn() }));

import { executeAgentRun } from "@/lib/agent-workers/execute";

describe("executeAgentRun telemetry isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findRun.mockResolvedValue({
      id: "run_1",
      workspaceId: "ws_1",
      plannerSessionId: "session_1",
      workerKind: "ICP_SCORER",
      status: "RUNNING",
      leadId: null,
      startedAt: new Date("2026-09-26T12:00:00Z"),
      costTokens: 0,
      costUsdCents: 0,
    });
    mocks.findWorkspace.mockResolvedValue({ id: "ws_1", plan: "PRO" });
    mocks.getWorker.mockReturnValue({ mode: "sync", memoryReads: [], estimatedDurationMs: 60_000 });
    mocks.getAppBaseUrl.mockReturnValue("http://localhost:3000");
    mocks.updateRun.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...(await mocks.findRun()),
      ...data,
    }));
  });

  it("does not turn a successful run into FAILED when telemetry insert fails", async () => {
    mocks.createTelemetry.mockRejectedValue(new Error("telemetry unavailable"));
    await executeAgentRun("run_1");

    expect(mocks.updateRun).toHaveBeenCalledTimes(1);
    expect(mocks.updateRun).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "run_1", workspaceId: "ws_1" },
      data: expect.objectContaining({ status: "SUCCEEDED", costTokens: 42, costUsdCents: 3 }),
    }));
    expect(mocks.createTelemetry).toHaveBeenCalledWith({
      data: expect.objectContaining({ agentRunId: "run_1", workspaceId: "ws_1", costTokens: 42, costUsdCents: 3 }),
    });
    expect(mocks.warn).toHaveBeenCalledWith("agent_run.telemetry.failed", expect.objectContaining({ runId: "run_1" }));
  });

  it.each([
    { priorStatus: "PENDING", priorStartedAt: null, isRetry: false },
    { priorStatus: "FAILED", priorStartedAt: new Date("2026-09-25T12:00:00Z"), isRetry: true },
  ])("keeps the current attempt start through async kickoff from $priorStatus", async ({ priorStatus, priorStartedAt, isRetry }) => {
    mocks.findRun.mockResolvedValue({
      ...(await mocks.findRun()),
      status: priorStatus,
      startedAt: priorStartedAt,
    });
    mocks.getWorker.mockReturnValue({ mode: "async-apify", memoryReads: [] });
    mocks.getAppBaseUrl.mockReturnValue("https://revint.example");
    mocks.resolveWorkerStart.mockResolvedValue(async () => ({ apifyRunId: "actor_1", costEstimateUsdCents: 7 }));

    await executeAgentRun("run_1", { isRetry });

    expect(mocks.updateRun).toHaveBeenCalledTimes(2);
    const first = mocks.updateRun.mock.calls[0][0];
    const kickoff = mocks.updateRun.mock.calls[1][0];
    expect(first.data.status).toBe("RUNNING");
    expect(first.data.startedAt).toBeInstanceOf(Date);
    expect(kickoff.where).toEqual({ id: "run_1", workspaceId: "ws_1" });
    expect(kickoff.data.startedAt).toBe(first.data.startedAt);
    expect(kickoff.data.costUsdCents).toBe(7);
    expect(mocks.createTelemetry).not.toHaveBeenCalled();
  });
});
