import { beforeEach, describe, expect, it, vi } from "vitest";

const { leadFind, sessionsFind, runsFind, crmFind } = vi.hoisted(() => ({
  leadFind: vi.fn(),
  sessionsFind: vi.fn(),
  runsFind: vi.fn(),
  crmFind: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: { findFirst: leadFind },
    plannerSession: { findMany: sessionsFind },
    agentRun: { findMany: runsFind },
    crmSyncLog: { findMany: crmFind },
  },
}));

import { getLeadTrace } from "@/lib/control/trace";

describe("getLeadTrace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionsFind.mockResolvedValue([]);
    runsFind.mockResolvedValue([]);
    crmFind.mockResolvedValue([]);
  });

  it("returns null when the lead is outside the workspace", async () => {
    leadFind.mockResolvedValue(null);
    await expect(getLeadTrace("ws_a", "lead_b")).resolves.toBeNull();
    expect(leadFind).toHaveBeenCalledWith({
      where: { id: "lead_b", workspaceId: "ws_a" },
      select: { id: true, businessName: true },
    });
    expect(sessionsFind).not.toHaveBeenCalled();
    expect(runsFind).not.toHaveBeenCalled();
    expect(crmFind).not.toHaveBeenCalled();
  });

  it("scopes each child query and maps selected fields to ISO dates and nulls", async () => {
    leadFind.mockResolvedValue({ id: "lead_1", businessName: "Cafe" });
    sessionsFind.mockResolvedValue([{
      id: "session_1", status: "PLANNING", goal: "Find leads", createdAt: new Date("2026-09-25T12:00:00Z"),
    }]);
    runsFind.mockResolvedValue([{
      id: "run_1", workerKind: "ICP_SCORER", status: "FAILED", plannerSessionId: null,
      costTokens: 12, costUsdCents: 3, errorMsg: "failed", startedAt: null, finishedAt: new Date("2026-09-26T12:00:00Z"),
      inputsJson: { secret: true }, outputJson: { secret: true },
    }]);
    crmFind.mockResolvedValue([{
      id: "crm_1", status: "FAILED", objectType: "contact", lastError: null,
    }]);

    await expect(getLeadTrace("ws_1", "lead_1")).resolves.toEqual({
      lead: { id: "lead_1", businessName: "Cafe" },
      sessions: [{ id: "session_1", status: "PLANNING", goal: "Find leads", createdAt: "2026-09-25T12:00:00.000Z" }],
      runs: [{
        id: "run_1", workerKind: "ICP_SCORER", status: "FAILED", plannerSessionId: null,
        costTokens: 12, costUsdCents: 3, errorMsg: "failed", startedAt: null, finishedAt: "2026-09-26T12:00:00.000Z",
      }],
      crmSyncs: [{ id: "crm_1", status: "FAILED", objectType: "contact", lastError: null }],
    });
    expect(sessionsFind).toHaveBeenCalledWith(expect.objectContaining({ where: { workspaceId: "ws_1", leadId: "lead_1" } }));
    expect(runsFind).toHaveBeenCalledWith(expect.objectContaining({ where: { workspaceId: "ws_1", leadId: "lead_1" } }));
    expect(crmFind).toHaveBeenCalledWith(expect.objectContaining({ where: { workspaceId: "ws_1", leadId: "lead_1" } }));
    expect(runsFind.mock.calls[0][0].select).not.toHaveProperty("inputsJson");
    expect(runsFind.mock.calls[0][0].select).not.toHaveProperty("outputJson");
  });
});
