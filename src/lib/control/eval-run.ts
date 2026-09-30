import { Prisma } from "@/generated/prisma/client";
import { writeAdminAudit } from "@/lib/control/audit";
import type { ControlRole } from "@/lib/control/roles";
import { parseExpected, scoreOutput } from "@/lib/control/score";
import { object } from "@/lib/control/decision";
import { ForbiddenError } from "@/lib/auth";
import { getAgentRunsQueue } from "@/lib/queues";
import { prisma } from "@/lib/prisma";

export async function startEvalRun(input: {
  workspaceId: string;
  datasetId: string;
  label: string;
  actorUserId: string;
  actorRole: ControlRole;
}): Promise<{ id: string; passed: number; total: number }> {
  if (input.actorRole === "VIEWER") throw new ForbiddenError("İnceleyen yetkisi gerekir.");
  const cases = await prisma.evalCase.findMany({
    where: { workspaceId: input.workspaceId, datasetId: input.datasetId },
    select: { id: true, expectedJson: true, outputSnapshot: true },
  });

  const scored = cases.map((evalCase) => {
    const result = scoreOutput(evalCase.outputSnapshot, parseExpected(evalCase.expectedJson));
    return { evalCaseId: evalCase.id, ...result, outputJson: evalCase.outputSnapshot };
  });
  const failedCaseIds = scored.filter((item) => !item.passed).map((item) => item.evalCaseId);
  const summary = { passed: scored.length - failedCaseIds.length, total: scored.length, failedCaseIds };

  return prisma.$transaction(async tx => {
  const run = await tx.evalRun.create({
    data: {
      workspaceId: input.workspaceId,
      datasetId: input.datasetId,
      label: "taban",
      status: "SUCCEEDED",
      createdByUserId: input.actorUserId,
      summaryJson: summary,
      finishedAt: new Date(),
    },
    select: { id: true },
  });

  if (scored.length > 0) {
    await tx.evalCaseResult.createMany({
      data: scored.map((item) => ({
        workspaceId: input.workspaceId,
        evalRunId: run.id,
        evalCaseId: item.evalCaseId,
        passed: item.passed,
        failures: item.failures as Prisma.InputJsonValue,
        outputJson: item.outputJson as Prisma.InputJsonValue,
      })),
    });
  }

  await writeAdminAudit({
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    workspaceId: input.workspaceId,
    action: "eval.run",
    targetType: "EvalRun",
    targetId: run.id,
    reason: input.label.trim() || "Kontrol koşusu",
    beforeJson: null,
    afterJson: summary,
    outcome: "SUCCEEDED",
  }, tx);

  return { id: run.id, passed: summary.passed, total: summary.total };
  });
}

export async function acceptEvalRun(input: {
  workspaceId: string;
  evalRunId: string;
  actorUserId: string;
  actorRole: ControlRole;
  reason: string;
}): Promise<{ id: string }> {
  const reason = input.reason.trim();
  if (!reason) throw new Error("reason required");
  const run = await prisma.evalRun.findFirst({
    where: { id: input.evalRunId, workspaceId: input.workspaceId, status: "SUCCEEDED" },
    select: { id: true },
  });
  if (!run) throw new Error("eval run not found");
  await writeAdminAudit({
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    workspaceId: input.workspaceId,
    action: "eval.accept",
    targetType: "EvalRun",
    targetId: run.id,
    reason,
    beforeJson: null,
    afterJson: { accepted: true },
    outcome: "SUCCEEDED",
  });
  return { id: run.id };
}

export type ComparedCase = {
  evalCaseId: string;
  businessName: string;
  failureLabel: string;
  baseOutput: unknown;
  candidateOutput: unknown;
  context?: { finishedAt: string | null; locationCount: number };
};

export async function listSucceededEvalRuns(workspaceId: string) {
  return prisma.evalRun.findMany({
    where: { workspaceId, status: "SUCCEEDED" },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, label: true, createdAt: true, finishedAt: true, summaryJson: true },
  });
}

export async function loadEvalComparison(workspaceId: string, baseId: string, candidateId: string) {
  const runs = await prisma.evalRun.findMany({ where: { workspaceId, id: { in: [baseId, candidateId] }, status: "SUCCEEDED" }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true } });
  if (runs.length !== 2) throw new Error("İki başarılı koşu seç.");
  [baseId, candidateId] = runs.map(r => r.id);

  const [baseResults, candidateResults, cases] = await Promise.all([
    prisma.evalCaseResult.findMany({ where: { workspaceId, evalRunId: baseId } }),
    prisma.evalCaseResult.findMany({ where: { workspaceId, evalRunId: candidateId } }),
    prisma.evalCase.findMany({
      where: { workspaceId },
      select: { id: true, title: true, inputSnapshot: true, sourceRunId: true },
    }),
  ]);
  const sourceIds = cases.flatMap(c => c.sourceRunId ? [c.sourceRunId] : []);
  const sources = sourceIds.length ? await prisma.agentRun.findMany({ where: { workspaceId, id: { in: sourceIds } }, select: { id: true, finishedAt: true } }) : [];
  const times = new Map(sources.map(r => [r.id, r.finishedAt?.toISOString() ?? null]));
  const metadata = new Map(cases.map(evalCase => {
    const snapshot = object(evalCase.inputSnapshot);
    return [evalCase.id, {
      businessName: typeof snapshot.businessName === "string" ? snapshot.businessName : evalCase.title,
      context: { finishedAt: evalCase.sourceRunId ? times.get(evalCase.sourceRunId) ?? null : null, locationCount: typeof snapshot.locationCount === "number" ? snapshot.locationCount : 1 },
    }];
  }));
  return { ...partitionEvalComparison(
    baseResults.map((row) => ({
      evalCaseId: row.evalCaseId,
      passed: row.passed,
      failures: row.failures,
      outputJson: row.outputJson,
      businessName: metadata.get(row.evalCaseId)?.businessName ?? "Vaka",
      context: metadata.get(row.evalCaseId)?.context,
    })),
    candidateResults.map((row) => ({
      evalCaseId: row.evalCaseId,
      passed: row.passed,
      failures: row.failures,
      outputJson: row.outputJson,
    })),
  ), baseId, candidateId };
}

