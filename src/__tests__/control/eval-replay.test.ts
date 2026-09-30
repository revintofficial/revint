// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ run: vi.fn(), update: vi.fn(), workspace: vi.fn(), cases: vi.fn(), results: vi.fn(), create: vi.fn(), audit: vi.fn(), replay: vi.fn(), mode: vi.fn(), sourceUpdate: vi.fn() }));
vi.mock("@/lib/prisma", () => { const db = { evalRun: { findFirst: m.run, updateMany: m.update }, workspace: { findFirst: m.workspace }, evalCase: { findMany: m.cases }, evalCaseResult: { findMany: m.results, create: m.create }, lead: { update: m.sourceUpdate }, agentRun: { update: m.sourceUpdate } }; return { prisma: { ...db, $transaction: (f: (db: unknown) => unknown) => f(db) } }; });
vi.mock("@/lib/control/audit", () => ({ writeAdminAudit: m.audit }));
vi.mock("@/lib/feature-flags", () => ({ getHeadAgentMode: m.mode }));
vi.mock("@/lib/ai-core/agent/claude", () => ({ isAnthropicConfigured: () => true }));
vi.mock("@/lib/ai-core/agent/head-agent", () => ({ isFnbNiche: (v: string) => v === "RESTAURANT_TECH", replayHeadAgentDecision: m.replay }));
import { executeEvalReplay } from "@/lib/control/eval-replay";
beforeEach(() => {
 vi.clearAllMocks(); m.run.mockResolvedValue({ id: "run", workspaceId: "ws", datasetId: "ds", createdByUserId: "admin", status: "PENDING", summaryJson: { caseIds: ["a","b"] } }); m.workspace.mockResolvedValue({ niche: "RESTAURANT_TECH" }); m.mode.mockReturnValue("live");
 m.cases.mockResolvedValue(["a","b"].map(id => ({ id, inputSnapshot: { businessName: id }, expectedJson: { forbiddenClaims: [], forbiddenAngles: [] } })));
 m.results.mockResolvedValueOnce([]).mockResolvedValueOnce([{ evalCaseId: "a", passed: false },{ evalCaseId: "b", passed: true }]);
});
it("head agent off fails cases but finishes SUCCEEDED", async () => {
 m.mode.mockReturnValue("off"); await executeEvalReplay("ws","run");
 expect(m.replay).not.toHaveBeenCalled();
 expect(m.create.mock.calls[0][0].data.failures[0].code).toBe("HEAD_AGENT_UNAVAILABLE");
 expect(m.update.mock.calls.at(-1)?.[0]).toMatchObject({ where: { workspaceId: "ws", id: "run" }, data: { status: "SUCCEEDED" } });
 expect(m.sourceUpdate).not.toHaveBeenCalled();
});
it("continues after a replay exception and checkpoints completed cases", async () => {
 m.replay.mockRejectedValueOnce(new Error("model failed")).mockResolvedValueOnce({ salesConfidence: 87 }); await executeEvalReplay("ws","run");
 expect(m.create.mock.calls[0][0].data.failures[0].code).toBe("REPLAY_FAILED");
 expect(m.create.mock.calls[1][0].data.passed).toBe(true);
 expect(m.replay).toHaveBeenNthCalledWith(2,{ businessName: "b" });
 expect(m.sourceUpdate).not.toHaveBeenCalled();
});
it("does not execute a completed or foreign run", async () => {
 m.run.mockResolvedValue(null); await executeEvalReplay("ws","run"); expect(m.replay).not.toHaveBeenCalled(); expect(m.create).not.toHaveBeenCalled();
 expect(m.run.mock.calls[0][0].where).toMatchObject({ workspaceId: "ws", id: "run" });
});
