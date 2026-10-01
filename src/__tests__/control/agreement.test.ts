// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  reviewFindMany: vi.fn(),
  reviewCreate: vi.fn(),
  runFindFirst: vi.fn(),
  leadFindMany: vi.fn(),
  audit: vi.fn(),
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const db = {
    humanReview: { findMany: m.reviewFindMany, create: m.reviewCreate },
    agentRun: { findFirst: m.runFindFirst },
    lead: { findMany: m.leadFindMany },
  };
  return { prisma: { ...db, $transaction: (fn: (tx: unknown) => unknown) => fn(db) } };
});
vi.mock("@/lib/control/audit", () => ({ writeAdminAudit: m.audit }));
vi.mock("@/lib/control/roles", () => ({ requireControlRole: m.auth }));

import { POST } from "@/app/api/admin/control/uyum/adjudicate/route";
import { adjudicateRun, fleissKappa, getAgreementReport, listDisagreements } from "@/lib/control/agreement";
import { RUBRIC_VERSION } from "@/lib/control/rubric";

type Row = {
  agentRunId: string; leadId: string; lens: "TECHNICAL" | "DOMAIN" | "SALES"; verdict: "PASS" | "FAIL" | "NEEDS_REVIEW";
  errorClass: string | null; severity: string | null; note: string | null; createdAt: Date; reviewSeconds: number | null; rubricVersion: string;
};

let clock = 0;
function row(agentRunId: string, lens: Row["lens"], verdict: Row["verdict"], extra: Partial<Row> = {}): Row {
  clock += 1;
  return {
    agentRunId, leadId: `lead_${agentRunId}`, lens, verdict, errorClass: null, severity: null, note: null,
    createdAt: new Date(Date.UTC(2026, 8, 29, 0, 0, clock)), reviewSeconds: null, rubricVersion: RUBRIC_VERSION, ...extra,
  };
}
function triple(agentRunId: string, t: Row["verdict"], d: Row["verdict"], s: Row["verdict"], extra: Partial<Row> = {}): Row[] {
  return [row(agentRunId, "TECHNICAL", t, extra), row(agentRunId, "DOMAIN", d, extra), row(agentRunId, "SALES", s, extra)];
}

beforeEach(() => {
  vi.clearAllMocks();
  clock = 0;
  m.reviewFindMany.mockResolvedValue([]);
  m.leadFindMany.mockResolvedValue([]);
  m.reviewCreate.mockResolvedValue({ id: "adj_1" });
  m.audit.mockResolvedValue({ id: "audit_1" });
});

describe("fleissKappa", () => {
  it("returns 1 when every lens agrees on every item", () => {
    expect(fleissKappa([{ PASS: 3 }, { PASS: 3 }, { FAIL: 3 }])).toBeCloseTo(1, 5);
  });

  it("returns null when kappa is undefined for a single unanimous item", () => {
    expect(fleissKappa([{ PASS: 3 }])).toBeNull();
    expect(fleissKappa([])).toBeNull();
  });

  it("returns a value near zero for random labelling", () => {
    const rows = Array.from({ length: 30 }, (_, i) => (i % 3 === 0 ? { PASS: 1, FAIL: 1, NEEDS_REVIEW: 1 } : { PASS: 2, FAIL: 1 }));
    expect(fleissKappa(rows)!).toBeLessThan(0.3);
  });

  it("matches the textbook value for a mixed table", () => {
    // P̄ = 0.6, p = (0.5, 0.5) → P_e = 0.5 → κ = 0.2
    const rows = [{ PASS: 3 }, { FAIL: 3 }, { PASS: 2, FAIL: 1 }, { PASS: 1, FAIL: 2 }, { PASS: 2, FAIL: 1 }, { PASS: 1, FAIL: 2 }, { PASS: 3 }, { FAIL: 3 }, { PASS: 2, FAIL: 1 }, { PASS: 1, FAIL: 2 }];
    expect(fleissKappa(rows)).toBeCloseTo((0.6 - 0.5) / 0.5, 5);
  });
});

