import { Prisma } from "@/generated/prisma/client";
import { writeAdminAudit } from "@/lib/control/audit";
import type { ControlRole } from "@/lib/control/roles";
import { parseExpected, type ExpectedRules } from "@/lib/control/score";
import { ForbiddenError, NotFoundError } from "@/lib/auth";
import { resolveControlLens, roleAtLeast } from "@/lib/control/roles";
import { currentLensReviews, missingLenses, LENS_LABELS } from "@/lib/control/lenses";
import { object } from "@/lib/control/decision";
import { prisma } from "@/lib/prisma";

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function promoteReviewToCase(input: {
  workspaceId: string;
  reviewId: string;
  datasetId?: string;
  title: string;
  expected: unknown;

  actorUserId: string;
  actorRole: ControlRole;
}): Promise<{ id: string }> {
  if (!roleAtLeast(input.actorRole, "REVIEWER") || !await resolveControlLens(input.actorUserId)) throw new ForbiddenError("Sana bir mercek atanmadı.");
  const expected = parseExpected(input.expected);
  const title = input.title.trim();
  if (!title) throw new Error("title required");

  return prisma.$transaction(async tx => {
  const review = await tx.humanReview.findFirst({
    where: { id: input.reviewId, workspaceId: input.workspaceId },
    select: { id: true, leadId: true, agentRunId: true },
  });
  if (!review?.agentRunId) throw new NotFoundError("Review not found");

  const reviews = await tx.humanReview.findMany({ where: { workspaceId: input.workspaceId, agentRunId: review.agentRunId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
  const missing = missingLenses(reviews);
  if (missing.length) throw new Error(`Eksik mercekler: ${missing.map(l => LENS_LABELS[l]).join(", ")}`);
  const current = currentLensReviews(reviews);
  const severity = ["P0", "P1", "P2"].find(s => current.some(r => r.verdict === "FAIL" && r.severity === s)) ?? "P2";
  let dataset = await tx.evalDataset.findFirst({
    where: { ...(input.datasetId ? { id: input.datasetId } : { name: "Referans" }), workspaceId: input.workspaceId },
    select: { id: true },
  });
  if (!dataset && input.datasetId) throw new NotFoundError("Dataset not found");
  if (!dataset) {
    dataset = await tx.evalDataset.upsert({ where: { workspaceId_name: { workspaceId: input.workspaceId, name: "Referans" } }, create: { workspaceId: input.workspaceId, name: "Referans" }, update: {}, select: { id: true } });
    await writeAdminAudit({ workspaceId: input.workspaceId, actorUserId: input.actorUserId, actorRole: input.actorRole, action: "golden.dataset", targetType: "EvalDataset", targetId: dataset.id, reason: "Referans veri kümesi hazırlandı.", beforeJson: null, afterJson: { name: "Referans" }, outcome: "SUCCEEDED" }, tx);
  }

  const run = await tx.agentRun.findFirst({
    where: { id: review.agentRunId, workspaceId: input.workspaceId, leadId: review.leadId, workerKind: "LEAD_INTELLIGENCE_BRIEF", status: "SUCCEEDED" },
    select: { id: true, outputJson: true, leadId: true },
  });
  if (!run) throw new NotFoundError("Run not found");

  if (!run.leadId) throw new NotFoundError("Lead not found");
  const inputSnapshot = await buildInputSnapshot(input.workspaceId, run.leadId, run.outputJson, tx);
  const created = await tx.evalCase.create({
    data: {
      workspaceId: input.workspaceId,
      datasetId: dataset.id,
      sourceLeadId: review.leadId,
      sourceRunId: run.id,
      title,
      inputSnapshot: toJson(inputSnapshot),
      outputSnapshot: toJson(run.outputJson ?? {}),
      expectedJson: toJson(expected satisfies ExpectedRules),
      severity,
      approvedByUserId: input.actorUserId,
    },
    select: { id: true },
  });

  await writeAdminAudit({
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    workspaceId: input.workspaceId,
    action: "golden.promote",
    targetType: "EvalCase",
    targetId: created.id,
    reason: title,
    beforeJson: null,
    afterJson: { reviewId: review.id, datasetId: dataset.id },
    outcome: "SUCCEEDED",
  }, tx);

  return { id: created.id };
  });
}

export async function listGoldenCases(workspaceId: string) {
  const cases = await prisma.evalCase.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      title: true,
      segment: true,
      country: true,
      severity: true,
      sourceLeadId: true,
      approvedByUserId: true,
      expectedJson: true,
      outputSnapshot: true,
      createdAt: true,
    },
  });
  const leadIds = cases.map((evalCase) => evalCase.sourceLeadId).filter((id): id is string => Boolean(id));
  const leads = leadIds.length
    ? await prisma.lead.findMany({
        where: { workspaceId, id: { in: leadIds } },
        select: { id: true, businessName: true },
      })
    : [];
  const names = new Map(leads.map((lead) => [lead.id, lead.businessName]));
  return cases.map((evalCase) => ({
    ...evalCase,
    businessName: evalCase.sourceLeadId ? names.get(evalCase.sourceLeadId) ?? "" : "",
  }));
}

/** Explicit field allowlist: frozen business input, never caller-supplied data. */
export async function buildInputSnapshot(workspaceId: string, leadId: string, output: unknown, db: Prisma.TransactionClient = prisma) {
 const lead = await db.lead.findFirst({ where: { workspaceId, id: leadId }, select: { businessName: true, formattedAddress: true, rating: true, reviewCount: true, priceLevel: true, accountId: true } });
 if (!lead) throw new NotFoundError("Lead not found");
 const [audit, reviewAnalysis, locationCount] = await Promise.all([
   db.websiteAudit.findFirst({ where: { leadId, lead: { workspaceId } }, select: { url: true, reachable: true, hasBookingSystem: true, crawlError: true } }),
   db.reviewAnalysis.findFirst({ where: { leadId, lead: { workspaceId } }, select: { painPhrases: true, weaknessKpis: true, strengthPhrases: true } }),
   lead.accountId ? db.lead.count({ where: { workspaceId, accountId: lead.accountId } }) : Promise.resolve(1),
 ]);
 const brief = object(output), head = object(brief.headAgent);
 return { businessName: lead.businessName, address: lead.formattedAddress, rating: lead.rating, reviewCount: lead.reviewCount, priceLevel: lead.priceLevel, locationCount, audit, reviewAnalysis,
   briefContext: { headline: brief.headline ?? null, talkingPoints: brief.talkingPoints ?? [], confirmedPainPoints: brief.confirmedPainPoints ?? [], salesConfidence: brief.salesConfidence ?? null },
   excludedModules: head.excludedModules ?? [], evidenceRefs: head.evidenceRefs ?? [] };
}
