import type { ReviewLens, ReviewSource, ReviewVerdict } from "@/generated/prisma/client";
import { writeAdminAudit } from "@/lib/control/audit";
import type { ControlRole } from "@/lib/control/roles";
import { ForbiddenError, NotFoundError } from "@/lib/auth";
import { resolveControlLens, roleAtLeast } from "@/lib/control/roles";
import { currentLensReviews, LENSES, LENS_LABELS, missingLenses } from "@/lib/control/lenses";
import { toDecisionCard } from "@/lib/control/decision";
import { ERROR_CLASSES, RUBRIC_VERSION, type ErrorClass } from "@/lib/control/rubric";
import { prisma } from "@/lib/prisma";

export { ERROR_CLASSES, type ErrorClass };
export type ReviewSeverity = "P0" | "P1" | "P2";

const SEVERITIES = new Set<ReviewSeverity>(["P0", "P1", "P2"]);
const FORTNIGHT_MS = 14 * 24 * 60 * 60 * 1000;
export const REVIEW_SECONDS_MIN = 1;
export const REVIEW_SECONDS_MAX = 1800;

export type ReviewQueueRow = {
 leadId: string; businessName: string; agentRunId: string; age: string;
 salesConfidence: number | null; primaryModule: string | null; missingLenses: ReviewLens[];
 /** errorClass of the newest SDR row when that row is a FAIL ("SDR kullanmadı"), else null. */
 sdrFlag: string | null;
};

type SdrRowLike = { source: ReviewSource | string; verdict: ReviewVerdict | string; errorClass: string | null; createdAt: Date | string };

/** The newest SDR row decides ("en yeni satır esastır"): a later "used" clears an earlier rejection. */
export function sdrFlagFor(rows: SdrRowLike[]): string | null {
 const latest = rows.filter(r => r.source === "SDR").sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
 return latest && latest.verdict === "FAIL" ? latest.errorClass ?? "UNSPECIFIED" : null;
}

/** A brief that stopped before deciding (e.g. `skipped: "head_agent_off"`) has nothing to review. */
export function isSkippedBrief(output: unknown): boolean {
 if (typeof output !== "object" || output === null) return false;
 const o = output as Record<string, unknown>;
 return Boolean(o.skipped) && typeof o.briefMode !== "string";
}

