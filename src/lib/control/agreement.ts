import type { ReviewLens, ReviewVerdict } from "@/generated/prisma/client";
import { ForbiddenError, NotFoundError } from "@/lib/auth";
import { writeAdminAudit } from "@/lib/control/audit";
import { LENSES, currentLensReviews } from "@/lib/control/lenses";
import { RUBRIC_VERSION } from "@/lib/control/rubric";
import type { ControlRole } from "@/lib/control/roles";
import { median } from "@/lib/control/stats";
import { prisma } from "@/lib/prisma";

export const VERDICTS = ["PASS", "FAIL", "NEEDS_REVIEW"] as const;
type Verdict = (typeof VERDICTS)[number];

/** Below this many three-lens items the kappa is too noisy to print. */
export const MIN_KAPPA_ITEMS = 10;
export const KAPPA_TARGET = 0.6;
export const REVIEW_SECONDS_TARGET = 120;

export type LensPair = { a: ReviewLens; b: ReviewLens; agreed: number; total: number };

export type AgreementReport = {
  items: number;
  rawAgreement: number;
  fleissKappa: number | null;
  prevalence: Record<Verdict, number>;
  confusion: LensPair[];
  medianSeconds: number | null;
  medianSecondsByLens: Record<ReviewLens, number | null>;
  rubricVersions: string[];
};

export type Disagreement = {
  agentRunId: string;
  leadId: string;
  businessName: string;
  verdicts: Array<{ lens: ReviewLens; verdict: string; errorClass: string | null; severity: string | null; note: string | null }>;
  adjudicatedVerdict: string | null;
};

const PAIRS: Array<[ReviewLens, ReviewLens]> = [["TECHNICAL", "DOMAIN"], ["TECHNICAL", "SALES"], ["DOMAIN", "SALES"]];

/**
 * Fleiss kappa for a fixed number of raters per item. Each row maps category → raters who chose it.
 * Returns null when there is no item or chance agreement is total (kappa is undefined).
 */
export function fleissKappa(rows: Array<Record<string, number>>): number | null {
  if (rows.length === 0) return null;
  const raters = Object.values(rows[0]).reduce((sum, count) => sum + count, 0);
  if (raters < 2) return null;
  const usable = rows.filter((row) => Object.values(row).reduce((sum, count) => sum + count, 0) === raters);
  if (usable.length === 0) return null;
  const categories = [...new Set(usable.flatMap((row) => Object.keys(row)))];
  const N = usable.length;
  const pBar = usable.reduce((sum, row) => {
    const squares = Object.values(row).reduce((acc, count) => acc + count * count, 0);
    return sum + (squares - raters) / (raters * (raters - 1));
  }, 0) / N;
  const pE = categories.reduce((sum, category) => {
    const pj = usable.reduce((acc, row) => acc + (row[category] ?? 0), 0) / (N * raters);
    return sum + pj * pj;
  }, 0);
  if (1 - pE <= 1e-12) return null;
  return (pBar - pE) / (1 - pE);
}

type LensRow = {
  agentRunId: string | null;
  leadId: string | null;
  lens: ReviewLens | null;
  verdict: ReviewVerdict;
  errorClass: string | null;
  severity: string | null;
  note: string | null;
  createdAt: Date;
  reviewSeconds: number | null;
  rubricVersion: string;
};

type CompleteItem = { agentRunId: string; leadId: string | null; verdicts: LensRow[] };

