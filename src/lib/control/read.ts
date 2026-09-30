import { prisma } from "@/lib/prisma";

/** Control role must be checked before calling either read helper. */
export async function listControlWorkspaces() {
  return prisma.workspace.findMany({ select: { id: true, name: true, slug: true }, orderBy: { name: "asc" }, take: 100 });
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