export async function listRecentBriefs(workspaceId: string, now = new Date()): Promise<ReviewQueueRow[]> {
 const found = await prisma.agentRun.findMany({
   where: { workspaceId, workerKind: "LEAD_INTELLIGENCE_BRIEF", status: "SUCCEEDED", leadId: { not: null }, finishedAt: { gte: new Date(now.getTime() - FORTNIGHT_MS) } },
   orderBy: [{ finishedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
   select: { id: true, leadId: true, outputJson: true, finishedAt: true, lead: { select: { businessName: true } } },
 });
 // Newest brief per lead that carries a decision; a skipped brief never hides an older real one.
 const seen = new Set<string>();
 const runs = found.filter(run => {
   if (!run.leadId || seen.has(run.leadId) || isSkippedBrief(run.outputJson)) return false;
   seen.add(run.leadId);
   return true;
 });
 if (!runs.length) return [];
 const reviews = await prisma.humanReview.findMany({
   where: { workspaceId, agentRunId: { in: runs.map(r => r.id) }, source: { in: ["LENS", "SDR"] } },
   orderBy: [{ createdAt: "desc" }, { id: "desc" }],
   select: { agentRunId: true, lens: true, source: true, verdict: true, errorClass: true, createdAt: true },
 });
 const rows = runs.flatMap(run => {
   if (!run.leadId) return [];
   const forRun = reviews.filter(r => r.agentRunId === run.id);
   const missing = missingLenses(forRun.filter(r => (r.source ?? "LENS") === "LENS"));
   const card = toDecisionCard(run.outputJson);
   return [{ leadId: run.leadId, agentRunId: run.id, businessName: run.lead?.businessName ?? "İsimsiz işletme", age: run.finishedAt!.toISOString(), salesConfidence: card.salesConfidence, primaryModule: card.primaryModule, missingLenses: missing, sdrFlag: sdrFlagFor(forRun) }];
 });
 // Triage: SDR rejections jump the queue; otherwise newest brief first (stable sort keeps DB order).
 return rows.map((row, index) => ({ row, index })).sort((a, b) => Number(b.row.sdrFlag != null) - Number(a.row.sdrFlag != null) || a.index - b.index).map(x => x.row);
}

export async function listLeadReviews(workspaceId: string, leadId: string, agentRunId?: string) {
  return prisma.humanReview.findMany({
    where: { workspaceId, leadId, ...(agentRunId ? { agentRunId } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],

    select: {
      id: true,
      lens: true,
      source: true,
      verdict: true,
      errorClass: true,
      severity: true,
      note: true,
      createdAt: true,
      agentRunId: true,
      rubricVersion: true,
      reviewSeconds: true,
    },
  });
}

export type ReviewViewRow = {
  id: string;
  lens: ReviewLens | null;
  source: ReviewSource;
  verdict: ReviewVerdict;
  errorClass: string | null;
  severity: string | null;
  note: string | null;
  createdAt: string;
  rubricVersion: string;
  reviewSeconds: number | null;
};

export type ReviewView = {
  agentRunId: string;
  /** The viewer's lens. null = observer without a lens (sees everything, cannot vote). */
  lens: ReviewLens | null;
  rubricVersion: string;
  /** The viewer's own current verdict for this run, if written. */
  ownReview: ReviewViewRow | null;
  /** true once the viewer's lens has a verdict (or the viewer has no lens). */
  revealed: boolean;
  /** Other lenses' current verdicts. Empty until `revealed`. */
  priorReviews: ReviewViewRow[];
  /** SDR rows for this run, newest first. Empty until `revealed`. */
  sdrReviews: ReviewViewRow[];
  /** Adjudication rows for this run, newest first. Empty until `revealed`. */
  adjudications: ReviewViewRow[];
  /** Other lenses that have not written a verdict yet (never the viewer's own lens). */
  missingLenses: ReviewLens[];
  /** Turkish names of `missingLenses`, e.g. ["Teknik", "Alan"]. */
  missingLensNames: string[];
};

/**
 * Independent review read. A lens sees no other verdict (lens, SDR or
 * adjudication) for this run until it has written its own, so the three
 * verdicts stay independent and Fleiss kappa is not inflated by anchoring.
 * Which lenses are still missing is always shown — that is not a verdict.
 */
export async function buildReviewView(input: { workspaceId: string; agentRunId: string; lens: ReviewLens | null }): Promise<ReviewView> {
  const rows = await prisma.humanReview.findMany({
    where: { workspaceId: input.workspaceId, agentRunId: input.agentRunId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, lens: true, source: true, verdict: true, errorClass: true, severity: true, note: true, createdAt: true, rubricVersion: true, reviewSeconds: true },
  });
  const view: ReviewViewRow[] = rows.map(r => ({ ...r, source: r.source ?? "LENS", createdAt: new Date(r.createdAt).toISOString(), rubricVersion: r.rubricVersion ?? "pre-2026-09-29", reviewSeconds: r.reviewSeconds ?? null }));
  const lensRows = view.filter(r => r.source === "LENS");
  const current = currentLensReviews(lensRows);
  const ownReview = input.lens ? current.find(r => r.lens === input.lens) ?? null : null;
  const revealed = input.lens == null || ownReview != null;
  const missing = missingLenses(lensRows).filter(l => l !== input.lens);
  return {
    agentRunId: input.agentRunId,
    lens: input.lens,
    rubricVersion: RUBRIC_VERSION,
    ownReview,
    revealed,
    priorReviews: revealed ? current.filter(r => r.lens !== input.lens) : [],
    sdrReviews: revealed ? view.filter(r => r.source === "SDR") : [],
    adjudications: revealed ? view.filter(r => r.source === "ADJUDICATION") : [],
    missingLenses: missing,
    missingLensNames: LENSES.filter(l => missing.includes(l)).map(l => LENS_LABELS[l]),
  };
}

export async function countReviewQueue(workspaceId: string, now = new Date()): Promise<number> {
  const rows = await listReviewQueue(workspaceId, now);
  return rows.length;
}

/** Accept 1–1800 seconds (rounded); anything else — missing, NaN, too short, left open — is stored as null. */
export function normalizeReviewSeconds(value: unknown): number | null {
  const n = typeof value === "string" && value.trim() ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  return rounded >= REVIEW_SECONDS_MIN && rounded <= REVIEW_SECONDS_MAX ? rounded : null;
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
  /** Seconds between opening the card and saving. Out of 1–1800 → null. */
  reviewSeconds?: number | null;
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
  const reviewSeconds = normalizeReviewSeconds(input.reviewSeconds);
  return prisma.$transaction(async tx => {
  const created = await tx.humanReview.create({
    data: {
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      agentRunId: input.agentRunId,
      verdict,
      lens,
      source: "LENS",
      rubricVersion: RUBRIC_VERSION,
      reviewSeconds,
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
    afterJson: { lens, verdict, reviewId: created.id, agentRunId: input.agentRunId, rubricVersion: RUBRIC_VERSION, reviewSeconds },
    outcome: "SUCCEEDED",
  }, tx);

  return { id: created.id };
  });
}

export async function listReviewQueue(workspaceId: string, now = new Date()) { return (await listRecentBriefs(workspaceId, now)).filter(row => row.missingLenses.length > 0); }
