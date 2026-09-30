// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ cases: vi.fn(), create: vi.fn(), results: vi.fn(), audit: vi.fn(), claude: vi.fn() }));
vi.mock("@/lib/prisma", () => { const db = { evalCase: { findMany: m.cases }, evalRun: { create: m.create }, evalCaseResult: { createMany: m.results } }; return { prisma: { ...db, $transaction: (f: (db: unknown) => unknown) => f(db) } }; });
vi.mock("@/lib/control/audit", () => ({ writeAdminAudit: m.audit }));
vi.mock("@/lib/queues", () => ({ getAgentRunsQueue: vi.fn() }));
vi.mock("@/lib/ai-core/agent/claude", () => ({ callClaudeJson: m.claude, runClaudeToolLoop: m.claude }));
import { startEvalRun, partitionEvalComparison } from "@/lib/control/eval-run";
beforeEach(() => { vi.clearAllMocks(); m.create.mockResolvedValue({ id: "run" }); });
it("baseline scores full frozen answers without Claude", async () => {
 m.cases.mockResolvedValue(["safe", "18% upsell"].map((talkTrack,i) => ({ id: `case${i}`, outputSnapshot: { salesConfidence: 87, headAgent: { talkTrack } }, expectedJson: { icpMin: 70, forbiddenClaims: ["18% upsell"], forbiddenAngles: [] } })));
 expect(await startEvalRun({ workspaceId: "ws", datasetId: "dataset", label: "taban", actorUserId: "user", actorRole: "REVIEWER" })).toEqual({ id: "run", passed: 1, total: 2 });
 expect(m.create.mock.calls[0][0].data).toMatchObject({ workspaceId: "ws", label: "taban", summaryJson: { passed: 1, total: 2, failedCaseIds: ["case1"] } });
 expect(m.results.mock.calls[0][0].data[0].outputJson).toEqual({ salesConfidence: 87, headAgent: { talkTrack: "safe" } });
 expect(m.claude).not.toHaveBeenCalled();
});
it("compares regression, improvement and unchanged results", () => {
 const base = [true,false,true].map((passed,i) => ({ evalCaseId: `${i}`, passed, failures: [], outputJson: {}, businessName: `Business ${i}` }));
 const next = base.map((r,i) => ({ ...r, passed: [false,true,true][i] }));
 const result = partitionEvalComparison(base,next);
 expect([result.broken.length,result.fixed.length,result.same.length]).toEqual([1,1,1]);
 expect(result.broken[0].businessName).toBe("Business 0");
});
