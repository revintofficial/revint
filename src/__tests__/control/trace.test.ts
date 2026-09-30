// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { leadFind, sessionsFind, runsFind, crmFind } = vi.hoisted(() => ({
  leadFind: vi.fn(),
  sessionsFind: vi.fn(),
  runsFind: vi.fn(),
  crmFind: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: { findFirst: leadFind, findMany: leadFind },
    plannerSession: { findMany: sessionsFind },
    agentRun: { findMany: runsFind },
    crmSyncLog: { findMany: crmFind },
  },
}));

import { toDecisionCard } from "@/lib/control/decision";
import { getLeadTrace, listTraceLeads } from "@/lib/control/trace";

const now = new Date("2026-09-26T12:00:00Z");

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
      select: { id: true, businessName: true, accountId: true },
    });
    expect(sessionsFind).not.toHaveBeenCalled();
    expect(runsFind).not.toHaveBeenCalled();
    expect(crmFind).not.toHaveBeenCalled();
  });

  it("nests runs under sessions and maps output to a decision card", async () => {
    leadFind.mockResolvedValue({ id: "lead_1", businessName: "Cafe" });
    sessionsFind.mockResolvedValue([{
      id: "session_1", status: "PLANNING", goal: "Find leads",
      createdAt: new Date("2026-09-25T12:00:00Z"),
      updatedAt: new Date("2026-09-25T12:30:00Z"),
    }]);
    runsFind.mockResolvedValue([
      {
        id: "run_1", workerKind: "ICP_SCORER", status: "FAILED", plannerSessionId: "session_1",
        costUsdCents: 3, errorMsg: "failed", startedAt: null, finishedAt: new Date("2026-09-26T12:00:00Z"),
        outputJson: { icpFitScore: 81, modules: ["QR_MENU"], claims: ["faster turns"], angle: "qr", secret: true },
      },
      {
        id: "run_2", workerKind: "OPENER_WRITER", status: "SUCCEEDED", plannerSessionId: null,
        costUsdCents: 0, errorMsg: null, startedAt: null, finishedAt: null,
        outputJson: null,
      },
    ]);
    crmFind.mockResolvedValue([{ id: "crm_1", status: "FAILED", objectType: "contact", lastError: null }]);

    const trace = await getLeadTrace("ws_1", "lead_1");
    expect(trace).toEqual({
      lead: { id: "lead_1", businessName: "Cafe" },
      sessions: [{
        id: "session_1",
        status: "PLANNING",
        goal: "Find leads",
        createdAt: "2026-09-25T12:00:00.000Z",
        updatedAt: "2026-09-25T12:30:00.000Z",
        runs: [{
          id: "run_1",
          workerKind: "ICP_SCORER",
          status: "FAILED",
          costUsdCents: 3,
          errorMsg: "failed",
          startedAt: null,
          finishedAt: "2026-09-26T12:00:00.000Z",
          decision: toDecisionCard({}, { finishedAt: "2026-09-26T12:00:00.000Z" }),
          rawJson: JSON.stringify({ icpFitScore: 81, modules: ["QR_MENU"], claims: ["faster turns"], angle: "qr", secret: true }),
        }],
      }],
      unsessionedRuns: [{
        id: "run_2",
        workerKind: "OPENER_WRITER",
        status: "SUCCEEDED",
        costUsdCents: 0,
        errorMsg: null,
        startedAt: null,
        finishedAt: null,
        decision: toDecisionCard(null),
        rawJson: "",
      }],
      crmSyncs: [{ id: "crm_1", status: "FAILED", objectType: "contact", lastError: null }],
    });
    expect(JSON.stringify(trace)).not.toContain("outputJson");
    expect(sessionsFind).toHaveBeenCalledWith(expect.objectContaining({ where: { workspaceId: "ws_1", leadId: "lead_1" } }));
    expect(runsFind).toHaveBeenCalledWith(expect.objectContaining({ where: { workspaceId: "ws_1", leadId: "lead_1" } }));
    expect(crmFind).toHaveBeenCalledWith(expect.objectContaining({ where: { workspaceId: "ws_1", leadId: "lead_1" } }));
  });
});

