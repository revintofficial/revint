// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ member: vi.fn(), run: vi.fn(), create: vi.fn(), audit: vi.fn(), requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => {
  const db = { workspaceMember: { findFirst: m.member }, agentRun: { findFirst: m.run }, humanReview: { create: m.create } };
  return { prisma: { ...db, $transaction: (f: (db: unknown) => unknown) => f(db) } };
});
vi.mock("@/lib/control/audit", () => ({ writeAdminAudit: m.audit }));
vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  const withAuth = <T extends unknown[]>(handler: (session: unknown, ...args: T) => Promise<Response>) => async (...args: T) => {
    try { return await handler(await m.requireUser(), ...args); } catch (err) {
      if (err instanceof actual.UnauthorizedError) return Response.json({ error: "Unauthorized" }, { status: 401 });
      if (err instanceof actual.ForbiddenError) return Response.json({ error: err.message }, { status: 403 });
      if (err instanceof actual.NotFoundError) return Response.json({ error: err.message }, { status: 404 });
      return Response.json({ error: "Internal" }, { status: 500 });
    }
  };
  return { ...actual, requireUser: m.requireUser, withAuth };
});
import { missingLenses } from "@/lib/control/lenses";
import { recordSdrFeedback, SDR_REASONS } from "@/lib/control/sdr-feedback";
import { POST } from "@/app/api/leads/[id]/feedback/route";

const base = { workspaceId: "ws_1", leadId: "lead_1", agentRunId: "run_1", used: false, reason: "UNSUPPORTED_CLAIM" as const, note: "Rakam kaynaksız.", userId: "user_1" };

beforeEach(() => {
  vi.clearAllMocks();
  m.member.mockImplementation(async ({ where }: { where: { workspaceId: string } }) => (where.workspaceId === "ws_1" ? { id: "mem" } : null));
  m.run.mockImplementation(async ({ where }: { where: { workspaceId: string } }) => (where.workspaceId === "ws_1" ? { id: "run_1" } : null));
  m.create.mockResolvedValue({ id: "hr_1" });
  m.requireUser.mockResolvedValue({ user: { id: "user_1" }, workspaceId: "ws_1" });
});

describe("recordSdrFeedback", () => {
  it("has the six reasons from the plan", () => {
    expect([...SDR_REASONS]).toEqual(["IDENTITY_MISMATCH", "STALE_SOURCE", "UNSUPPORTED_CLAIM", "PACKAGE_MISMATCH", "ALREADY_CUSTOMER", "OUT_OF_PROFILE"]);
  });

  it("refuses an unused brief without a reason", async () => {
    await expect(recordSdrFeedback({ ...base, used: false, reason: null })).rejects.toThrow("reason required");
    expect(m.create).not.toHaveBeenCalled();
  });

  it("writes a lensless review row that the triple gate ignores", async () => {
    await recordSdrFeedback({ ...base, used: false, reason: "UNSUPPORTED_CLAIM" });
    expect(m.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ lens: null, source: "SDR", verdict: "FAIL", errorClass: "UNSUPPORTED_CLAIM", severity: null, rubricVersion: "sdr", workspaceId: "ws_1", agentRunId: "run_1", leadId: "lead_1", note: "Rakam kaynaksız." }),
    }));
    expect(missingLenses([{ lens: null, createdAt: new Date() }])).toEqual(["TECHNICAL", "DOMAIN", "SALES"]);
    expect(missingLenses([{ lens: "SALES", source: "SDR", createdAt: new Date() }])).toEqual(["TECHNICAL", "DOMAIN", "SALES"]);
  });

  it("writes PASS and drops reason and note when the brief was used", async () => {
    await recordSdrFeedback({ ...base, used: true });
    expect(m.create.mock.calls[0][0].data).toMatchObject({ verdict: "PASS", errorClass: null, note: null, source: "SDR", lens: null });
  });

  it("appends an sdr.feedback audit event in the same transaction", async () => {
    await recordSdrFeedback(base);
    expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "sdr.feedback", workspaceId: "ws_1", targetType: "Lead", targetId: "lead_1", actorUserId: "user_1" }), expect.anything());
  });

  it("checks the brief belongs to the workspace and the lead", async () => {
    await recordSdrFeedback(base);
    expect(m.run).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "run_1", workspaceId: "ws_1", leadId: "lead_1", workerKind: "LEAD_INTELLIGENCE_BRIEF" }) }));
    m.run.mockResolvedValue(null);
    await expect(recordSdrFeedback(base)).rejects.toThrow();
    expect(m.create).toHaveBeenCalledTimes(1);
  });

  it("does not let a member of another workspace write feedback", async () => {
    await expect(recordSdrFeedback({ ...base, workspaceId: "ws_2" })).rejects.toThrow();
    expect(m.create).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
  });

  it("rejects an unknown reason", async () => {
    await expect(recordSdrFeedback({ ...base, reason: "BORING" as never })).rejects.toThrow("invalid reason");
  });
});

function post(body: unknown) {
  return POST(new Request("http://x/api/leads/lead_1/feedback", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }), { params: Promise.resolve({ id: "lead_1" }) });
}

describe("POST /api/leads/[id]/feedback", () => {
  it("records feedback for the session workspace, ignoring any body workspaceId", async () => {
    const res = await post({ agentRunId: "run_1", used: false, reason: "PACKAGE_MISMATCH", note: null, workspaceId: "ws_2" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, id: "hr_1" });
    expect(m.create.mock.calls[0][0].data).toMatchObject({ workspaceId: "ws_1", leadId: "lead_1", errorClass: "PACKAGE_MISMATCH", reviewerUserId: "user_1" });
  });

  it("answers 400 for an unused brief without a reason, bad JSON, or a bad reason", async () => {
    expect((await post({ agentRunId: "run_1", used: false, reason: null, note: null })).status).toBe(400);
    expect((await post("{nope")).status).toBe(400);
    expect((await post({ agentRunId: "run_1", used: "yes" })).status).toBe(400);
    expect((await post({ agentRunId: "run_1", used: false, reason: "BORING" })).status).toBe(400);
    expect(m.create).not.toHaveBeenCalled();
  });

  it("answers 404 when the brief is not this workspace's", async () => {
    m.run.mockResolvedValue(null);
    expect((await post({ agentRunId: "run_x", used: true, reason: null, note: null })).status).toBe(404);
  });
});
