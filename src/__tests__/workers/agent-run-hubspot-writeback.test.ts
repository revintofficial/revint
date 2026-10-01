/**
 * The agent-runs worker hands every finished agent_run to the HubSpot
 * post-analysis hook — and only after executeAgentRun returned normally.
 * A thrown run (retryable or permanent) must not trigger writeback.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  executeAgentRun: vi.fn(),
  writebackAfterBriefRun: vi.fn(),
  prisma: { marker: "prisma" },
}));

vi.mock("../../lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("../../lib/agent-workers/execute", () => ({ executeAgentRun: mocks.executeAgentRun }));
vi.mock("../../lib/agent-workers/errors", () => ({ isRetryable: () => false }));
vi.mock("../../lib/control/telemetry", () => ({ recordChainTelemetry: vi.fn() }));
vi.mock("../../lib/integrations/hubspot/brief-hook", () => ({
  writebackAfterBriefRun: mocks.writebackAfterBriefRun,
}));
vi.mock("../../lib/prisma", () => ({ prisma: mocks.prisma }));

import { processJob } from "../../workers/agent-run-worker";

function job(data: Record<string, unknown>, attemptsMade = 0) {
  return { id: "job_1", data, attemptsMade, opts: {} } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.executeAgentRun.mockResolvedValue(undefined);
  mocks.writebackAfterBriefRun.mockResolvedValue({ status: "SUCCESS" });
});

describe("agent-run worker → HubSpot writeback hook", () => {
  it("calls the hook with the run id after a successful execution", async () => {
    await expect(processJob(job({ type: "agent_run", runId: "run_1" }))).resolves.toEqual({ runId: "run_1" });
    expect(mocks.writebackAfterBriefRun).toHaveBeenCalledWith(mocks.prisma, "run_1");
  });

  it("also runs for legacy payloads without a type", async () => {
    await processJob(job({ runId: "run_2" }));
    expect(mocks.writebackAfterBriefRun).toHaveBeenCalledWith(mocks.prisma, "run_2");
  });

  it("does not write back when the run threw", async () => {
    mocks.executeAgentRun.mockRejectedValue(new Error("boom"));
    await expect(processJob(job({ type: "agent_run", runId: "run_3" }))).rejects.toThrow(/permanent: boom/);
    expect(mocks.writebackAfterBriefRun).not.toHaveBeenCalled();
  });

  it("does not touch HubSpot for other job types", async () => {
    await processJob(job({ type: "stuck_status_reset" })).catch(() => undefined);
    expect(mocks.writebackAfterBriefRun).not.toHaveBeenCalled();
  });
});
