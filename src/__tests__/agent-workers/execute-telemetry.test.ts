import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findRun: vi.fn(),
  updateRun: vi.fn(),
  findWorkspace: vi.fn(),
  createTelemetry: vi.fn(),
  warn: vi.fn(),
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
  getWorker: () => ({ mode: "sync", memoryReads: [], estimatedDurationMs: 60_000 }),
  runWorker: () => Promise.resolve({ output: { ok: true }, costTokens: 42, costUsdCents: 3 }),
  resolveMemoryWrites: () => Promise.resolve(null),
  resolveWorkerStart: vi.fn(),
  resolveWorkerFinalize: vi.fn(),
}));
vi.mock("@/lib/agent-workers/quota", () => ({ assertWorkerQuota: vi.fn() }));
vi.mock("@/lib/email/from", () => ({ getAppBaseUrl: () => "http://localhost:3000" }));
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
});
