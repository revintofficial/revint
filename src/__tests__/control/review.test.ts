// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ runs: vi.fn(), run: vi.fn(), reviews: vi.fn(), create: vi.fn(), audit: vi.fn(), update: vi.fn(), lens: vi.fn() }));
vi.mock("@/lib/prisma", () => { const db = { agentRun: { findMany: m.runs, findFirst: m.run, update: m.update }, humanReview: { findMany: m.reviews, create: m.create } }; return { prisma: { ...db, $transaction: (f: (db: unknown) => unknown) => f(db) } }; });
vi.mock("@/lib/control/audit", () => ({ writeAdminAudit: m.audit }));
vi.mock("@/lib/control/roles", () => ({ resolveControlLens: m.lens, roleAtLeast: (role: string) => role !== "VIEWER" }));
import { buildReviewView, listReviewQueue, normalizeReviewSeconds, recordReview } from "@/lib/control/review";
import { RUBRIC_VERSION } from "@/lib/control/rubric";
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
 expect(m.runs).toHaveBeenCalledWith(expect.objectContaining({ where: { workspaceId: "ws", workerKind: "LEAD_INTELLIGENCE_BRIEF", status: "SUCCEEDED", leadId: { not: null }, finishedAt: { gte: new Date("2026-09-14") } } }));
 m.reviews.mockResolvedValue([...rows, { lens: "SALES", agentRunId: "run", createdAt: new Date() }]);
 expect(await listReviewQueue("ws")).toEqual([]);
});
it("verdicts on an older brief do not close the newest brief", async () => {
 m.runs.mockResolvedValue([{ id: "new", leadId: "lead", lead: { businessName: "Burger House" }, outputJson: {}, finishedAt: new Date() }]);
 m.reviews.mockResolvedValue(["TECHNICAL", "DOMAIN", "SALES"].map(lens => ({ lens, agentRunId: "old", createdAt: new Date() })));
 expect((await listReviewQueue("ws"))[0].missingLenses).toHaveLength(3);
});

type Row = { id: string; lens: string | null; source: string; verdict: string; errorClass: string | null; severity: string | null; note: string | null; createdAt: Date; rubricVersion: string; reviewSeconds: number | null; agentRunId: string };
function useStore(initial: Row[] = []) {
 const rows = [...initial];
 m.reviews.mockImplementation(async () => [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
 m.create.mockImplementation(async ({ data }: { data: Omit<Row, "id" | "createdAt"> }) => { const row = { ...data, id: `r${rows.length + 1}`, createdAt: new Date(Date.now() + rows.length) } as Row; rows.push(row); return { id: row.id }; });
 return rows;
}
const lensRow = (lens: string, verdict = "PASS"): Row => ({ id: `x_${lens}`, lens, source: "LENS", verdict, errorClass: null, severity: null, note: null, createdAt: new Date("2026-09-29T10:00:00Z"), rubricVersion: RUBRIC_VERSION, reviewSeconds: 60, agentRunId: "run_1" });
const salesInput = { ...input, workspaceId: "ws_1", agentRunId: "run_1", verdict: "PASS" as const, lens: "SALES" as const };

it("hides other lens verdicts until this lens has written one", async () => {
 useStore();
 const view = await buildReviewView({ workspaceId: "ws_1", agentRunId: "run_1", lens: "SALES" });
 expect(view.priorReviews).toEqual([]);
 expect(view.missingLensNames).toEqual(["Teknik", "Alan"]);
 expect(view.revealed).toBe(false);
 expect(m.reviews).toHaveBeenCalledWith(expect.objectContaining({ where: { workspaceId: "ws_1", agentRunId: "run_1" } }));
});

it("does not reveal a written TECHNICAL verdict or an SDR rejection to a lens that has not voted", async () => {
 useStore([lensRow("TECHNICAL", "FAIL"), { ...lensRow("x"), id: "sdr", lens: null, source: "SDR", verdict: "FAIL", errorClass: "UNSUPPORTED_CLAIM", rubricVersion: "sdr" }]);
 const view = await buildReviewView({ workspaceId: "ws_1", agentRunId: "run_1", lens: "SALES" });
 expect(view.priorReviews).toEqual([]);
 expect(view.sdrReviews).toEqual([]);
 expect(view.missingLensNames).toEqual(["Alan"]);
});

it("reveals the other verdicts once this lens has written one", async () => {
 m.lens.mockResolvedValue("SALES");
 useStore([lensRow("TECHNICAL"), lensRow("DOMAIN", "FAIL")]);
 await recordReview({ ...salesInput });
 const view = await buildReviewView({ workspaceId: "ws_1", agentRunId: "run_1", lens: "SALES" });
 expect(view.revealed).toBe(true);
 expect(view.ownReview).toMatchObject({ lens: "SALES", verdict: "PASS" });
 expect(view.priorReviews.map(r => r.lens)).toEqual(["TECHNICAL", "DOMAIN"]);
 expect(view.missingLensNames).toEqual([]);
 expect(view.rubricVersion).toBe(RUBRIC_VERSION);
});

it("an observer without a lens sees every verdict", async () => {
 useStore([lensRow("TECHNICAL")]);
 const view = await buildReviewView({ workspaceId: "ws_1", agentRunId: "run_1", lens: null });
 expect(view.priorReviews).toHaveLength(1);
 expect(view.missingLensNames).toEqual(["Alan", "Satış"]);
});

it("stamps the rubric version and the elapsed seconds", async () => {
 await recordReview({ ...input, reviewSeconds: 74 });
 expect(m.create).toHaveBeenCalledWith(expect.objectContaining({
   data: expect.objectContaining({ rubricVersion: RUBRIC_VERSION, reviewSeconds: 74, source: "LENS" }),
 }));
});

it("stores null seconds outside 1–1800", async () => {
 for (const bad of [0, -5, 1801, Number.NaN, undefined, null]) {
   m.create.mockClear();
   await recordReview({ ...input, reviewSeconds: bad as number | null | undefined });
   expect(m.create.mock.calls[0][0].data.reviewSeconds).toBeNull();
 }
 expect(normalizeReviewSeconds(1)).toBe(1);
 expect(normalizeReviewSeconds(1800)).toBe(1800);
 expect(normalizeReviewSeconds("90")).toBe(90);
 expect(normalizeReviewSeconds(12.4)).toBe(12);
});
