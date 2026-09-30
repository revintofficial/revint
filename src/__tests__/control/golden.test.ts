// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ review: vi.fn(), reviews: vi.fn(), dataset: vi.fn(), run: vi.fn(), create: vi.fn(), audit: vi.fn(), lead: vi.fn(), count: vi.fn(), website: vi.fn(), analysis: vi.fn(), lens: vi.fn(), memory: vi.fn() }));
vi.mock("@/lib/prisma", () => { const db = { humanReview: { findFirst: m.review, findMany: m.reviews }, evalDataset: { findFirst: m.dataset }, agentRun: { findFirst: m.run }, evalCase: { create: m.create }, lead: { findFirst: m.lead, count: m.count }, websiteAudit: { findFirst: m.website }, reviewAnalysis: { findFirst: m.analysis }, semanticMemory: { create: m.memory, upsert: m.memory } }; return { prisma: { ...db, $transaction: (f: (db: unknown) => unknown) => f(db) } }; });
vi.mock("@/lib/control/audit", () => ({ writeAdminAudit: m.audit }));
vi.mock("@/lib/control/roles", () => ({ resolveControlLens: m.lens, roleAtLeast: () => true }));
import { promoteReviewToCase } from "@/lib/control/golden";
const input = { workspaceId: "ws", reviewId: "review", datasetId: "dataset", title: "Burger House", expected: { allowedModules: ["crm_loyalty"], forbiddenClaims: [], forbiddenAngles: [] }, actorUserId: "user", actorRole: "REVIEWER" as const };
const rows = ["TECHNICAL", "DOMAIN", "SALES"].map((lens,i) => ({ lens, createdAt: new Date(i), verdict: "FAIL", severity: i === 1 ? "P0" : "P1" }));
beforeEach(() => {
 vi.clearAllMocks(); m.lens.mockResolvedValue("DOMAIN"); m.review.mockResolvedValue({ id: "review", agentRunId: "run", leadId: "lead" }); m.reviews.mockResolvedValue(rows); m.dataset.mockResolvedValue({ id: "dataset" }); m.run.mockResolvedValue({ id: "run", leadId: "lead", outputJson: { salesConfidence: 87, headline: "Frozen", headAgent: { excludedModules: [], evidenceRefs: ["audit"] } } }); m.create.mockResolvedValue({ id: "case" });
 m.lead.mockResolvedValue({ businessName: "Burger House", formattedAddress: "Address", rating: 4.8, reviewCount: 200, priceLevel: 2, accountId: "account" }); m.count.mockResolvedValue(3); m.website.mockResolvedValue({ url: "https://burger.test", reachable: true, hasBookingSystem: true, crawlError: null }); m.analysis.mockResolvedValue({ painPhrases: [], weaknessKpis: [], strengthPhrases: [] });
});
it("rejects two lenses and names the missing lens", async () => {
 m.reviews.mockResolvedValue(rows.slice(0,2)); await expect(promoteReviewToCase(input)).rejects.toThrow("Satış"); expect(m.create).not.toHaveBeenCalled();
});
it("writes server-built frozen input and stored output at three lenses, never memory", async () => {
 await expect(promoteReviewToCase({ ...input, ...{ inputSnapshot: { businessName: "Forged" }, severity: "P2" } })).resolves.toEqual({ id: "case" });
 const data = m.create.mock.calls[0][0].data;
 expect(data).toMatchObject({ workspaceId: "ws", severity: "P0", expectedJson: input.expected, outputSnapshot: { salesConfidence: 87 }, inputSnapshot: { businessName: "Burger House", locationCount: 3, briefContext: { headline: "Frozen", salesConfidence: 87 } } });
 expect(m.count).toHaveBeenCalledWith({ where: { workspaceId: "ws", accountId: "account" } });
 expect(m.website.mock.calls[0][0].where).toEqual({ leadId: "lead", lead: { workspaceId: "ws" } });
 expect(m.memory).not.toHaveBeenCalled();
});
it("uses latest lens verdict severity and does not count null lens", async () => {
 m.reviews.mockResolvedValue([...rows.map(r => ({ ...r, verdict: "PASS", severity: null })), { lens: null, createdAt: new Date(10), verdict: "FAIL", severity: "P0" }]);
 await promoteReviewToCase(input); expect(m.create.mock.calls[0][0].data.severity).toBe("P2");
});
it("rejects a caller without a lens", async () => { m.lens.mockResolvedValue(null); await expect(promoteReviewToCase(input)).rejects.toThrow(); expect(m.create).not.toHaveBeenCalled(); });
