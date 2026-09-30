// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ auth: vi.fn(), active: vi.fn(), cases: vi.fn(), create: vi.fn(), dataset: vi.fn(), lock: vi.fn(), add: vi.fn(), audit: vi.fn(), claude: vi.fn() }));
vi.mock("@/lib/control/roles", () => ({ requireControlRole: m.auth }));
vi.mock("@/lib/control/audit", () => ({ writeAdminAudit: m.audit }));
vi.mock("@/lib/queues", () => ({ getAgentRunsQueue: () => ({ add: m.add }) }));
vi.mock("@/lib/ai-core/agent/claude", () => ({ callClaudeJson: m.claude, runClaudeToolLoop: m.claude }));
vi.mock("@/lib/prisma", () => { const db = { $queryRaw: m.lock, evalRun: { findFirst: m.active, create: m.create }, evalCase: { findMany: m.cases }, evalDataset: { findFirst: m.dataset } }; return { prisma: { ...db, $transaction: (f: (db: unknown) => unknown) => f(db) } }; });
import { POST } from "@/app/api/admin/control/golden/runs/route";
const request = (extra = {}) => new Request("http://localhost/api/admin/control/golden/runs", { method: "POST", body: JSON.stringify({ workspaceId: "ws", label: "aday", confirmed: true, caseCount: 2, ...extra }) });
beforeEach(() => { vi.clearAllMocks(); m.auth.mockResolvedValue({ userId: "admin", role: "ADMIN" }); m.active.mockResolvedValue(null); m.dataset.mockResolvedValue({ id: "ds" }); m.cases.mockResolvedValue([{ id: "a" },{ id: "b" }]); m.create.mockResolvedValue({ id: "eval" }); });
it("candidate API queues replay and never calls Claude", async () => {
 expect((await POST(request())).status).toBe(202);
 expect(m.lock).toHaveBeenCalled();
 expect(m.create.mock.calls[0][0].data).toMatchObject({ workspaceId: "ws", status: "PENDING", label: "aday", summaryJson: { caseIds: ["a","b"] } });
 expect(m.add).toHaveBeenCalledWith("control_eval_replay", { type: "control_eval_replay", workspaceId: "ws", evalRunId: "eval" }, expect.anything());
 expect(m.claude).not.toHaveBeenCalled();
});
it("returns 409 for a second workspace candidate", async () => {
 m.active.mockResolvedValue({ id: "existing" }); expect((await POST(request())).status).toBe(409); expect(m.add).not.toHaveBeenCalled(); expect(m.create).not.toHaveBeenCalled();
});
it("requires ADMIN and case count confirmation", async () => {
 m.auth.mockResolvedValue({ userId: "reviewer", role: "REVIEWER" }); expect((await POST(request())).status).toBe(403);
 m.auth.mockResolvedValue({ userId: "admin", role: "ADMIN" }); expect((await POST(request({ confirmed: false }))).status).toBe(400);
 expect((await POST(request({ caseCount: 3 }))).status).toBe(409);
 expect(m.add).not.toHaveBeenCalled();
});