async function loadLensRows(workspaceId: string, rubricVersion?: string): Promise<LensRow[]> {
  return prisma.humanReview.findMany({
    where: {
      workspaceId,
      source: "LENS",
      lens: { not: null },
      agentRunId: { not: null },
      ...(rubricVersion ? { rubricVersion } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      agentRunId: true,
      leadId: true,
      lens: true,
      verdict: true,
      errorClass: true,
      severity: true,
      note: true,
      createdAt: true,
      reviewSeconds: true,
      rubricVersion: true,
    },
  });
}

/** Latest verdict per lens; only runs where all three lenses have one. */
function completeItems(rows: LensRow[]): CompleteItem[] {
  const byRun = new Map<string, LensRow[]>();
  for (const row of rows) {
    if (!row.agentRunId || !row.lens) continue;
    const list = byRun.get(row.agentRunId) ?? [];
    list.push(row);
    byRun.set(row.agentRunId, list);
  }
  const items: CompleteItem[] = [];
  for (const [agentRunId, list] of byRun) {
    const current = currentLensReviews(list);
    if (current.length !== LENSES.length) continue;
    const ordered = LENSES.map((lens) => current.find((row) => row.lens === lens)!);
    items.push({ agentRunId, leadId: ordered.find((row) => row.leadId)?.leadId ?? null, verdicts: ordered });
  }
  return items;
}

export async function getAgreementReport(workspaceId: string, rubricVersion?: string): Promise<AgreementReport> {
  const rows = await loadLensRows(workspaceId, rubricVersion);
  const items = completeItems(rows);

  const counts = items.map((item) => {
    const row: Record<string, number> = {};
    for (const review of item.verdicts) row[review.verdict] = (row[review.verdict] ?? 0) + 1;
    return row;
  });
  const unanimous = counts.filter((row) => Object.keys(row).length === 1).length;
  const totalVerdicts = items.length * LENSES.length;
  const prevalence = Object.fromEntries(VERDICTS.map((verdict) => [
    verdict,
    totalVerdicts ? counts.reduce((sum, row) => sum + (row[verdict] ?? 0), 0) / totalVerdicts : 0,
  ])) as Record<Verdict, number>;

  const confusion = PAIRS.map(([a, b]) => ({
    a,
    b,
    total: items.length,
    agreed: items.filter((item) => item.verdicts.find((r) => r.lens === a)?.verdict === item.verdicts.find((r) => r.lens === b)?.verdict).length,
  }));

  const timed = rows.filter((row) => typeof row.reviewSeconds === "number") as Array<LensRow & { reviewSeconds: number }>;
  const medianSecondsByLens = Object.fromEntries(LENSES.map((lens) => [
    lens,
    median(timed.filter((row) => row.lens === lens).map((row) => row.reviewSeconds)),
  ])) as Record<ReviewLens, number | null>;

  const rubricVersions = [...new Set(items.flatMap((item) => item.verdicts.map((row) => row.rubricVersion)))].sort();

  return {
    items: items.length,
    rawAgreement: items.length ? unanimous / items.length : 0,
    fleissKappa: items.length < MIN_KAPPA_ITEMS ? null : fleissKappa(counts),
    prevalence,
    confusion,
    medianSeconds: median(timed.map((row) => row.reviewSeconds)),
    medianSecondsByLens,
    rubricVersions,
  };
}

/** Every rubric version that has at least one lens verdict, newest label last. */
export async function listRubricVersions(workspaceId: string): Promise<string[]> {
  const rows = await prisma.humanReview.findMany({
    where: { workspaceId, source: "LENS", lens: { not: null } },
    distinct: ["rubricVersion"],
    select: { rubricVersion: true },
  });
  return rows.map((row) => row.rubricVersion).sort();
}

const DISAGREEMENT_CAP = 100;

export async function listDisagreements(workspaceId: string, rubricVersion?: string): Promise<Disagreement[]> {
  const rows = await loadLensRows(workspaceId, rubricVersion);
  const split = completeItems(rows)
    .filter((item) => new Set(item.verdicts.map((row) => row.verdict)).size > 1)
    .slice(0, DISAGREEMENT_CAP);
  if (split.length === 0) return [];

  const runIds = split.map((item) => item.agentRunId);
  const leadIds = [...new Set(split.flatMap((item) => (item.leadId ? [item.leadId] : [])))];
  const [adjudications, leads] = await Promise.all([
    prisma.humanReview.findMany({
      where: { workspaceId, source: "ADJUDICATION", agentRunId: { in: runIds } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { agentRunId: true, verdict: true },
    }),
    leadIds.length
      ? prisma.lead.findMany({ where: { workspaceId, id: { in: leadIds } }, select: { id: true, businessName: true } })
      : [],
  ]);
  const latestAdjudication = new Map<string, string>();
  for (const row of adjudications) {
    if (row.agentRunId && !latestAdjudication.has(row.agentRunId)) latestAdjudication.set(row.agentRunId, row.verdict);
  }
  const names = new Map(leads.map((lead) => [lead.id, lead.businessName]));

  return split.map((item) => ({
    agentRunId: item.agentRunId,
    leadId: item.leadId ?? "",
    businessName: (item.leadId && names.get(item.leadId)) || "İsimsiz işletme",
    verdicts: item.verdicts.map((row) => ({
      lens: row.lens as ReviewLens,
      verdict: row.verdict,
      errorClass: row.errorClass,
      severity: row.severity,
      note: row.note,
    })),
    adjudicatedVerdict: latestAdjudication.get(item.agentRunId) ?? null,
  }));
}

export class AdjudicationConflictError extends Error {
  constructor(message = "Bu vakada üç merceğin hükmü tamamlanmadı.") {
    super(message);
  }
}

/**
 * Adds an adjudicated verdict next to the three lens verdicts. Original rows are never touched:
 * this only appends one HumanReview (lens null, source ADJUDICATION) and one audit event.
 */
export async function adjudicateRun(input: {
  workspaceId: string;
  agentRunId: string;
  verdict: Verdict;
  note: string;
  actorUserId: string;
  actorRole: ControlRole;
}): Promise<{ id: string }> {
  if (input.actorRole !== "ADMIN") throw new ForbiddenError("Uzlaştırma Yönetici işidir.");
  const note = input.note.trim();
  if (!note) throw new Error("note required");
  if (!VERDICTS.includes(input.verdict)) throw new Error("invalid verdict");

  const run = await prisma.agentRun.findFirst({
    where: { id: input.agentRunId, workspaceId: input.workspaceId, workerKind: "LEAD_INTELLIGENCE_BRIEF" },
    select: { id: true, leadId: true },
  });
  if (!run) throw new NotFoundError("Brief bu çalışma alanında bulunamadı.");

  const lensRows = await prisma.humanReview.findMany({
    where: { workspaceId: input.workspaceId, agentRunId: run.id, source: "LENS", lens: { not: null } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, lens: true, verdict: true, createdAt: true },
  });
  const current = currentLensReviews(lensRows);
  if (current.length !== LENSES.length) throw new AdjudicationConflictError();

  return prisma.$transaction(async (tx) => {
    const created = await tx.humanReview.create({
      data: {
        workspaceId: input.workspaceId,
        leadId: run.leadId,
        agentRunId: run.id,
        verdict: input.verdict,
        lens: null,
        source: "ADJUDICATION",
        rubricVersion: RUBRIC_VERSION,
        note,
        reviewerUserId: input.actorUserId,
      },
      select: { id: true },
    });
    await writeAdminAudit({
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      workspaceId: input.workspaceId,
      action: "review.adjudicate",
      targetType: run.leadId ? "Lead" : "AgentRun",
      targetId: run.leadId ?? run.id,
      reason: note,
      beforeJson: { verdicts: current.map((row) => ({ lens: row.lens, verdict: row.verdict, reviewId: row.id })) },
      afterJson: { verdict: input.verdict, reviewId: created.id, agentRunId: run.id },
      outcome: "SUCCEEDED",
    }, tx);
    return { id: created.id };
  });
}
