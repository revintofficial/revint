// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { runCount, sessionCount, evalFind, countQueue } = vi.hoisted(() => ({
  runCount: vi.fn(),
  sessionCount: vi.fn(),
  evalFind: vi.fn(),
  countQueue: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentRun: { count: runCount },
    plannerSession: { count: sessionCount },
    evalRun: { findFirst: evalFind },
  },
}));

vi.mock("@/lib/control/review", () => ({
  countReviewQueue: countQueue,
}));

import { getControlOverview } from "@/lib/control/overview";

describe("getControlOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runCount.mockResolvedValue(0);
    sessionCount.mockResolvedValue(0);
    countQueue.mockResolvedValue(0);
    evalFind.mockResolvedValue(null);
  });

  it("counts the review queue and reads the last succeeded eval fraction", async () => {
    runCount.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
    sessionCount.mockResolvedValue(4);
    countQueue.mockResolvedValue(3);
    evalFind.mockResolvedValue({
      summaryJson: { passed: 12, total: 20, passRate: 0.6 },
      finishedAt: new Date("2026-09-26T08:00:00Z"),
    });
    const now = new Date("2026-09-26T12:00:00Z");

    await expect(getControlOverview("ws_1", now)).resolves.toEqual({
      completed24h: 2,
      failed24h: 1,
      stuckSessions: 4,
      openReviews: 3,
      lastEval: { passed: 12, total: 20, finishedAt: "2026-09-26T08:00:00.000Z" },
      lastCandidate: { passed: 12, total: 20, finishedAt: "2026-09-26T08:00:00.000Z" },
    });
    expect(countQueue).toHaveBeenCalledWith("ws_1", now);
    expect(runCount).toHaveBeenNthCalledWith(1, { where: {
      workspaceId: "ws_1", status: { in: ["SUCCEEDED", "SUCCEEDED_NO_MEMORY"] }, finishedAt: { gte: new Date("2026-09-25T12:00:00Z") },
    } });
    expect(runCount).toHaveBeenNthCalledWith(2, { where: {
      workspaceId: "ws_1", status: "FAILED", finishedAt: { gte: new Date("2026-09-25T12:00:00Z") },
    } });
    expect(sessionCount).toHaveBeenCalledWith({ where: {
      workspaceId: "ws_1", status: { in: ["PLANNING", "EXECUTING"] }, updatedAt: { lt: new Date("2026-09-26T11:30:00Z") },
    } });
    expect(evalFind).toHaveBeenCalledWith({
      where: { workspaceId: "ws_1", status: "SUCCEEDED", label: "taban" },
      orderBy: { createdAt: "desc" },
      select: { summaryJson: true, finishedAt: true },
    });
  });

  it.each([
    null,
    { passRate: 0.5 },
    { passed: "12", total: 20 },
    {},
    "bad",
  ])("returns null lastEval for malformed summary %j", async (summaryJson) => {
    evalFind.mockResolvedValue({ summaryJson, finishedAt: new Date("2026-09-26T08:00:00Z") });
    const overview = await getControlOverview("ws_1", new Date("2026-09-26T12:00:00Z"));
    expect(overview.lastEval).toBeNull();
    expect(overview).not.toHaveProperty("lastEvalPassRate");
  });
});
