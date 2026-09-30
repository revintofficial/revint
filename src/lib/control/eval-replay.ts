import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAdminAudit } from "@/lib/control/audit";
import { object } from "@/lib/control/decision";
import { parseExpected, scoreOutput } from "@/lib/control/score";
import { getHeadAgentMode } from "@/lib/feature-flags";
import { isAnthropicConfigured } from "@/lib/ai-core/agent/claude";
import { isFnbNiche, replayHeadAgentDecision } from "@/lib/ai-core/agent/head-agent";

/** Called only by the existing agent-runs worker. Completed cases are retry checkpoints. */
export async function executeEvalReplay(workspaceId: string, evalRunId: string) {
 const run = await prisma.evalRun.findFirst({ where: { workspaceId, id: evalRunId, label: "aday", status: { in: ["PENDING", "RUNNING"] } } });
 if (!run) return;
 const audit = { workspaceId: run.workspaceId, actorUserId: run.createdByUserId, actorRole: "ADMIN" as const, action: "eval.replay", targetType: "EvalRun", targetId: run.id };
 await prisma.$transaction(async tx => {
   await tx.evalRun.updateMany({ where: { workspaceId: run.workspaceId, id: run.id }, data: { status: "RUNNING" } });
   await writeAdminAudit({ ...audit, reason: "Aday koşu başladı.", beforeJson: { status: run.status }, afterJson: { status: "RUNNING" }, outcome: "SUCCEEDED" }, tx);
 });
 const caseIds = object(run.summaryJson).caseIds;
 if (!Array.isArray(caseIds) || !caseIds.every(id => typeof id === "string")) throw new Error("Frozen case membership missing");
 const [workspace, cases, completed] = await Promise.all([
   prisma.workspace.findFirst({ where: { id: run.workspaceId }, select: { niche: true } }),
   prisma.evalCase.findMany({ where: { workspaceId: run.workspaceId, datasetId: run.datasetId, id: { in: caseIds } } }),
   prisma.evalCaseResult.findMany({ where: { workspaceId: run.workspaceId, evalRunId: run.id }, select: { evalCaseId: true } }),
 ]);
 const done = new Set(completed.map(r => r.evalCaseId));
 const available = workspace && isFnbNiche(workspace.niche) && getHeadAgentMode({ workspaceId: run.workspaceId }) !== "off" && isAnthropicConfigured();
 for (const evalCase of cases) {
   if (done.has(evalCase.id)) continue;
   let output: unknown = {};
   let failures: Array<{ code: string; detail: string }> = [];
   try {
     if (!available) failures = [{ code: "HEAD_AGENT_UNAVAILABLE", detail: "Head agent kapalı veya çalışma alanı F&B değil." }];
     else {
       output = await replayHeadAgentDecision(evalCase.inputSnapshot);
       failures = scoreOutput(output, parseExpected(evalCase.expectedJson)).failures;
     }
   } catch { failures = [{ code: "REPLAY_FAILED", detail: "Bu vaka için yeni karar üretilemedi." }]; }
   await prisma.$transaction(async tx => {
     await tx.evalCaseResult.create({ data: { workspaceId: run.workspaceId, evalRunId: run.id, evalCaseId: evalCase.id, outputJson: output as Prisma.InputJsonValue, failures: failures as Prisma.InputJsonValue, passed: failures.length === 0 } });
     await writeAdminAudit({ ...audit, reason: "Vaka sayıldı; lead ve kaynak brief değişmedi.", beforeJson: null, afterJson: { evalCaseId: evalCase.id, passed: failures.length === 0 }, outcome: "SUCCEEDED" }, tx);
   });
 }
 const results = await prisma.evalCaseResult.findMany({ where: { workspaceId: run.workspaceId, evalRunId: run.id }, select: { evalCaseId: true, passed: true } });
 const failedCaseIds = results.filter(r => !r.passed).map(r => r.evalCaseId);
 const summary = { passed: results.length - failedCaseIds.length, total: results.length, failedCaseIds };
 await prisma.$transaction(async tx => {
   await tx.evalRun.updateMany({ where: { workspaceId: run.workspaceId, id: run.id }, data: { status: "SUCCEEDED", finishedAt: new Date(), summaryJson: summary } });
   await writeAdminAudit({ ...audit, reason: "Aday koşu tamamlandı.", beforeJson: { status: "RUNNING" }, afterJson: { status: "SUCCEEDED", ...summary }, outcome: "SUCCEEDED" }, tx);
 });
 return summary;
}
