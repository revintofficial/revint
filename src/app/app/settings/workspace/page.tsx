import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { WorkspaceForm } from "@/components/app/workspace-form";

export default async function WorkspaceSettingsPage() {
  const session = await requireUser();
  const ws = await prisma.workspace.findUniqueOrThrow({
    where: { id: session.workspaceId },
    select: { id: true, name: true, slug: true, plan: true, country: true },
  });
  return (
    <WorkspaceForm
      initial={{
        id: ws.id,
        name: ws.name,
        slug: ws.slug,
        plan: ws.plan,
        country: ws.country,
      }}
      role={session.role}
    />
  );
}
