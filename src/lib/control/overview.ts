import type { Prisma } from "@/generated/prisma/client";
import { KAPPA_TARGET, REVIEW_SECONDS_TARGET, getAgreementReport } from "@/lib/control/agreement";
import { countReviewQueue } from "@/lib/control/review";
import { RUBRIC_VERSION } from "@/lib/control/rubric";
import { MIN_DECIDABLE_N, formatRate, wilson } from "@/lib/control/stats";
import { prisma } from "@/lib/prisma";

export type ControlOverview = {
  completed24h: number;
  failed24h: number;
  stuckSessions: number;
  openReviews: number;
  lastCandidate: { passed: number; total: number; finishedAt: string } | null;
  lastEval: { passed: number; total: number; finishedAt: string } | null;
};

function extractLastEval(row: { summaryJson: unknown; finishedAt: Date | null } | null): ControlOverview["lastEval"] {
  if (!row?.finishedAt) return null;
  const summary = row.summaryJson;
  if (typeof summary !== "object" || summary === null) return null;
  if (!("passed" in summary) || !("total" in summary)) return null;
  const passed = summary.passed;
  const total = summary.total;
  if (typeof passed !== "number" || typeof total !== "number" || !Number.isFinite(passed) || !Number.isFinite(total)) {
    return null;
  }
  return { passed, total, finishedAt: row.finishedAt.toISOString() };
}

export async function getControlOverview(workspaceId: string, now = new Date()): Promise<ControlOverview> {
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const before30m = new Date(now.getTime() - 30 * 60 * 1000);

  const [completed24h, failed24h, stuckSessions, openReviews, latestEval, latestCandidate] = await Promise.all([
    prisma.agentRun.count({
      where: {
        workspaceId,
        workerKind: "LEAD_INTELLIGENCE_BRIEF",
        // Only a head-agent brief counts as a finished analysis; skipped briefs carry no briefMode.
        outputJson: { path: ["briefMode"], equals: "head-agent" },
        status: { in: ["SUCCEEDED", "SUCCEEDED_NO_MEMORY"] },
        finishedAt: { gte: since24h },
      },
    }),
    prisma.agentRun.count({
      where: { workspaceId, status: "FAILED", finishedAt: { gte: since24h } },
    }),
    prisma.plannerSession.count({
      where: { workspaceId, status: { in: ["PLANNING", "EXECUTING"] }, updatedAt: { lt: before30m } },
    }),
    countReviewQueue(workspaceId, now),
    prisma.evalRun.findFirst({
      where: { workspaceId, status: "SUCCEEDED", label: "taban" },
      orderBy: { createdAt: "desc" },
      select: { summaryJson: true, finishedAt: true },
    }),
    prisma.evalRun.findFirst({ where: { workspaceId, status: "SUCCEEDED", label: "aday" }, orderBy: { createdAt: "desc" }, select: { summaryJson: true, finishedAt: true } }),
  ]);

  return {
    completed24h,
    failed24h,
    stuckSessions,
    openReviews,
    lastEval: extractLastEval(latestEval),
    lastCandidate: extractLastEval(latestCandidate),
  };
}

// ---------------------------------------------------------------------------
// Quality gates (karar kağıdı §10). The single answer to "can we give it to FineDine?".
// ---------------------------------------------------------------------------

export type GateGroup = "A" | "B" | "C";
/** `met: null` means "yetersiz veri": the number exists but cannot decide the gate yet. */
export type GateStatus = { key: string; group: GateGroup; label: string; value: string; target: string; met: boolean | null };

const HEAD_AGENT_BRIEF = {
  workerKind: "LEAD_INTELLIGENCE_BRIEF",
  outputJson: { path: ["briefMode"], equals: "head-agent" },
  status: { in: ["SUCCEEDED", "SUCCEEDED_NO_MEMORY"] },
} satisfies Prisma.AgentRunWhereInput;
const REACH_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function failedCaseIds(summary: unknown): string[] {
  if (typeof summary !== "object" || summary === null || !("failedCaseIds" in summary)) return [];
  const ids = (summary as { failedCaseIds: unknown }).failedCaseIds;
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
}

function countGate(key: string, group: GateGroup, label: string, value: number, min: number): GateStatus {
  return { key, group, label, value: String(value), target: `≥ ${min}`, met: value >= min };
}

