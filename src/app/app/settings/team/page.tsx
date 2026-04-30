import { requireWorkspaceAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TeamPanel } from "@/components/app/team-panel";

export default async function TeamSettingsPage() {
  const session = await requireWorkspaceAdmin();
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId: session.workspaceId },
    include: { user: true },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });
  return (
    <TeamPanel
      role={session.role}
      currentUserId={session.user.id}
      members={members.map((m) => ({
        id: m.id,
        userId: m.userId,
        email: m.user.email,
        fullName: m.user.fullName,
        avatarUrl: m.user.avatarUrl,
        role: m.role,
      }))}
    />
  );
}