describe("getAgreementReport", () => {
  it("scopes every read by workspace", async () => {
    await getAgreementReport("ws_1");
    expect(m.reviewFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ workspaceId: "ws_1", source: "LENS", lens: { not: null } }),
    }));
  });

  it("filters by rubric version when asked", async () => {
    await getAgreementReport("ws_1", "2026-09-29.1");
    expect(m.reviewFindMany.mock.calls[0][0].where).toMatchObject({ workspaceId: "ws_1", rubricVersion: "2026-09-29.1" });
  });

  it("warns when more than one rubric version is mixed into the report", async () => {
    m.reviewFindMany.mockResolvedValue([
      ...triple("run_1", "PASS", "PASS", "PASS", { rubricVersion: "pre-2026-09-29" }),
      ...triple("run_2", "PASS", "FAIL", "PASS"),
    ]);
    const report = await getAgreementReport("ws_1");
    expect(report.rubricVersions.length).toBeGreaterThan(1);
  });

  it("counts only runs with all three lenses and uses the latest verdict per lens", async () => {
    m.reviewFindMany.mockResolvedValue([
      row("run_1", "TECHNICAL", "FAIL"),
      ...triple("run_1", "PASS", "PASS", "PASS"), // later rows overrule the early FAIL
      row("run_2", "TECHNICAL", "PASS"),
      row("run_2", "DOMAIN", "PASS"),
    ]);
    const report = await getAgreementReport("ws_1");
    expect(report.items).toBe(1);
    expect(report.rawAgreement).toBe(1);
    expect(report.prevalence).toEqual({ PASS: 1, FAIL: 0, NEEDS_REVIEW: 0 });
  });

  it("returns null kappa below ten items and a value from ten", async () => {
    m.reviewFindMany.mockResolvedValue(Array.from({ length: 9 }, (_, i) => triple(`run_${i}`, "PASS", "PASS", i % 2 ? "FAIL" : "PASS")).flat());
    expect((await getAgreementReport("ws_1")).fleissKappa).toBeNull();
    m.reviewFindMany.mockResolvedValue(Array.from({ length: 10 }, (_, i) => triple(`run_${i}`, i % 2 ? "FAIL" : "PASS", i % 2 ? "FAIL" : "PASS", i % 2 ? "FAIL" : "PASS")).flat());
    expect((await getAgreementReport("ws_1")).fleissKappa).toBeCloseTo(1, 5);
  });

  it("reports lens pair agreement and median seconds per lens", async () => {
    m.reviewFindMany.mockResolvedValue([
      ...triple("run_1", "PASS", "PASS", "FAIL", { reviewSeconds: 60 }),
      ...triple("run_2", "PASS", "FAIL", "FAIL", { reviewSeconds: 180 }),
    ]);
    const report = await getAgreementReport("ws_1");
    expect(report.confusion).toEqual([
      { a: "TECHNICAL", b: "DOMAIN", agreed: 1, total: 2 },
      { a: "TECHNICAL", b: "SALES", agreed: 0, total: 2 },
      { a: "DOMAIN", b: "SALES", agreed: 1, total: 2 },
    ]);
    expect(report.medianSeconds).toBe(120);
    expect(report.medianSecondsByLens).toEqual({ TECHNICAL: 120, DOMAIN: 120, SALES: 120 });
  });
});

describe("listDisagreements", () => {
  it("lists only split three-lens runs with names and the latest adjudication", async () => {
    m.reviewFindMany
      .mockResolvedValueOnce([...triple("run_1", "PASS", "PASS", "PASS"), ...triple("run_2", "PASS", "FAIL", "PASS", { note: "not" })])
      .mockResolvedValueOnce([{ agentRunId: "run_2", verdict: "FAIL" }, { agentRunId: "run_2", verdict: "PASS" }]);
    m.leadFindMany.mockResolvedValue([{ id: "lead_run_2", businessName: "Dishoom" }]);
    const rows = await listDisagreements("ws_1");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ agentRunId: "run_2", businessName: "Dishoom", adjudicatedVerdict: "FAIL" });
    expect(rows[0].verdicts.map((v) => v.lens)).toEqual(["TECHNICAL", "DOMAIN", "SALES"]);
    expect(m.reviewFindMany.mock.calls[1][0].where).toMatchObject({ workspaceId: "ws_1", source: "ADJUDICATION" });
    expect(m.leadFindMany.mock.calls[0][0].where).toMatchObject({ workspaceId: "ws_1" });
  });
});

describe("adjudication", () => {
  const input = { workspaceId: "ws_1", agentRunId: "run_1", verdict: "FAIL" as const, note: "Rezervasyon iddiası dayanaksız.", actorUserId: "admin", actorRole: "ADMIN" as const };

  beforeEach(() => {
    m.runFindFirst.mockResolvedValue({ id: "run_1", leadId: "lead_1" });
    m.reviewFindMany.mockResolvedValue(triple("run_1", "PASS", "FAIL", "PASS").map((r, i) => ({ ...r, id: `rev_${i}` })));
  });

  it("appends an adjudication row and an audit event without touching lens rows", async () => {
    await adjudicateRun(input);
    expect(m.runFindFirst.mock.calls[0][0].where).toMatchObject({ id: "run_1", workspaceId: "ws_1" });
    expect(m.reviewCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ workspaceId: "ws_1", agentRunId: "run_1", leadId: "lead_1", verdict: "FAIL", lens: null, source: "ADJUDICATION", rubricVersion: RUBRIC_VERSION }),
    }));
    expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "review.adjudicate", workspaceId: "ws_1", targetId: "lead_1" }), expect.anything());
  });

  it("refuses a non-admin even if the route guard were bypassed", async () => {
    await expect(adjudicateRun({ ...input, actorRole: "REVIEWER" })).rejects.toThrow("Yönetici");
    expect(m.reviewCreate).not.toHaveBeenCalled();
  });

  it("refuses a run that does not have all three lens verdicts", async () => {
    m.reviewFindMany.mockResolvedValue([{ ...row("run_1", "TECHNICAL", "PASS"), id: "rev_0" }]);
    await expect(adjudicateRun(input)).rejects.toThrow("üç merceğin");
    expect(m.reviewCreate).not.toHaveBeenCalled();
  });

  it("route: 403 for a reviewer, 400 without a note, 409 when incomplete, 200 for admin", async () => {
    const req = (body: Record<string, unknown>) => new Request("http://localhost/api/admin/control/uyum/adjudicate", { method: "POST", body: JSON.stringify(body) });
    const body = { workspaceId: "ws_1", agentRunId: "run_1", verdict: "FAIL", note: "gerekçe" };
    m.auth.mockResolvedValue({ userId: "rev", role: "REVIEWER", email: null });
    expect((await POST(req(body))).status).toBe(403);
    m.auth.mockResolvedValue({ userId: "admin", role: "ADMIN", email: null });
    expect((await POST(req({ ...body, note: " " }))).status).toBe(400);
    expect((await POST(req({ ...body, verdict: "MAYBE" }))).status).toBe(400);
    expect((await POST(req(body))).status).toBe(200);
    m.reviewFindMany.mockResolvedValue([]);
    expect((await POST(req(body))).status).toBe(409);
  });
});
