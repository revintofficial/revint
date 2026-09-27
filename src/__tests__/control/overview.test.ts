import { beforeEach, describe, expect, it, vi } from "vitest";

const { runCount, sessionCount, reviewCount, evalFind } = vi.hoisted(() => ({
  runCount: vi.fn(),
  sessionCount: vi.fn(),
  reviewCount: vi.fn(),
  evalFind: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentRun: { count: runCount },
    plannerSession: { count: sessionCount },
    humanReview: { count: reviewCount },
    evalRun: { findFirst: evalFind },
  },
}));

import { getControlOverview } from "@/lib/control/overview";

describe("getControlOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runCount.mockResolvedValue(0);
    sessionCount.mockResolvedValue(0);
    reviewCount.mockResolvedValue(0);
    evalFind.mockResolvedValue(null);
  });

  it("uses workspace scoped 24 hour and 30 minute windows", async () => {
    runCount.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
    sessionCount.mockResolvedValue(4);
    reviewCount.mockResolvedValue(3);
    evalFind.mockResolvedValue({ summaryJson: { passRate: 0.75 } });
    const now = new Date("2026-09-26T12:00:00Z");

    await expect(getControlOverview("ws_1", now)).resolves.toEqual({
      completed24h: 2, failed24h: 1, stuckSessions: 4, openReviews: 3, lastEvalPassRate: 0.75,
    });
    expect(runCount).toHaveBeenNthCalledWith(1, { where: {
      workspaceId: "ws_1", status: { in: ["SUCCEEDED", "SUCCEEDED_NO_MEMORY"] }, finishedAt: { gte: new Date("2026-09-25T12:00:00Z") },
    } });
    expect(runCount).toHaveBeenNthCalledWith(2, { where: {
      workspaceId: "ws_1", status: "FAILED", finishedAt: { gte: new Date("2026-09-25T12:00:00Z") },
    } });
    expect(sessionCount).toHaveBeenCalledWith({ where: {
      workspaceId: "ws_1", status: { in: ["PLANNING", "EXECUTING"] }, updatedAt: { lt: new Date("2026-09-26T11:30:00Z") },
    } });
    expect(reviewCount).toHaveBeenCalledWith({ where: { workspaceId: "ws_1", verdict: "NEEDS_REVIEW" } });
    expect(evalFind).toHaveBeenCalledWith({
      where: { workspaceId: "ws_1", status: "SUCCEEDED" },
      orderBy: { createdAt: "desc" },
      select: { summaryJson: true },
    });
  });

  it.each([null, { passRate: "0.5" }, {}, "bad"]) ("returns null for malformed eval summary %j", async (summaryJson) => {
    evalFind.mockResolvedValue({ summaryJson });
    await expect(getControlOverview("ws_1", new Date("2026-09-26T12:00:00Z"))).resolves.toMatchObject({ lastEvalPassRate: null });
  });
});
