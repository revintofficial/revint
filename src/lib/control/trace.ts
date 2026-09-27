import { prisma } from "@/lib/prisma";

export type LeadTrace = {
  lead: { id: string; businessName: string };
  sessions: Array<{ id: string; status: string; goal: string; createdAt: string }>;
  runs: Array<{
    id: string;
    workerKind: string;
    status: string;
    plannerSessionId: string | null;
    costTokens: number;
    costUsdCents: number;
    errorMsg: string | null;
    startedAt: string | null;
    finishedAt: string | null;
  }>;
  crmSyncs: Array<{ id: string; status: string; objectType: string; lastError: string | null }>;
};

export async function getLeadTrace(workspaceId: string, leadId: string): Promise<LeadTrace | null> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, workspaceId },
    select: { id: true, businessName: true },
  });
  if (!lead) return null;

  const [sessions, runs, crmSyncs] = await Promise.all([
    prisma.plannerSession.findMany({
      where: { workspaceId, leadId },
      select: { id: true, status: true, goal: true, createdAt: true },
    }),
    prisma.agentRun.findMany({
      where: { workspaceId, leadId },
      select: {
        id: true,
        workerKind: true,
        status: true,
        plannerSessionId: true,
        costTokens: true,
        costUsdCents: true,
        errorMsg: true,
        startedAt: true,
        finishedAt: true,
      },
    }),
    prisma.crmSyncLog.findMany({
      where: { workspaceId, leadId },
      select: { id: true, status: true, objectType: true, lastError: true },
    }),
  ]);

  return {
    lead,
    sessions: sessions.map((session) => ({
      id: session.id,
      status: session.status,
      goal: session.goal,
      createdAt: session.createdAt.toISOString(),
    })),
    runs: runs.map((run) => ({
      id: run.id,
      workerKind: run.workerKind,
      status: run.status,
      plannerSessionId: run.plannerSessionId,
      costTokens: run.costTokens,
      costUsdCents: run.costUsdCents,
      errorMsg: run.errorMsg,
      startedAt: run.startedAt?.toISOString() ?? null,
      finishedAt: run.finishedAt?.toISOString() ?? null,
    })),
    crmSyncs: crmSyncs.map((sync) => ({
      id: sync.id,
      status: sync.status,
      objectType: sync.objectType,
      lastError: sync.lastError,
    })),
  };
}
