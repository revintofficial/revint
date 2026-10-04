import type { AgentWorkerKind } from "@/generated/prisma/client";
import { toDecisionCard } from "@/lib/control/decision";
import { buildShelf, shelfAuditFromRow, type DrawerKey, type ShelfRow, type ShelfRun } from "@/lib/control/evidence-shelf";
import { rerunLeadWorker } from "@/lib/control/rerun";
import type { ControlRole } from "@/lib/control/roles";
import { TRACE_GROUPS } from "@/lib/control/trace-groups";
import { compareFacts, isStoppedOutput, plainError, runFacts, type ComparedFact } from "@/lib/control/trial-facts";
import { prisma } from "@/lib/prisma";

/**
 * Worker trial ("Deneme"): run one chain worker again on a handful of leads
 * and read what it found, without opening the database. Each lead shows the
 * newest run as plain facts, marks the ones that differ from the previous
 * successful run, and keeps the stored record (the evidence-shelf drawer)
 * one click away.
 */

export const TRIAL_MAX_LEADS = 10;
const LEAD_LIST_LIMIT = 60;

/** The workers a trial may run: the four steps of the automatic chain. */
export const TRIAL_KINDS: AgentWorkerKind[] = TRACE_GROUPS.flatMap((group) => group.kinds);

export function isTrialKind(value: string): value is AgentWorkerKind {
  return (TRIAL_KINDS as string[]).includes(value);
}

const DRAWER_OF: Record<string, DrawerKey> = {
  APIFY_GMAPS_DEEP: "map",
  WEBSITE_AUDITOR: "site",
  REVIEW_ANALYST: "reviews",
  LEAD_INTELLIGENCE_BRIEF: "decision",
};

type RunLite = { id: string; status: string; createdAt: string; startedAt: string | null; finishedAt: string | null; costUsdCents: number };

export type TrialOutcome = "never" | "running" | "failed" | "stopped" | "done";

export type TrialRow = {
  leadId: string;
  businessName: string;
  websiteUrl: string | null;
  /** Newest run of this worker for the lead, any status. null = the worker never ran here. */
  latest: RunLite | null;
  outcome: TrialOutcome;
  /** One plain sentence about the outcome: the error, the wait, or how it compares with the previous run. */
  summary: string;
  /** What the newest finished run found. Empty while running, after a failure, or when it never ran. */
  facts: ComparedFact[];
  /** How many facts differ from the previous successful run; null when there is no previous run to compare. */
  changed: number | null;
  previousFinishedAt: string | null;
  /** What the system holds for this lead at this step right now: claim on the left, its source on the right. */
  record: ShelfRow[];
};

const OK = new Set(["SUCCEEDED", "SUCCEEDED_NO_MEMORY"]);

