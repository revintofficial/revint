// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { ForbiddenError } from "@/lib/auth";
const m = vi.hoisted(() => ({ auth: vi.fn(), run: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/control/roles", () => ({ requireControlRole: m.auth }));
vi.mock("@/lib/control/audit", () => ({ writeAdminAudit: m.audit }));
vi.mock("@/lib/prisma", () => ({ prisma: { agentRun: { findFirst: m.run } } }));
import { POST } from "@/app/api/admin/control/golden/preview/route";
const request = (body: unknown) => new Request("http://localhost/api/admin/control/golden/preview", { method: "POST", body: JSON.stringify(body) });
const output = { salesConfidence: 80, headAgent: { recommendedPackage: "premium", wedge: "reservation", recommendedModules: [] } };
beforeEach(() => { vi.clearAllMocks(); m.auth.mockResolvedValue({ userId: "u", role: "REVIEWER" }); m.run.mockResolvedValue({ outputJson: output }); });

it("scores the frozen output of a workspace run without writing anything", async () => {
  const res = await POST(request({ workspaceId: "ws", agentRunId: "run", expected: { expectedPackage: "starter", expectedWedge: "reservation", forbiddenClaims: [], forbiddenAngles: [] } }));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ passed: false, failures: [{ code: "PACKAGE", message: "Kalır, çünkü paket yanlış: Kart: Premium · Beklenen: Starter" }] });
  expect(m.run).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "run", workspaceId: "ws", status: "SUCCEEDED", workerKind: "LEAD_INTELLIGENCE_BRIEF" }) }));
  expect(m.audit).not.toHaveBeenCalled();
});

it("answers 400 for invalid rules, 404 for a foreign run, 403 without a control role", async () => {
  expect((await POST(request({ workspaceId: "ws", agentRunId: "run", expected: { expectedWedge: "delivery" } }))).status).toBe(400);
  expect((await POST(request({ workspaceId: "ws" }))).status).toBe(400);
  m.run.mockResolvedValue(null);
  expect((await POST(request({ workspaceId: "other", agentRunId: "run", expected: {} }))).status).toBe(404);
  m.auth.mockRejectedValue(new ForbiddenError("Control access required"));
  expect((await POST(request({ workspaceId: "ws", agentRunId: "run", expected: {} }))).status).toBe(403);
});
