// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ runs: vi.fn(), reviews: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { agentRun: { findMany: m.runs }, humanReview: { findMany: m.reviews } } }));
vi.mock("@/lib/control/audit", () => ({ writeAdminAudit: vi.fn() }));
vi.mock("@/lib/control/roles", () => ({ resolveControlLens: vi.fn(), roleAtLeast: () => true }));
import { listRecentBriefs, listReviewQueue, sdrFlagFor } from "@/lib/control/review";
import { sdrFlagLabel } from "@/lib/control/labels";

const run = (id: string, leadId: string, finishedAt: string) => ({ id, leadId, lead: { businessName: leadId }, outputJson: {}, finishedAt: new Date(finishedAt) });
const at = (iso: string) => new Date(iso);

beforeEach(() => {
  vi.clearAllMocks();
  m.runs.mockResolvedValue([run("run_a", "A", "2026-09-29T12:00:00Z"), run("run_b", "B", "2026-09-29T10:00:00Z"), run("run_c", "C", "2026-09-29T08:00:00Z")]);
});

it("puts an SDR rejection at the front of the review queue", async () => {
  m.reviews.mockResolvedValue([{ agentRunId: "run_c", lens: null, source: "SDR", verdict: "FAIL", errorClass: "UNSUPPORTED_CLAIM", createdAt: at("2026-09-29T13:00:00Z") }]);
  const queue = await listReviewQueue("ws_1", at("2026-09-30T00:00:00Z"));
  expect(queue.map(r => r.agentRunId)).toEqual(["run_c", "run_a", "run_b"]);
  expect(queue[0].sdrFlag).toBe("UNSUPPORTED_CLAIM");
  expect(queue[1].sdrFlag).toBeNull();
  expect(sdrFlagLabel(queue[0].sdrFlag!)).toBe("SDR kullanmadı: iddia dayanaksız.");
});

it("reads only LENS and SDR rows, scoped to the workspace", async () => {
  m.reviews.mockResolvedValue([]);
  await listRecentBriefs("ws_1", at("2026-09-30T00:00:00Z"));
  expect(m.reviews).toHaveBeenCalledWith(expect.objectContaining({ where: { workspaceId: "ws_1", agentRunId: { in: ["run_a", "run_b", "run_c"] }, source: { in: ["LENS", "SDR"] } } }));
});

it("SDR rows never close a lens and do not change the queue definition", async () => {
  m.reviews.mockResolvedValue([
    ...["TECHNICAL", "DOMAIN", "SALES"].map(lens => ({ agentRunId: "run_b", lens, source: "LENS", verdict: "PASS", errorClass: null, createdAt: at("2026-09-29T11:00:00Z") })),
    { agentRunId: "run_b", lens: null, source: "SDR", verdict: "FAIL", errorClass: "STALE_SOURCE", createdAt: at("2026-09-29T12:00:00Z") },
    { agentRunId: "run_a", lens: null, source: "SDR", verdict: "PASS", errorClass: null, createdAt: at("2026-09-29T12:00:00Z") },
  ]);
  const queue = await listReviewQueue("ws_1", at("2026-09-30T00:00:00Z"));
  // run_b is fully reviewed, so it leaves the queue even though an SDR rejected it.
  expect(queue.map(r => r.agentRunId)).toEqual(["run_a", "run_c"]);
  expect(queue[0].missingLenses).toEqual(["TECHNICAL", "DOMAIN", "SALES"]);
  const all = await listRecentBriefs("ws_1", at("2026-09-30T00:00:00Z"));
  expect(all[0]).toMatchObject({ agentRunId: "run_b", sdrFlag: "STALE_SOURCE", missingLenses: [] });
});

it("the newest SDR row wins: a later 'used' clears an earlier rejection", () => {
  expect(sdrFlagFor([
    { source: "SDR", verdict: "FAIL", errorClass: "OUT_OF_PROFILE", createdAt: at("2026-09-29T10:00:00Z") },
    { source: "SDR", verdict: "PASS", errorClass: null, createdAt: at("2026-09-29T11:00:00Z") },
  ])).toBeNull();
  expect(sdrFlagFor([
    { source: "SDR", verdict: "PASS", errorClass: null, createdAt: at("2026-09-29T10:00:00Z") },
    { source: "SDR", verdict: "FAIL", errorClass: "ALREADY_CUSTOMER", createdAt: at("2026-09-29T11:00:00Z") },
    { source: "LENS", verdict: "FAIL", errorClass: "STALE_SOURCE", createdAt: at("2026-09-29T12:00:00Z") },
  ])).toBe("ALREADY_CUSTOMER");
  expect(sdrFlagLabel("ALREADY_CUSTOMER")).toBe("SDR kullanmadı: zaten müşteri.");
});

it("keeps several SDR rejections in newest-brief order", async () => {
  m.reviews.mockResolvedValue(["run_b", "run_c"].map(id => ({ agentRunId: id, lens: null, source: "SDR", verdict: "FAIL", errorClass: "IDENTITY_MISMATCH", createdAt: at("2026-09-29T13:00:00Z") })));
  expect((await listReviewQueue("ws_1", at("2026-09-30T00:00:00Z"))).map(r => r.agentRunId)).toEqual(["run_b", "run_c", "run_a"]);
});