export async function listTrialRows(workspaceId: string, kind: AgentWorkerKind): Promise<TrialRow[]> {
  const leads = await prisma.lead.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: LEAD_LIST_LIMIT,
    select: { id: true, businessName: true, websiteUrl: true, googleMapsUri: true, formattedAddress: true, rating: true, reviewCount: true, accountId: true },
  });
  if (leads.length === 0) return [];
  const leadIds = leads.map((lead) => lead.id);
  const accountIds = [...new Set(leads.map((lead) => lead.accountId).filter((id): id is string => Boolean(id)))];

  const [runs, audits, analyses, locations] = await Promise.all([
    prisma.agentRun.findMany({
      where: { workspaceId, workerKind: { in: TRIAL_KINDS }, leadId: { in: leadIds } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 2000,
      select: { id: true, leadId: true, workerKind: true, status: true, createdAt: true, startedAt: true, finishedAt: true, costUsdCents: true, errorMsg: true, outputJson: true },
    }),
    prisma.websiteAudit.findMany({
      where: { leadId: { in: leadIds }, lead: { workspaceId } },
      select: { leadId: true, url: true, reachable: true, crawlError: true, crawlAttemptedAt: true, hasBookingSystem: true, bookingProvider: true, rawFeaturesJson: true },
    }),
    prisma.reviewAnalysis.findMany({
      where: { leadId: { in: leadIds }, lead: { workspaceId } },
      select: { leadId: true, reviewsAnalyzedCount: true, analyzedAt: true, weaknessKpis: true, painPhrases: true, strengthPhrases: true },
    }),
    accountIds.length
      ? prisma.lead.groupBy({ by: ["accountId"], where: { workspaceId, accountId: { in: accountIds } }, _count: { _all: true } })
      : Promise.resolve([]),
  ]);

  const byLead = new Map<string, typeof runs>();
  for (const run of runs) {
    if (!run.leadId) continue;
    const bucket = byLead.get(run.leadId) ?? [];
    bucket.push(run);
    byLead.set(run.leadId, bucket);
  }
  const auditOf = new Map(audits.map((row) => [row.leadId, row]));
  const analysisOf = new Map(analyses.map((row) => [row.leadId, row]));
  const locationsOf = new Map(locations.map((row) => [row.accountId, row._count._all]));

  const rows = leads.map((lead): TrialRow => {
    const all = byLead.get(lead.id) ?? [];
    const mine = all.filter((run) => run.workerKind === kind);
    const newest = mine[0] ?? null;

    // The stored record: the same drawer the review card shows for this step.
    const locationCount = lead.accountId ? locationsOf.get(lead.accountId) ?? 1 : 1;
    const brief = all.find((run) => run.workerKind === "LEAD_INTELLIGENCE_BRIEF" && OK.has(run.status));
    const analysis = analysisOf.get(lead.id);
    const shelfRuns: ShelfRun[] = all.map((run) => ({ workerKind: run.workerKind, status: run.status, finishedAt: run.finishedAt?.toISOString() ?? null, output: run.outputJson, errorMsg: run.errorMsg }));
    const drawer = buildShelf({
      runs: shelfRuns,
      card: toDecisionCard(brief?.outputJson ?? null, { finishedAt: brief?.finishedAt?.toISOString() ?? null, locationCount }),
      lead: { websiteUrl: lead.websiteUrl, googleMapsUri: lead.googleMapsUri, address: lead.formattedAddress || null, rating: lead.rating, reviewCount: lead.reviewCount },
      locationCount,
      audit: shelfAuditFromRow(auditOf.get(lead.id) ?? null),
      reviewAnalysis: analysis ? { ...analysis, analyzedAt: analysis.analyzedAt.toISOString() } : null,
    }).find((item) => item.key === DRAWER_OF[kind]);
    const record = drawer && !drawer.empty ? drawer.rows : [];

    const base = { leadId: lead.id, businessName: lead.businessName, websiteUrl: lead.websiteUrl, record };
    if (!newest) return { ...base, latest: null, outcome: "never", summary: "Bu adım bu işletmede hiç çalışmadı.", facts: [], changed: null, previousFinishedAt: null };
    const latest: RunLite = {
      id: newest.id,
      status: newest.status,
      createdAt: newest.createdAt.toISOString(),
      startedAt: newest.startedAt?.toISOString() ?? null,
      finishedAt: newest.finishedAt?.toISOString() ?? null,
      costUsdCents: newest.costUsdCents,
    };
    if (newest.status === "PENDING" || newest.status === "RUNNING") {
      return { ...base, latest, outcome: "running", summary: "Çalışıyor. Bitince bulduğu bilgiler burada görünür.", facts: [], changed: null, previousFinishedAt: null };
    }
    if (!OK.has(newest.status)) {
      return { ...base, latest, outcome: "failed", summary: `Koşu düştü. ${plainError(newest.errorMsg)}`, facts: [], changed: null, previousFinishedAt: null };
    }
    const previous = mine.slice(1).find((run) => OK.has(run.status)) ?? null;
    const stopped = isStoppedOutput(newest.outputJson);
    const outcome: TrialOutcome = stopped ? "stopped" : "done";
    const previousFinishedAt = previous?.finishedAt?.toISOString() ?? null;
    // One run stopped and the other worked: the fact lists do not line up, so say that in a sentence instead of marking every fact.
    if (previous && isStoppedOutput(previous.outputJson) !== stopped) {
      return {
        ...base,
        latest,
        outcome,
        summary: stopped
          ? "Önceki koşu sonuç üretmişti; bu koşu çalışmadan durdu. Sebebi aşağıda."
          : "Önceki koşu çalışmadan durmuştu; bu koşu sonuç üretti.",
        facts: compareFacts(null, runFacts(kind, newest.outputJson)),
        changed: 1,
        previousFinishedAt,
      };
    }
    const facts = compareFacts(previous ? runFacts(kind, previous.outputJson) : null, runFacts(kind, newest.outputJson));
    const changed = previous ? facts.filter((fact) => fact.before !== null).length : null;
    const summary = changed === null
      ? "Bu işletmedeki ilk başarılı koşu; karşılaştırılacak önceki sonuç yok."
      : changed === 0
        ? "Önceki koşuyla aynı sonuç; hiçbir bilgi değişmedi."
        : `Önceki koşuya göre ${changed} bilgi değişti. Değişenler işaretli.`;
    return { ...base, latest, outcome, summary, facts, changed, previousFinishedAt };
  });

  // Leads with a recent run first, so the trial just started stays on top.
  return rows.sort((x, y) => (y.latest?.createdAt ?? "").localeCompare(x.latest?.createdAt ?? ""));
}

export type TrialStart = { started: string[]; notQueued: string[]; rejected: Array<{ leadId: string; error: string }> };

/** Queue one new run per lead. Old results stay; every run is audited by `rerunLeadWorker`. */
export async function startWorkerTrial(input: {
  actorUserId: string;
  actorRole: ControlRole;
  workspaceId: string;
  workerKind: AgentWorkerKind;
  leadIds: string[];
  reason: string;
}): Promise<TrialStart> {
  const result: TrialStart = { started: [], notQueued: [], rejected: [] };
  for (const leadId of [...new Set(input.leadIds)].slice(0, TRIAL_MAX_LEADS)) {
    const run = await rerunLeadWorker({
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      workspaceId: input.workspaceId,
      leadId,
      workerKind: input.workerKind,
      reason: input.reason,
    });
    if (!run.ok) result.rejected.push({ leadId, error: run.error });
    else if (run.enqueued) result.started.push(leadId);
    else result.notQueued.push(leadId);
  }
  return result;
}