export async function getGateStatuses(workspaceId: string, now = new Date()): Promise<GateStatus[]> {
  const reachSince = new Date(now.getTime() - REACH_WINDOW_MS);
  const [briefLeads, enteredLeads, reachedLeads, codedTraces, referenceCases, report, baseline, candidate, p0Cases] = await Promise.all([
    prisma.agentRun.findMany({
      where: { workspaceId, ...HEAD_AGENT_BRIEF, leadId: { not: null } },
      distinct: ["leadId"],
      select: { leadId: true },
    }),
    prisma.agentRun.findMany({
      where: { workspaceId, leadId: { not: null }, createdAt: { gte: reachSince } },
      distinct: ["leadId"],
      select: { leadId: true },
    }),
    prisma.agentRun.findMany({
      where: { workspaceId, ...HEAD_AGENT_BRIEF, leadId: { not: null }, createdAt: { gte: reachSince } },
      distinct: ["leadId"],
      select: { leadId: true },
    }),
    prisma.adminAuditEvent.count({ where: { workspaceId, action: "review.record" } }),
    prisma.evalCase.count({ where: { workspaceId } }),
    getAgreementReport(workspaceId, RUBRIC_VERSION),
    prisma.evalRun.findFirst({
      where: { workspaceId, status: "SUCCEEDED", label: "taban" },
      orderBy: { createdAt: "desc" },
      select: { id: true, summaryJson: true, finishedAt: true },
    }),
    prisma.evalRun.findFirst({
      where: { workspaceId, status: "SUCCEEDED", label: "aday" },
      orderBy: { createdAt: "desc" },
      select: { id: true, summaryJson: true, finishedAt: true },
    }),
    prisma.evalCase.findMany({ where: { workspaceId, severity: "P0" }, select: { id: true } }),
  ]);

  // Gate A — pipeline. Reach = leads that entered the pipeline in 30 days and got a head-agent brief.
  const entered = new Set(enteredLeads.map((row) => row.leadId));
  const reached = reachedLeads.filter((row) => entered.has(row.leadId)).length;
  const reach = wilson(reached, entered.size);

  // Gate B — measurement, on the active rubric version only. A low kappa already fails; a high one needs n.
  const kappa = report.fleissKappa;
  const kappaMet = kappa === null ? null : kappa < KAPPA_TARGET ? false : report.items >= MIN_DECIDABLE_N ? true : null;

  // Gate C — delivery.
  const baseEval = extractLastEval(baseline);
  const baseInterval = baseEval ? wilson(baseEval.passed, baseEval.total) : null;
  const baseMet = !baseInterval || !baseInterval.decidable ? null : baseInterval.p >= 0.8 && baseInterval.low >= 0.69;

  const p0Ids = new Set(p0Cases.map((row) => row.id));
  const redFlags = baseline ? failedCaseIds(baseline.summaryJson).filter((id) => p0Ids.has(id)).length : null;

  let regressions: number | null = null;
  if (baseline && candidate) {
    const [baseRows, candidateRows] = await Promise.all([
      prisma.evalCaseResult.findMany({ where: { workspaceId, evalRunId: baseline.id }, select: { evalCaseId: true, passed: true } }),
      prisma.evalCaseResult.findMany({ where: { workspaceId, evalRunId: candidate.id }, select: { evalCaseId: true, passed: true } }),
    ]);
    const basePassed = new Set(baseRows.filter((row) => row.passed).map((row) => row.evalCaseId));
    regressions = candidateRows.filter((row) => !row.passed && basePassed.has(row.evalCaseId)).length;
  }

  return [
    countGate("head_agent_briefs", "A", "Head agent kararına ulaşan lead", briefLeads.length, 40),
    {
      key: "brief_reach_rate",
      group: "A",
      label: "Brief'e ulaşan lead oranı (30 gün)",
      value: formatRate(reached, entered.size),
      target: "≥ %80",
      met: reach.decidable ? reach.p >= 0.8 : null,
    },
    countGate("coded_traces", "B", "Elle kodlanmış iz", codedTraces, 30),
    countGate("triple_lens_briefs", "B", "Üç merceği tamamlanmış brief", report.items, 50),
    {
      key: "fleiss_kappa",
      group: "B",
      label: "Mercekler arası uyum (Fleiss kappa)",
      value: kappa === null ? `Ölçüm için yeterli vaka yok (${report.items})` : `${kappa.toFixed(2)} (${report.items} vaka)`,
      target: `≥ ${KAPPA_TARGET.toFixed(2)}`,
      met: kappaMet,
    },
    {
      key: "median_review_seconds",
      group: "B",
      label: "Medyan inceleme süresi",
      value: report.medianSeconds === null ? "Süre ölçülmedi" : `${Math.round(report.medianSeconds)} sn`,
      target: `≤ ${REVIEW_SECONDS_TARGET} sn`,
      met: report.medianSeconds === null ? null : report.medianSeconds <= REVIEW_SECONDS_TARGET,
    },
    countGate("reference_cases", "B", "Referans vaka", referenceCases, 30),
    {
      key: "baseline_pass_rate",
      group: "C",
      label: "Taban geçiş oranı",
      value: baseEval ? formatRate(baseEval.passed, baseEval.total) : "Henüz taban koşusu yok",
      target: "≥ %80, n ≥ 50, alt sınır ≥ %69",
      met: baseMet,
    },
    {
      key: "red_flags",
      group: "C",
      label: "Kırmızı bayrak (P0 kalış)",
      value: redFlags === null ? "Henüz taban koşusu yok" : String(redFlags),
      target: "0",
      met: redFlags === null ? null : redFlags === 0,
    },
    {
      key: "candidate_regressions",
      group: "C",
      label: "Aday koşuda bozulan vaka",
      value: regressions === null ? "Henüz aday koşu yok" : String(regressions),
      target: "0",
      met: regressions === null ? null : regressions === 0,
    },
  ];
}

/** The one-line answer to "can we give it to FineDine?". */
export function gateAnswer(gates: GateStatus[]): string {
  const failed = gates.filter((gate) => gate.met === false).length;
  const unknown = gates.filter((gate) => gate.met === null).length;
  if (failed === 0 && unknown === 0) return "FineDine'a verilebilir: üç kapının bütün ölçütleri geçti.";
  if (failed > 0) return `FineDine'a henüz verilemez: ${failed} ölçüt eşiğin altında${unknown ? `, ${unknown} ölçüt için veri yetersiz` : ""}.`;
  return `FineDine'a henüz verilemez: ${unknown} ölçüt için veri yetersiz.`;
}
