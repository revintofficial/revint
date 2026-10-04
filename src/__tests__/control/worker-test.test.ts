// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ leads: vi.fn(), runs: vi.fn(), rerun: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { lead: { findMany: m.leads }, agentRun: { findMany: m.runs } } }));
vi.mock("@/lib/control/rerun", () => ({ rerunLeadWorker: m.rerun }));
import { TRIAL_MAX_LEADS, diffOutputs, isTrialKind, listTrialRows, startWorkerTrial } from "@/lib/control/worker-test";

const run = (id: string, leadId: string, status: string, createdAt: string, outputJson: unknown = {}) => ({
  id, leadId, status, createdAt: new Date(createdAt), startedAt: new Date(createdAt), finishedAt: status === "PENDING" ? null : new Date(createdAt), costUsdCents: 0, errorMsg: status === "FAILED" ? "boom" : null, outputJson,
});

beforeEach(() => {
  vi.clearAllMocks();
  m.leads.mockResolvedValue(["A", "B", "C", "D"].map((id) => ({ id, businessName: id, websiteUrl: null })));
});

it("lists only the fields that changed, nested paths included", () => {
  const { changes, hidden } = diffOutputs(
    { reachable: true, siteFacts: { bookingProvider: null, pages: ["/menu"] }, gone: 1 },
    { reachable: true, siteFacts: { bookingProvider: "SevenRooms", pages: ["/menu"] }, added: "x" },
  );
  expect(hidden).toBe(0);
  expect(changes).toEqual([
    { path: "added", before: "—", after: "x", kind: "added" },
    { path: "gone", before: "1", after: "—", kind: "removed" },
    { path: "siteFacts.bookingProvider", before: "null", after: "SevenRooms", kind: "changed" },
  ]);
});

it("reports identical outputs as no change and clips long values", () => {
  expect(diffOutputs({ a: [1, 2] }, { a: [1, 2] }).changes).toEqual([]);
  const long = diffOutputs({ text: "a" }, { text: "b".repeat(500) }).changes[0];
  expect(long.after).toContain("… (500 karakter)");
});

it("compares the newest run against the previous successful one and explains when it cannot", async () => {
  m.runs.mockResolvedValue([
    run("a2", "A", "SUCCEEDED", "2026-10-04T10:00:00Z", { reachable: true }),
    run("b2", "B", "PENDING", "2026-10-04T09:00:00Z"),
    run("c1", "C", "FAILED", "2026-10-04T08:00:00Z"),
    run("a1", "A", "SUCCEEDED", "2026-10-01T10:00:00Z", { reachable: false }),
    run("b1", "B", "SUCCEEDED", "2026-10-01T09:00:00Z"),
  ]);
  const rows = await listTrialRows("ws", "WEBSITE_AUDITOR");
  expect(m.runs).toHaveBeenCalledWith(expect.objectContaining({ where: { workspaceId: "ws", workerKind: "WEBSITE_AUDITOR", leadId: { not: null } } }));
  expect(m.leads).toHaveBeenCalledWith(expect.objectContaining({ where: { workspaceId: "ws" } }));
  expect(rows.map((row) => row.leadId)).toEqual(["A", "B", "C", "D"]);
  expect(rows[0].diff?.changes).toEqual([{ path: "reachable", before: "false", after: "true", kind: "changed" }]);
  expect(rows[1]).toMatchObject({ inFlight: true, diff: null });
  expect(rows[2]).toMatchObject({ inFlight: false, diff: null, note: "boom" });
  expect(rows[3]).toMatchObject({ latest: null, note: "Bu worker bu lead'de hiç çalışmadı." });
});

it("only chain workers can be trialled", () => {
  expect(isTrialKind("WEBSITE_AUDITOR")).toBe(true);
  expect(isTrialKind("LEAD_INTELLIGENCE_BRIEF")).toBe(true);
  expect(isTrialKind("OPENER_WRITER")).toBe(false);
});

it("queues one audited rerun per distinct lead, capped, and reports what did not queue", async () => {
  m.rerun
    .mockResolvedValueOnce({ ok: true, runId: "r1", enqueued: true })
    .mockResolvedValueOnce({ ok: true, runId: "r2", enqueued: false })
    .mockResolvedValueOnce({ ok: false, status: 404, error: "Not found" });
  const result = await startWorkerTrial({ actorUserId: "u", actorRole: "ADMIN", workspaceId: "ws", workerKind: "WEBSITE_AUDITOR", leadIds: ["A", "A", "B", "C"], reason: "deep capture" });
  expect(m.rerun).toHaveBeenCalledTimes(3);
  expect(m.rerun).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: "ws", leadId: "A", workerKind: "WEBSITE_AUDITOR", reason: "deep capture" }));
  expect(result).toEqual({ started: ["A"], notQueued: ["B"], rejected: [{ leadId: "C", error: "Not found" }] });

  m.rerun.mockResolvedValue({ ok: true, runId: "r", enqueued: true });
  const many = await startWorkerTrial({ actorUserId: "u", actorRole: "ADMIN", workspaceId: "ws", workerKind: "WEBSITE_AUDITOR", leadIds: Array.from({ length: 25 }, (_, i) => `L${i}`), reason: "x" });
  expect(many.started).toHaveLength(TRIAL_MAX_LEADS);
});
