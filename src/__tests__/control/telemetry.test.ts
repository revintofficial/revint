import { beforeEach, describe, expect, it, vi } from "vitest";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { chainTelemetry: { create } } }));

import { recordChainTelemetry } from "@/lib/control/telemetry";

const run: Parameters<typeof recordChainTelemetry>[0] = {
  id: "run_1",
  workspaceId: "ws_1",
  plannerSessionId: "ps_1",
  workerKind: "ICP_SCORER",
  costTokens: 10,
  costUsdCents: 2,
  startedAt: new Date("2026-09-26T12:00:00Z"),
  finishedAt: new Date("2026-09-26T12:03:00Z"),
  errorMsg: "boom",
  status: "FAILED",
};

describe("recordChainTelemetry", () => {
  beforeEach(() => create.mockReset());

  it("writes duration, costs and SLA breach for a slow failed run", async () => {
    create.mockResolvedValue({ id: "tel_1" });
    await recordChainTelemetry(run);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "ws_1",
        plannerSessionId: "ps_1",
        agentRunId: "run_1",
        workerKind: "ICP_SCORER",
        costTokens: 10,
        costUsdCents: 2,
        durationMs: 180000,
        slaBreach: true,
        errorClass: "FAILED",
      }),
    });
  });

  it("keeps duration null without both timestamps and clears error class on success", async () => {
    create.mockResolvedValue({ id: "tel_2" });
    await recordChainTelemetry({ ...run, startedAt: null, status: "SUCCEEDED" });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ durationMs: null, slaBreach: false, errorClass: null }),
    });
  });

  it("does not write when the run has no planner session", async () => {
    await recordChainTelemetry({ ...run, plannerSessionId: null });
    expect(create).not.toHaveBeenCalled();
  });
});
