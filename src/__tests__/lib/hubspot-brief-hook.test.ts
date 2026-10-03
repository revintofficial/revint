/**
 * Post-analysis writeback hook: fires once after a successful
 * LEAD_INTELLIGENCE_BRIEF run for a HubSpot-connected workspace, is
 * workspace-scoped from the run row, and never throws.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ enqueue: vi.fn() }));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/integrations/hubspot/writeback", () => ({
  enqueueCrmWriteback: mocks.enqueue,
}));

import { writebackAfterBriefRun } from "@/lib/integrations/hubspot/brief-hook";

function prismaWith(run: Record<string, unknown> | null, conn: { status: string } | null = { status: "ACTIVE" }) {
  return {
    agentRun: { findUnique: vi.fn(async () => run) },
    crmConnection: { findUnique: vi.fn(async () => conn) },
  };
}

const BRIEF = {
  id: "run_1",
  workspaceId: "ws_1",
  leadId: "lead_1",
  workerKind: "LEAD_INTELLIGENCE_BRIEF",
  status: "SUCCEEDED",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.enqueue.mockResolvedValue({ status: "SUCCESS", targets: ["company:1"] });
});

describe("writebackAfterBriefRun", () => {
  it("does not write back a brief that skipped itself", async () => {
    const prisma = prismaWith({ ...BRIEF, outputJson: { skipped: "head_agent_off" } });
    const res = await writebackAfterBriefRun(prisma as never, "run_1");
    expect(res).toEqual({ status: "NOT_APPLICABLE", reason: "brief_skipped" });
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it("writes back a succeeded brief with the run id + workspace from the row", async () => {
    const prisma = prismaWith(BRIEF);
    const res = await writebackAfterBriefRun(prisma as never, "run_1");
    expect(res.status).toBe("SUCCESS");
    expect(mocks.enqueue).toHaveBeenCalledWith(prisma, {
      workspaceId: "ws_1",
      leadId: "lead_1",
      reason: "analysis",
      briefRunId: "run_1",
    });
    expect(prisma.crmConnection.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId_provider: { workspaceId: "ws_1", provider: "HUBSPOT" } },
      }),
    );
  });

  it("also fires for SUCCEEDED_NO_MEMORY", async () => {
    await writebackAfterBriefRun(prismaWith({ ...BRIEF, status: "SUCCEEDED_NO_MEMORY" }) as never, "run_1");
    expect(mocks.enqueue).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ ...BRIEF, workerKind: "REVIEW_ANALYST" }, "not_a_brief"],
    [{ ...BRIEF, status: "FAILED" }, "run_failed"],
    [{ ...BRIEF, leadId: null }, "no_lead"],
    [null, "run_not_found"],
  ])("is a no-op for %o", async (run, reason) => {
    const res = await writebackAfterBriefRun(prismaWith(run) as never, "run_1");
    expect(res).toEqual({ status: "NOT_APPLICABLE", reason });
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it("is a no-op when the workspace has no (or a revoked) HubSpot connection", async () => {
    expect((await writebackAfterBriefRun(prismaWith(BRIEF, null) as never, "run_1")).status).toBe("NOT_APPLICABLE");
    expect((await writebackAfterBriefRun(prismaWith(BRIEF, { status: "REVOKED" }) as never, "run_1")).status).toBe(
      "NOT_APPLICABLE",
    );
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it("never throws, even when the writeback blows up", async () => {
    mocks.enqueue.mockRejectedValue(new Error("db down"));
    const res = await writebackAfterBriefRun(prismaWith(BRIEF) as never, "run_1");
    expect(res).toEqual({ status: "FAILED", reason: "db down" });
  });
});