export function partitionEvalComparison(
  base: Array<{ evalCaseId: string; passed: boolean; failures: unknown; outputJson: unknown; businessName: string; context?: ComparedCase["context"] }>,
  candidate: Array<{ evalCaseId: string; passed: boolean; failures: unknown; outputJson: unknown }>,
): { broken: ComparedCase[]; fixed: ComparedCase[]; same: ComparedCase[] } {
  const candidateById = new Map(candidate.map((item) => [item.evalCaseId, item]));
  const broken: ComparedCase[] = [];
  const fixed: ComparedCase[] = [];
  const same: ComparedCase[] = [];
  for (const item of base) {
    const next = candidateById.get(item.evalCaseId);
    if (!next) continue;
    const row: ComparedCase = {
      evalCaseId: item.evalCaseId,
      businessName: item.businessName,
      failureLabel: failureLabel(next.passed ? item.failures : next.failures),
      baseOutput: item.outputJson,
      candidateOutput: next.outputJson,
      context: item.context,
    };
    if (item.passed && !next.passed) broken.push(row);
    else if (!item.passed && next.passed) fixed.push(row);
    else same.push(row);
  }
  return { broken, fixed, same };
}

function failureLabel(failures: unknown): string {
  const code = Array.isArray(failures) && failures[0] && typeof failures[0] === "object" && failures[0] !== null && "code" in failures[0]
    ? String((failures[0] as { code: unknown }).code)
    : "";
  if (code === "ICP_BAND") return "Puan bandın dışında";
  if (code === "FORBIDDEN_CLAIM") return "Yasak iddia";
  if (code === "FORBIDDEN_ANGLE") return "Yasak açı";
  if (code === "HEAD_AGENT_UNAVAILABLE") return "Head agent kullanılamıyor";
  if (code === "REPLAY_FAILED") return "Yeni karar üretilemedi";
  if (code === "MODULE") return "Modül";
  return "";
}

export class CandidateConflictError extends Error {
 constructor(message = "Bu alanda bir aday koşu zaten sürüyor.") { super(message); }
}
/** Serialize workspace admissions in Postgres, including simultaneous API requests. */
export async function startCandidateRun(input: { workspaceId: string; datasetId: string; actorUserId: string; actorRole: ControlRole; confirmedCaseCount: number }) {
 if (input.actorRole !== "ADMIN") throw new ForbiddenError("Aday koşuyu yalnızca Yönetici başlatır.");
 const run = await prisma.$transaction(async tx => {
   await tx.$queryRaw`SELECT id FROM workspaces WHERE id = ${input.workspaceId} FOR UPDATE`;
   const active = await tx.evalRun.findFirst({ where: { workspaceId: input.workspaceId, label: "aday", status: { in: ["PENDING", "RUNNING"] } }, select: { id: true } });
   if (active) throw new CandidateConflictError();
   const cases = await tx.evalCase.findMany({ where: { workspaceId: input.workspaceId, datasetId: input.datasetId }, select: { id: true } });
   if (!cases.length || cases.length !== input.confirmedCaseCount) throw new CandidateConflictError("Vaka sayısı değişti veya boş. Sayfayı yenileyip yeniden onayla.");
   const created = await tx.evalRun.create({ data: { workspaceId: input.workspaceId, datasetId: input.datasetId, label: "aday", status: "PENDING", createdByUserId: input.actorUserId, summaryJson: { caseIds: cases.map(c => c.id) } }, select: { id: true } });
   await writeAdminAudit({ ...input, action: "eval.replay", targetType: "EvalRun", targetId: created.id, reason: `${cases.length} vaka; donmuş girdiden karar üret, lead'e yazma`, beforeJson: null, afterJson: { status: "PENDING", total: cases.length }, outcome: "SUCCEEDED" }, tx);
   return created;
 });
 try {
   await getAgentRunsQueue().add("control_eval_replay", { type: "control_eval_replay", evalRunId: run.id, workspaceId: input.workspaceId }, { jobId: `control-eval-${run.id}`, attempts: 3, backoff: { type: "exponential", delay: 5000 }, removeOnComplete: 500, removeOnFail: 500 });
 } catch (error) {
   await failCandidateRun(input.workspaceId, run.id, "Kuyruğa eklenemedi.");
   throw error;
 }
 return run;
}
export async function failCandidateRun(workspaceId: string, evalRunId: string, reason: string) {
 await prisma.$transaction(async tx => {
   const run = await tx.evalRun.findFirst({ where: { workspaceId, id: evalRunId, label: "aday", status: { in: ["PENDING", "RUNNING"] } } });
   if (!run) return;
   await tx.evalRun.updateMany({ where: { workspaceId, id: evalRunId }, data: { status: "FAILED", finishedAt: new Date() } });
   await writeAdminAudit({ workspaceId, actorUserId: run.createdByUserId, actorRole: "ADMIN", action: "eval.replay", targetType: "EvalRun", targetId: run.id, reason, beforeJson: { status: run.status }, afterJson: { status: "FAILED" }, outcome: "FAILED" }, tx);
 });
}