describe("listTraceLeads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionsFind.mockResolvedValue([]);
    runsFind.mockResolvedValue([]);
    leadFind.mockResolvedValue([]);
  });

  it("returns one row per lead with the latest run and a failed count", async () => {
    runsFind.mockResolvedValue([
      { leadId: "l1", status: "SUCCEEDED", workerKind: "ICP_SCORER", createdAt: new Date("2026-09-26T10:00:00Z"), finishedAt: new Date("2026-09-26T10:05:00Z"), lead: { businessName: "Cafe" } },
      { leadId: "l1", status: "FAILED", workerKind: "OPENER_WRITER", createdAt: new Date("2026-09-26T09:00:00Z"), finishedAt: new Date("2026-09-26T09:05:00Z"), lead: { businessName: "Cafe" } },
      { leadId: "l2", status: "FAILED", workerKind: "ICP_SCORER", createdAt: new Date("2026-09-26T08:00:00Z"), finishedAt: new Date("2026-09-26T08:05:00Z"), lead: { businessName: "Bar" } },
    ]);

    const rows = await listTraceLeads("ws_1", "all", now);
    expect(rows).toEqual([
      { leadId: "l1", businessName: "Cafe", latestStatus: "SUCCEEDED", latestWorkerKind: "ICP_SCORER", latestAt: "2026-09-26T10:05:00.000Z", failedCount: 1 },
      { leadId: "l2", businessName: "Bar", latestStatus: "FAILED", latestWorkerKind: "ICP_SCORER", latestAt: "2026-09-26T08:05:00.000Z", failedCount: 1 },
    ]);
    expect(runsFind).toHaveBeenCalledWith(expect.objectContaining({
      where: { workspaceId: "ws_1", leadId: { not: null } },
    }));
  });

  it("keeps only leads whose latest run is FAILED", async () => {
    runsFind.mockResolvedValue([
      { leadId: "l1", status: "FAILED", workerKind: "ICP_SCORER", createdAt: new Date("2026-09-26T10:00:00Z"), finishedAt: new Date("2026-09-26T10:00:00Z"), lead: { businessName: "Cafe" } },
      { leadId: "l1", status: "SUCCEEDED", workerKind: "OPENER_WRITER", createdAt: new Date("2026-09-26T09:00:00Z"), finishedAt: new Date("2026-09-26T09:00:00Z"), lead: { businessName: "Cafe" } },
      { leadId: "l2", status: "SUCCEEDED", workerKind: "ICP_SCORER", createdAt: new Date("2026-09-26T11:00:00Z"), finishedAt: new Date("2026-09-26T11:00:00Z"), lead: { businessName: "Bar" } },
      { leadId: "l2", status: "FAILED", workerKind: "OPENER_WRITER", createdAt: new Date("2026-09-26T08:00:00Z"), finishedAt: new Date("2026-09-26T08:00:00Z"), lead: { businessName: "Bar" } },
    ]);

    const rows = await listTraceLeads("ws_1", "failed", now);
    expect(rows.map((row) => row.leadId)).toEqual(["l1"]);
    expect(rows[0]?.latestStatus).toBe("FAILED");
  });

  it("keeps leads with a planner session stuck for 30 minutes", async () => {
    sessionsFind.mockResolvedValue([{ leadId: "l9" }]);
    runsFind.mockResolvedValue([
      { leadId: "l9", status: "RUNNING", workerKind: "ICP_SCORER", createdAt: new Date("2026-09-26T10:00:00Z"), finishedAt: null, lead: { businessName: "Stuck" } },
      { leadId: "l3", status: "FAILED", workerKind: "ICP_SCORER", createdAt: new Date("2026-09-26T10:00:00Z"), finishedAt: new Date("2026-09-26T10:00:00Z"), lead: { businessName: "Other" } },
    ]);

    const rows = await listTraceLeads("ws_1", "stuck", now);
    expect(sessionsFind).toHaveBeenCalledWith({
      where: {
        workspaceId: "ws_1",
        leadId: { not: null },
        status: { in: ["PLANNING", "EXECUTING"] },
        updatedAt: { lt: new Date("2026-09-26T11:30:00Z") },
      },
      select: { leadId: true },
    });
    expect(rows).toEqual([
      { leadId: "l9", businessName: "Stuck", latestStatus: "RUNNING", latestWorkerKind: "ICP_SCORER", latestAt: "2026-09-26T10:00:00.000Z", failedCount: 0 },
    ]);
  });
});
