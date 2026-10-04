// src/__tests__/workers/agent-run-defer.test.ts
/**
 * A run with no capacity is handed back to the queue without holding a
 * worker slot and without spending an attempt.
 */
import { DelayedError } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  executeAgentRun: vi.fn(),
  writebackAfterBriefRun: vi.fn(),
}));

vi.mock("../../lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("../../lib/agent-workers/execute", () => ({ executeAgentRun: mocks.executeAgentRun }));
vi.mock("../../lib/control/telemetry", () => ({ recordChainTelemetry: vi.fn() }));
vi.mock("../../lib/integrations/hubspot/brief-hook", () => ({ writebackAfterBriefRun: mocks.writebackAfterBriefRun }));
vi.mock("../../lib/prisma", () => ({ prisma: {} }));

import { DeferError } from "../../lib/agent-workers/errors";
import { processJob } from "../../workers/agent-run-worker";

function job(attemptsMade = 0) {
  return { id: "job_1", data: { type: "agent_run", runId: "run_1" }, attemptsMade, opts: {}, moveToDelayed: vi.fn() };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.executeAgentRun.mockResolvedValue(undefined);
});

describe("agent-run worker: deferral", () => {
  it("lets the run defer", async () => {
    await processJob(job() as never, "token_1");
    expect(mocks.executeAgentRun).toHaveBeenCalledWith("run_1", { isRetry: false, canDefer: true });
  });

  it("moves a deferred job to delayed with the worker's token and stops processing it", async () => {
    mocks.executeAgentRun.mockRejectedValue(new DeferError(20_000));
    const j = job();
    const before = Date.now();

    await expect(processJob(j as never, "token_1")).rejects.toBeInstanceOf(DelayedError);

    expect(j.moveToDelayed).toHaveBeenCalledTimes(1);
    const [timestamp, token] = j.moveToDelayed.mock.calls[0];
    expect(timestamp).toBeGreaterThanOrEqual(before + 20_000);
    expect(token).toBe("token_1");
    expect(mocks.writebackAfterBriefRun).not.toHaveBeenCalled();
  });
});
