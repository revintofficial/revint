// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ runs: vi.fn(), run: vi.fn(), reviews: vi.fn(), create: vi.fn(), audit: vi.fn(), update: vi.fn(), lens: vi.fn() }));
vi.mock("@/lib/prisma", () => { const db = { agentRun: { findMany: m.runs, findFirst: m.run, update: m.update }, humanReview: { findMany: m.reviews, create: m.create } }; return { prisma: { ...db, $transaction: (f: (db: unknown) => unknown) => f(db) } }; });
vi.mock("@/lib/control/audit", () => ({ writeAdminAudit: m.audit }));
vi.mock("@/lib/control/roles", () => ({ resolveControlLens: m.lens, roleAtLeast: (role: string) => role !== "VIEWER" }));
import { listReviewQueue, recordReview } from "@/lib/control/review";
const input = { workspaceId: "ws", leadId: "lead", agentRunId: "run", verdict: "FAIL" as const, errorClass: "STALE_SOURCE" as const, severity: "P0" as const, note: "The evidence is stale.", reviewerUserId: "user", actorRole: "REVIEWER" as const };
beforeEach(() => { vi.clearAllMocks(); m.lens.mockResolvedValue("TECHNICAL"); m.run.mockResolvedValue({ id: "run" }); m.create.mockResolvedValue({ id: "review" }); });
it("FAIL appends a lens verdict and audit without updating the run", async () => {
 await recordReview(input);
 expect(m.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ workspaceId: "ws", lens: "TECHNICAL", verdict: "FAIL" }) }));
 expect(m.update).not.toHaveBeenCalled();
 expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "review.record", workspaceId: "ws" }), expect.anything());
 expect(m.run).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ workspaceId: "ws", leadId: "lead", id: "run", status: "SUCCEEDED", workerKind: "LEAD_INTELLIGENCE_BRIEF" }) }));
});
it("PASS clears class and severity", async () => {
 await recordReview({ ...input, verdict: "PASS" });
 expect(m.create.mock.calls[0][0].data).toMatchObject({ errorClass: null, severity: null });
});
it("rejects missing fail detail and missing or impersonated lenses", async () => {
 await expect(recordReview({ ...input, note: "" })).rejects.toThrow("fail requires");
 await expect(recordReview({ ...input, lens: "SALES" })).rejects.toThrow();
 m.lens.mockResolvedValue(null);
 await expect(recordReview(input)).rejects.toThrow();
 expect(m.create).not.toHaveBeenCalled();
});
it("rejects a run outside the workspace or a failed run", async () => {
 m.run.mockResolvedValue(null); await expect(recordReview(input)).rejects.toThrow(); expect(m.create).not.toHaveBeenCalled();
});
it("keeps two lenses, ignores legacy rows, removes three, and queries only successful briefs", async () => {
 m.runs.mockResolvedValue([{ id: "run", leadId: "lead", lead: { businessName: "Burger House" }, outputJson: { salesConfidence: 87 }, finishedAt: new Date("2026-09-28") }]);
 const rows = ["TECHNICAL", "DOMAIN", null].map(lens => ({ lens, agentRunId: "run", createdAt: new Date() }));
 m.reviews.mockResolvedValue(rows);
 expect(await listReviewQueue("ws", new Date("2026-09-28"))).toMatchObject([{ businessName: "Burger House", missingLenses: ["SALES"] }]);
 expect(m.runs).toHaveBeenCalledWith(expect.objectContaining({ where: { workspaceId: "ws", workerKind: "LEAD_INTELLIGENCE_BRIEF", status: "SUCCEEDED", leadId: { not: null }, finishedAt: { gte: new Date("2026-09-14") } }, distinct: ["leadId"] }));
 m.reviews.mockResolvedValue([...rows, { lens: "SALES", agentRunId: "run", createdAt: new Date() }]);
 expect(await listReviewQueue("ws")).toEqual([]);
});
it("verdicts on an older brief do not close the newest brief", async () => {
 m.runs.mockResolvedValue([{ id: "new", leadId: "lead", lead: { businessName: "Burger House" }, outputJson: {}, finishedAt: new Date() }]);
 m.reviews.mockResolvedValue(["TECHNICAL", "DOMAIN", "SALES"].map(lens => ({ lens, agentRunId: "old", createdAt: new Date() })));
 expect((await listReviewQueue("ws"))[0].missingLenses).toHaveLength(3);
});
