// src/__tests__/agent-workers/execute-defer.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findRun: vi.fn(),
  updateRun: vi.fn(),
  findWorkspace: vi.fn(),
  createTelemetry: vi.fn(),
  getWorker: vi.fn(),
  runWorker: vi.fn(),
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
  runWorker: (...args: unknown[]) => mocks.runWorker(...args),
  resolveMemoryWrites: () => Promise.resolve(null),
  resolveWorkerStart: vi.fn(),
  resolveWorkerFinalize: vi.fn(),
}));
vi.mock("@/lib/agent-workers/quota", () => ({ assertWorkerQuota: vi.fn() }));
vi.mock("@/lib/email/from", () => ({ getAppBaseUrl: () => "http://localhost:3000" }));
vi.mock("@/lib/ai-core/orchestrator", () => ({ enqueueAdvance: mocks.enqueueAdvance }));

import { workerDeadlineMsFor } from "@/lib/agent-workers/deadline";
import { DeferError, RetryableError } from "@/lib/agent-workers/errors";
import { executeAgentRun } from "@/lib/agent-workers/execute";
import type { AgentWorkerContext } from "@/lib/agent-workers/types";

const CREATED = new Date("2026-10-04T09:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findRun.mockResolvedValue({
    id: "run_1",
    workspaceId: "ws_1",
    plannerSessionId: "session_1",
    workerKind: "WEBSITE_AUDITOR",
    status: "PENDING",
    leadId: null,
    startedAt: null,
    createdAt: CREATED,
    inputsJson: { deferCount: 2, keep: "me" },
    costTokens: 0,
    costUsdCents: 0,
  });
  mocks.findWorkspace.mockResolvedValue({ id: "ws_1", plan: "PRO" });
  mocks.getWorker.mockReturnValue({ mode: "sync", memoryReads: [], estimatedDurationMs: 60_000 });
  mocks.updateRun.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    ...(await mocks.findRun()),
    ...data,
  }));
});

describe("workerDeadlineMsFor", () => {
  it("keeps today's rule unless the worker declares a deadline", () => {
    expect(workerDeadlineMsFor(undefined)).toBe(180_000);
    expect(workerDeadlineMsFor({ estimatedDurationMs: 30_000 })).toBe(90_000);
    expect(workerDeadlineMsFor({ estimatedDurationMs: 120_000 })).toBe(180_000);
    expect(workerDeadlineMsFor({ estimatedDurationMs: 60_000, deadlineMs: 300_000 })).toBe(300_000);
  });
});

describe("executeAgentRun: context for long-running workers", () => {
  it("hands the worker a signal, the defer permission, the defer count and the queue time", async () => {
    let seen: AgentWorkerContext | null = null;
    mocks.runWorker.mockImplementation(async (_kind: string, ctx: AgentWorkerContext) => {
      seen = ctx;
      return { output: { ok: true } };
    });
    await executeAgentRun("run_1", { canDefer: true });
    const ctx = seen as unknown as AgentWorkerContext;
    expect(ctx.signal).toBeInstanceOf(AbortSignal);
    expect(ctx.signal!.aborted).toBe(false);
    expect(ctx.canDefer).toBe(true);
    expect(ctx.deferCount).toBe(2);
    expect(ctx.queuedAt).toEqual(CREATED);
  });

  it("does not allow deferral on the inline path", async () => {
    let seen: AgentWorkerContext | null = null;
    mocks.runWorker.mockImplementation(async (_kind: string, ctx: AgentWorkerContext) => {
      seen = ctx;
      return { output: {} };
    });
    await executeAgentRun("run_1");
    expect((seen as unknown as AgentWorkerContext).canDefer).toBe(false);
  });
});

describe("executeAgentRun: deferral", () => {
  it("puts the run back to PENDING, records the deferral and rethrows", async () => {
    mocks.runWorker.mockRejectedValue(new DeferError(20_000));

    await expect(executeAgentRun("run_1", { canDefer: true })).rejects.toBeInstanceOf(DeferError);

    const last = mocks.updateRun.mock.calls.at(-1)![0];
    expect(last.where).toEqual({ id: "run_1", workspaceId: "ws_1" });
    expect(last.data).toMatchObject({ status: "PENDING", startedAt: null });
    expect(last.data.inputsJson).toMatchObject({ keep: "me", deferCount: 3 });
    expect(typeof last.data.inputsJson.deferredAt).toBe("string");
    expect(mocks.enqueueAdvance).not.toHaveBeenCalled();
    expect(mocks.createTelemetry).not.toHaveBeenCalled();
  });
});

describe("executeAgentRun: outer deadline", () => {
  // Review Focus 4: the deadline must stop the work, not just the wait.
  it("uses the worker's own deadline and aborts the signal when it fires", async () => {
    mocks.getWorker.mockReturnValue({ mode: "sync", memoryReads: [], estimatedDurationMs: 1, deadlineMs: 40 });
    let aborted = false;
    mocks.runWorker.mockImplementation(
      (_kind: string, ctx: AgentWorkerContext) =>
        new Promise(() => {
          ctx.signal!.addEventListener("abort", () => {
            aborted = true;
          });
        }),
    );

    await expect(executeAgentRun("run_1")).rejects.toBeInstanceOf(RetryableError);

    expect(aborted).toBe(true);
    const last = mocks.updateRun.mock.calls.at(-1)![0];
    expect(last.data.status).toBe("FAILED");
    expect(String(last.data.errorMsg)).toContain("worker_deadline_exceeded");
  });
});
