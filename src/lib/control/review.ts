import type { ReviewVerdict } from "@/generated/prisma/client";
import { writeAdminAudit } from "@/lib/control/audit";
import type { ControlRole } from "@/lib/control/roles";
import { ForbiddenError, NotFoundError } from "@/lib/auth";
import { resolveControlLens, roleAtLeast } from "@/lib/control/roles";
import { missingLenses } from "@/lib/control/lenses";
import { toDecisionCard } from "@/lib/control/decision";
import type { ReviewLens } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const ERROR_CLASSES = [
  "IDENTITY_MISMATCH",
  "STALE_SOURCE",
  "UNSUPPORTED_CLAIM",
  "PACKAGE_MISMATCH",
  "SCORE_CALIBRATION",
  "PLAYBOOK_VIOLATION",
  "PIPELINE_OMISSION",
] as const;

export type ErrorClass = (typeof ERROR_CLASSES)[number];
export type ReviewSeverity = "P0" | "P1" | "P2";

const SEVERITIES = new Set<ReviewSeverity>(["P0", "P1", "P2"]);
const FORTNIGHT_MS = 14 * 24 * 60 * 60 * 1000;
export type ReviewQueueRow = {
 leadId: string; businessName: string; agentRunId: string; age: string;
 salesConfidence: number | null; primaryModule: string | null; missingLenses: ReviewLens[];
};
export async function listRecentBriefs(workspaceId: string, now = new Date()): Promise<ReviewQueueRow[]> {
 const runs = await prisma.agentRun.findMany({
   where: { workspaceId, workerKind: "LEAD_INTELLIGENCE_BRIEF", status: "SUCCEEDED", leadId: { not: null }, finishedAt: { gte: new Date(now.getTime() - FORTNIGHT_MS) } },
   orderBy: [{ finishedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
   distinct: ["leadId"],
   select: { id: true, leadId: true, outputJson: true, finishedAt: true, lead: { select: { businessName: true } } },
 });
 if (!runs.length) return [];
 const reviews = await prisma.humanReview.findMany({ where: { workspaceId, agentRunId: { in: runs.map(r => r.id) } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { agentRunId: true, lens: true, createdAt: true } });
 return runs.flatMap(run => {
   const missing = missingLenses(reviews.filter(r => r.agentRunId === run.id));
   if (!run.leadId) return [];
   const card = toDecisionCard(run.outputJson);
   return [{ leadId: run.leadId, agentRunId: run.id, businessName: run.lead?.businessName ?? "İsimsiz işletme", age: run.finishedAt!.toISOString(), salesConfidence: card.salesConfidence, primaryModule: card.primaryModule, missingLenses: missing }];
 });
}

export async function listLeadReviews(workspaceId: string, leadId: string, agentRunId?: string) {
  return prisma.humanReview.findMany({
    where: { workspaceId, leadId, ...(agentRunId ? { agentRunId } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],

    select: {
      id: true,
      lens: true,
      verdict: true,
      errorClass: true,
      severity: true,
      note: true,
      createdAt: true,
      agentRunId: true,
    },
  });
}

export async function countReviewQueue(workspaceId: string, now = new Date()): Promise<number> {
  const rows = await listReviewQueue(workspaceId, now);
  return rows.length;
}

export async function recordReview(input: {
  workspaceId: string;
  leadId: string;
  agentRunId: string | null;
  verdict: "PASS" | "FAIL" | "NEEDS_REVIEW";
  errorClass: ErrorClass | null;
  severity: ReviewSeverity | null;
  note: string;
  reviewerUserId: string;
  actorRole: ControlRole;
  lens?: ReviewLens | null;
}): Promise<{ id: string }> {
  const note = input.note.trim();
  const failing = input.verdict === "FAIL";
  if (failing && (!input.errorClass || !ERROR_CLASSES.includes(input.errorClass) || !input.severity || !SEVERITIES.has(input.severity) || !note)) {
    throw new Error("fail requires class, severity, and note");
  }

  const lens = await resolveControlLens(input.reviewerUserId);
  if (!roleAtLeast(input.actorRole, "REVIEWER") || !lens || (input.lens != null && input.lens !== lens)) throw new ForbiddenError("Yalnızca kendi merceğin için hüküm yazabilirsin. Sana bir mercek atanmadıysa yöneticiye başvur.");
  const run = input.agentRunId ? await prisma.agentRun.findFirst({ where: { id: input.agentRunId, workspaceId: input.workspaceId, leadId: input.leadId, workerKind: "LEAD_INTELLIGENCE_BRIEF", status: "SUCCEEDED" }, select: { id: true } }) : null;
  if (!run) throw new NotFoundError("Başarılı brief bu çalışma alanında bulunamadı.");

  const verdict = input.verdict as ReviewVerdict;
  return prisma.$transaction(async tx => {
  const created = await tx.humanReview.create({
    data: {
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      agentRunId: input.agentRunId,
      verdict,
      lens,
      errorClass: failing ? input.errorClass : null,
      severity: failing ? input.severity : null,
      note: note || null,
      reviewerUserId: input.reviewerUserId,
    },
    select: { id: true },
  });

  await writeAdminAudit({
    actorUserId: input.reviewerUserId,
    actorRole: input.actorRole,
    workspaceId: input.workspaceId,
    action: "review.record",
    targetType: "Lead",
    targetId: input.leadId,
    reason: note || verdict,
    beforeJson: null,
    afterJson: { lens, verdict, reviewId: created.id, agentRunId: input.agentRunId },
    outcome: "SUCCEEDED",
  }, tx);

  return { id: created.id };
  });
}

export async function listReviewQueue(workspaceId: string, now = new Date()) { return (await listRecentBriefs(workspaceId, now)).filter(row => row.missingLenses.length > 0); }
