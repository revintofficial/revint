// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  runFindMany: vi.fn(),
  auditCount: vi.fn(),
  caseCount: vi.fn(),
  caseFindMany: vi.fn(),
  evalFindFirst: vi.fn(),
  resultFindMany: vi.fn(),
  report: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentRun: { findMany: m.runFindMany, count: vi.fn() },
    adminAuditEvent: { count: m.auditCount },
    evalCase: { count: m.caseCount, findMany: m.caseFindMany },
    evalRun: { findFirst: m.evalFindFirst },
    evalCaseResult: { findMany: m.resultFindMany },
  },
}));
vi.mock("@/lib/control/review", () => ({ countReviewQueue: vi.fn() }));
vi.mock("@/lib/control/agreement", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/control/agreement")>()),
  getAgreementReport: m.report,
}));

import { gateAnswer, getGateStatuses } from "@/lib/control/overview";
import { RUBRIC_VERSION } from "@/lib/control/rubric";

const emptyReport = {
  items: 0, rawAgreement: 0, fleissKappa: null, prevalence: { PASS: 0, FAIL: 0, NEEDS_REVIEW: 0 }, confusion: [],
  medianSeconds: null, medianSecondsByLens: { TECHNICAL: null, DOMAIN: null, SALES: null }, rubricVersions: [],
};
const leads = (n: number, prefix = "l") => Array.from({ length: n }, (_, i) => ({ leadId: `${prefix}${i}` }));
const byKey = (gates: Awaited<ReturnType<typeof getGateStatuses>>) => Object.fromEntries(gates.map((g) => [g.key, g]));

beforeEach(() => {
  vi.clearAllMocks();
  m.runFindMany.mockResolvedValue([]);
  m.auditCount.mockResolvedValue(0);
  m.caseCount.mockResolvedValue(0);
  m.caseFindMany.mockResolvedValue([]);
  m.evalFindFirst.mockResolvedValue(null);
  m.resultFindMany.mockResolvedValue([]);
  m.report.mockResolvedValue(emptyReport);
});

