import { requireUser } from "@/lib/auth";
import { WorkspaceForm } from "@/components/app/workspace-form";

export default async function WorkspaceSettingsPage() {
  const session = await requireUser();
  return (
    <WorkspaceForm
      initial={{
        id: session.workspace.id,
        name: session.workspace.name,
        slug: session.workspace.slug,
        plan: session.workspace.plan,
      }}
      role={session.role}
    />
  );
}
