import { prisma } from "@/lib/prisma";

/** Control role must be checked before calling either read helper. */
export async function listControlWorkspaces() {
  return prisma.workspace.findMany({ select: { id: true, name: true, slug: true }, orderBy: { name: "asc" }, take: 100 });
}

/**
 * Workspaces for the picker, with how many leads got a brief in the last
 * 14 days. The ones with something to look at come first, so nobody has to
 * know a workspace name before they can start.
 */
export async function listControlWorkspacesWithActivity(now = new Date()) {
  const since = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const [workspaces, briefs] = await Promise.all([
    listControlWorkspaces(),
    prisma.agentRun.findMany({
      where: { workerKind: "LEAD_INTELLIGENCE_BRIEF", status: "SUCCEEDED", leadId: { not: null }, finishedAt: { gte: since } },
      distinct: ["workspaceId", "leadId"],
      select: { workspaceId: true },
    }),
  ]);
  const counts = new Map<string, number>();
  for (const row of briefs) counts.set(row.workspaceId, (counts.get(row.workspaceId) ?? 0) + 1);
  return workspaces
    .map((workspace) => ({ ...workspace, recentBriefs: counts.get(workspace.id) ?? 0 }))
    .sort((a, b) => b.recentBriefs - a.recentBriefs || a.name.localeCompare(b.name, "tr"));
}

export async function getControlWorkspace(workspaceId: string) {
  return prisma.workspace.findFirst({
    where: { id: workspaceId },
    select: { id: true, name: true, slug: true },
  });
}

export async function loadUserLabels(userIds: string[]) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return new Map<string, string>();
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, fullName: true, email: true },
  });
  return new Map(users.map((user) => [user.id, user.fullName || user.email || "Bilinmeyen kişi"]));
}

export async function listControlTraceRuns(workspaceId: string) {
  return prisma.agentRun.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, leadId: true, workerKind: true, status: true, createdAt: true },
  });
}
