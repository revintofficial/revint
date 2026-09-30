import { prisma } from "@/lib/prisma";

import { toDecisionCard, type DecisionCard } from "@/lib/control/decision";
export { toDecisionCard, type DecisionCard } from "@/lib/control/decision";

export type TraceRun = {
  id: string;
  workerKind: string;
  status: string;
  costUsdCents: number;
  errorMsg: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  decision: DecisionCard;
  rawJson: string;
};

export type LeadTrace = {
  lead: { id: string; businessName: string };
  sessions: Array<{
    id: string;
    status: string;
    goal: string;
    createdAt: string;
    updatedAt: string;
    runs: TraceRun[];
  }>;
  unsessionedRuns: TraceRun[];
  crmSyncs: Array<{ id: string; status: string; objectType: string; lastError: string | null }>;
};

export type TraceLeadRow = {
  leadId: string;
  businessName: string;
  latestStatus: string;
  latestWorkerKind: string;
  latestAt: string;
  failedCount: number;
};

function toTraceRun(run: {
  id: string;
  workerKind: string;
  status: string;
  costUsdCents: number;
  errorMsg: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  outputJson: unknown;
}, locationCount: number): TraceRun {
  return {
    id: run.id,
    workerKind: run.workerKind,
    status: run.status,
    costUsdCents: run.costUsdCents,
    errorMsg: run.errorMsg,
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    decision: toDecisionCard(run.outputJson, { finishedAt: run.finishedAt?.toISOString(), locationCount }),
    rawJson: run.outputJson == null ? "" : JSON.stringify(run.outputJson),
  };
}

export async function getLeadTrace(workspaceId: string, leadId: string): Promise<LeadTrace | null> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, workspaceId },
    select: { id: true, businessName: true, accountId: true },
  });
  if (!lead) return null;

  const locationCount = lead.accountId ? await prisma.lead.count({ where: { workspaceId, accountId: lead.accountId } }) : 1;
  const [sessions, runs, crmSyncs] = await Promise.all([
    prisma.plannerSession.findMany({
      where: { workspaceId, leadId },
      orderBy: { createdAt: "asc" },
      select: { id: true, status: true, goal: true, createdAt: true, updatedAt: true },
    }),
    prisma.agentRun.findMany({
      where: { workspaceId, leadId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        workerKind: true,
        status: true,
        plannerSessionId: true,
        costUsdCents: true,
        errorMsg: true,
        startedAt: true,
        finishedAt: true,
        outputJson: true,
      },
    }),
    prisma.crmSyncLog.findMany({
      where: { workspaceId, leadId },
      orderBy: { createdAt: "asc" },
      select: { id: true, status: true, objectType: true, lastError: true },
    }),
  ]);

  const runsBySession = new Map<string, TraceRun[]>();
  const unsessionedRuns: TraceRun[] = [];
  const sessionIds = new Set(sessions.map((session) => session.id));
  for (const run of runs) {
    const mapped = toTraceRun(run, locationCount);
    if (run.plannerSessionId && sessionIds.has(run.plannerSessionId)) {
      const bucket = runsBySession.get(run.plannerSessionId) ?? [];
      bucket.push(mapped);
      runsBySession.set(run.plannerSessionId, bucket);
    } else {
      unsessionedRuns.push(mapped);
    }
  }

  return {
    lead,
    sessions: sessions.map((session) => ({
      id: session.id,
      status: session.status,
      goal: session.goal,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      runs: runsBySession.get(session.id) ?? [],
    })),
    unsessionedRuns,
    crmSyncs: crmSyncs.map((sync) => ({
      id: sync.id,
      status: sync.status,
      objectType: sync.objectType,
      lastError: sync.lastError,
    })),
  };
}

export async function listTraceLeads(
  workspaceId: string,
  filter: "all" | "failed" | "stuck",
  now = new Date(),
): Promise<TraceLeadRow[]> {
  const before30m = new Date(now.getTime() - 30 * 60 * 1000);
  let stuckLeadIds: string[] | null = null;
  if (filter === "stuck") {
    const sessions = await prisma.plannerSession.findMany({
      where: {
        workspaceId,
        leadId: { not: null },
        status: { in: ["PLANNING", "EXECUTING"] },
        updatedAt: { lt: before30m },
      },
      select: { leadId: true },
    });
    stuckLeadIds = [...new Set(sessions.map((session) => session.leadId).filter((id): id is string => Boolean(id)))];
    if (stuckLeadIds.length === 0) return [];
  }

  const runs = await prisma.agentRun.findMany({
    where: {
      workspaceId,
      leadId: stuckLeadIds ? { in: stuckLeadIds } : { not: null },
    },
    select: {
      leadId: true,
      status: true,
      workerKind: true,
      createdAt: true,
      finishedAt: true,
      lead: { select: { businessName: true } },
    },
  });

  const stuckSet = stuckLeadIds ? new Set(stuckLeadIds) : null;
  const byLead = new Map<string, TraceLeadRow & { at: number }>();
  for (const run of runs) {
    if (!run.leadId) continue;
    if (stuckSet && !stuckSet.has(run.leadId)) continue;
    const atDate = run.finishedAt ?? run.createdAt;
    const at = atDate.getTime();
    const existing = byLead.get(run.leadId);
    if (!existing) {
      byLead.set(run.leadId, {
        leadId: run.leadId,
        businessName: run.lead?.businessName ?? "",
        latestStatus: run.status,
        latestWorkerKind: run.workerKind,
        latestAt: atDate.toISOString(),
        failedCount: run.status === "FAILED" ? 1 : 0,
        at,
      });
      continue;
    }
    if (run.status === "FAILED") existing.failedCount += 1;
    if (at >= existing.at) {
      existing.at = at;
      existing.latestStatus = run.status;
      existing.latestWorkerKind = run.workerKind;
      existing.latestAt = atDate.toISOString();
      existing.businessName = run.lead?.businessName ?? existing.businessName;
    }
  }

  if (stuckLeadIds) {
    const missing = stuckLeadIds.filter((id) => !byLead.has(id));
    if (missing.length > 0) {
      const leads = await prisma.lead.findMany({
        where: { workspaceId, id: { in: missing } },
        select: { id: true, businessName: true },
      });
      for (const lead of leads) {
        byLead.set(lead.id, {
          leadId: lead.id,
          businessName: lead.businessName,
          latestStatus: "",
          latestWorkerKind: "",
          latestAt: "",
          failedCount: 0,
          at: 0,
        });
      }
    }
  }

  return [...byLead.values()]
    .filter((row) => filter !== "failed" || row.latestStatus === "FAILED")
    .sort((a, b) => b.at - a.at)
    .map(({ at: _at, ...row }) => row);
}
