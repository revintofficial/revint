// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const leadFindFirst = vi.fn();
const runCreate = vi.fn();
const enqueue = vi.fn();
const audit = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma: {
  lead: { findFirst: (...args: unknown[]) => leadFindFirst(...args) },
  agentRun: { create: (...args: unknown[]) => runCreate(...args) },
} }));
vi.mock("@/lib/control/enqueue-run", () => ({ tryEnqueue: (...args: unknown[]) => enqueue(...args) }));
vi.mock("@/lib/control/audit", () => ({ writeAdminAudit: (...args: unknown[]) => audit(...args) }));
vi.mock("@/lib/agent-workers/registry", () => ({ getWorker: (kind: string) => kind === "ICP_SCORER" ? { phase1Enabled: true, hiddenFromPanel: false } : undefined }));

const input = { actorUserId: "admin", actorRole: "ADMIN" as const, workspaceId: "ws-a", leadId: "lead-a", workerKind: "ICP_SCORER", reason: "Retry after corrected source" };

beforeEach(() => {
  vi.clearAllMocks();
  leadFindFirst.mockResolvedValue({ id: "lead-a", subNicheVersion: 3 });
  runCreate.mockResolvedValue({ id: "run-a" });
  enqueue.mockResolvedValue(false);
  audit.mockResolvedValue({ id: "audit-a" });
});

describe("control rerun", () => {
  it("rejects a blank reason before any lead lookup or enqueue", async () => {
    const { rerunLeadWorker } = await import("@/lib/control/rerun");
    expect(await rerunLeadWorker({ ...input, reason: "  " })).toMatchObject({ ok: false, status: 400 });
    expect(leadFindFirst).not.toHaveBeenCalled();
    expect(runCreate).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("returns 404 for a lead outside the selected workspace", async () => {
    leadFindFirst.mockResolvedValue(null);
    const { rerunLeadWorker } = await import("@/lib/control/rerun");
    expect(await rerunLeadWorker(input)).toMatchObject({ ok: false, status: 404 });
    expect(leadFindFirst).toHaveBeenCalledWith({ where: { id: "lead-a", workspaceId: "ws-a" }, select: { id: true, subNicheVersion: true } });
    expect(runCreate).not.toHaveBeenCalled();
  });

  it("rejects an enum kind without an executable lead registry entry", async () => {
    const { rerunLeadWorker } = await import("@/lib/control/rerun");
    expect(await rerunLeadWorker({ ...input, workerKind: "WEBSITE_AUDITOR" })).toMatchObject({ ok: false, status: 400 });
    expect(runCreate).not.toHaveBeenCalled();
  });

  it("leaves a failed enqueue pending and audits the outcome", async () => {
    const { rerunLeadWorker } = await import("@/lib/control/rerun");
    expect(await rerunLeadWorker(input)).toEqual({ ok: true, runId: "run-a", enqueued: false });
    expect(runCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ workspaceId: "ws-a", leadId: "lead-a", status: "PENDING", inputSubNicheVersion: 3 }) }));
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ reason: input.reason, outcome: "SUCCEEDED", afterJson: { workerKind: "ICP_SCORER", runId: "run-a", enqueued: false } }));
  });
});