describe("getGateStatuses", () => {
  it("lists the three gates with their targets", async () => {
    const gates = await getGateStatuses("ws_1");
    expect(gates.map((g) => g.key)).toEqual([
      "head_agent_briefs", "brief_reach_rate",
      "coded_traces", "triple_lens_briefs", "fleiss_kappa", "median_review_seconds", "reference_cases",
      "baseline_pass_rate", "red_flags", "candidate_regressions",
    ]);
    expect(gates.map((g) => g.group)).toEqual(["A", "A", "B", "B", "B", "B", "B", "C", "C", "C"]);
    for (const gate of gates) expect(gate.target).toBeTruthy();
  });

  it("marks everything without data as undecided rather than passed", async () => {
    const gates = byKey(await getGateStatuses("ws_1"));
    expect(gates.head_agent_briefs.met).toBe(false);
    expect(gates.brief_reach_rate.met).toBeNull();
    expect(gates.fleiss_kappa.met).toBeNull();
    expect(gates.median_review_seconds.met).toBeNull();
    expect(gates.baseline_pass_rate.met).toBeNull();
    expect(gates.red_flags.met).toBeNull();
    expect(gates.candidate_regressions.met).toBeNull();
  });

  it("scopes every query by workspace and measures agreement on the active rubric", async () => {
    await getGateStatuses("ws_1", new Date("2026-09-29T12:00:00Z"));
    for (const call of m.runFindMany.mock.calls) expect(call[0].where.workspaceId).toBe("ws_1");
    expect(m.runFindMany.mock.calls[0][0].where).toMatchObject({
      workerKind: "LEAD_INTELLIGENCE_BRIEF",
      outputJson: { path: ["briefMode"], equals: "head-agent" },
    });
    expect(m.auditCount).toHaveBeenCalledWith({ where: { workspaceId: "ws_1", action: "review.record" } });
    expect(m.caseCount).toHaveBeenCalledWith({ where: { workspaceId: "ws_1" } });
    expect(m.report).toHaveBeenCalledWith("ws_1", RUBRIC_VERSION);
  });

  it("decides the pipeline gate from head-agent leads and the reach interval", async () => {
    m.runFindMany
      .mockResolvedValueOnce(leads(45))
      .mockResolvedValueOnce(leads(60))
      .mockResolvedValueOnce(leads(54));
    const gates = byKey(await getGateStatuses("ws_1"));
    expect(gates.head_agent_briefs).toMatchObject({ value: "45", met: true });
    expect(gates.brief_reach_rate.value).toBe("%90 (54/60) · %80–%95");
    expect(gates.brief_reach_rate.met).toBe(true);
  });

  it("fails a low kappa early but needs fifty items to pass a high one", async () => {
    m.report.mockResolvedValueOnce({ ...emptyReport, items: 20, fleissKappa: 0.4 });
    expect(byKey(await getGateStatuses("ws_1")).fleiss_kappa.met).toBe(false);
    m.report.mockResolvedValueOnce({ ...emptyReport, items: 20, fleissKappa: 0.8 });
    expect(byKey(await getGateStatuses("ws_1")).fleiss_kappa.met).toBeNull();
    m.report.mockResolvedValueOnce({ ...emptyReport, items: 55, fleissKappa: 0.8, medianSeconds: 90 });
    const gates = byKey(await getGateStatuses("ws_1"));
    expect(gates.fleiss_kappa.met).toBe(true);
    expect(gates.triple_lens_briefs.met).toBe(true);
    expect(gates.median_review_seconds).toMatchObject({ value: "90 sn", met: true });
  });

  it("requires n ≥ 50 and a lower bound ≥ 69% for the baseline, and counts P0 stays and regressions", async () => {
    const baseline = { id: "base", summaryJson: { passed: 12, total: 20, failedCaseIds: ["c1", "c2"] }, finishedAt: new Date() };
    const candidate = { id: "cand", summaryJson: { passed: 1, total: 2 }, finishedAt: new Date() };
    m.evalFindFirst.mockImplementation(async ({ where }: { where: { label: string } }) => (where.label === "taban" ? baseline : candidate));
    m.caseFindMany.mockResolvedValue([{ id: "c1" }]);
    m.resultFindMany
      .mockResolvedValueOnce([{ evalCaseId: "c3", passed: true }, { evalCaseId: "c4", passed: true }])
      .mockResolvedValueOnce([{ evalCaseId: "c3", passed: false }, { evalCaseId: "c4", passed: true }]);
    const gates = byKey(await getGateStatuses("ws_1"));
    expect(gates.baseline_pass_rate.value).toBe("%60 (12/20) · %39–%78 · karar için yetersiz");
    expect(gates.baseline_pass_rate.met).toBeNull();
    expect(gates.red_flags).toMatchObject({ value: "1", met: false });
    expect(gates.candidate_regressions).toMatchObject({ value: "1", met: false });
    expect(m.caseFindMany).toHaveBeenCalledWith({ where: { workspaceId: "ws_1", severity: "P0" }, select: { id: true } });
    for (const call of m.resultFindMany.mock.calls) expect(call[0].where.workspaceId).toBe("ws_1");
  });

  it("passes the baseline at 45/50 and fails it at 40/50 on the lower bound", async () => {
    m.evalFindFirst.mockImplementation(async ({ where }: { where: { label: string } }) =>
      where.label === "taban" ? { id: "b", summaryJson: { passed: 45, total: 50, failedCaseIds: [] }, finishedAt: new Date() } : null);
    expect(byKey(await getGateStatuses("ws_1")).baseline_pass_rate.met).toBe(true);
    m.evalFindFirst.mockImplementation(async ({ where }: { where: { label: string } }) =>
      where.label === "taban" ? { id: "b", summaryJson: { passed: 40, total: 50, failedCaseIds: [] }, finishedAt: new Date() } : null);
    // 40/50 = 80% but the Wilson lower bound is 67% < 69%.
    expect(byKey(await getGateStatuses("ws_1")).baseline_pass_rate.met).toBe(false);
  });
});

describe("gateAnswer", () => {
  const gate = (met: boolean | null) => ({ key: "k", group: "A" as const, label: "l", value: "v", target: "t", met });
  it("answers yes only when every criterion is met", () => {
    expect(gateAnswer([gate(true), gate(true)])).toBe("FineDine'a verilebilir: üç kapının bütün ölçütleri geçti.");
  });
  it("names failures before missing data", () => {
    expect(gateAnswer([gate(false), gate(null), gate(true)])).toBe("FineDine'a henüz verilemez: 1 ölçüt eşiğin altında, 1 ölçüt için veri yetersiz.");
    expect(gateAnswer([gate(null), gate(true)])).toBe("FineDine'a henüz verilemez: 1 ölçüt için veri yetersiz.");
  });
});
