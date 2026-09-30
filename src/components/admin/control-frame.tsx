import { ControlIntro } from "@/components/admin/control-intro";
import { ControlStrip, WorkspacePicker, type WorkspaceOption } from "@/components/admin/control-workspace";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth";
import { getControlWorkspace, listControlWorkspaces } from "@/lib/control/read";
import { requireControlRole } from "@/lib/control/roles";

export async function ControlFrame({
  workspaceId,
  children,
}: {
  workspaceId?: string;
  children: React.ReactNode;
}) {
  let actor;
  try {
    actor = await requireControlRole("VIEWER");
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) return null;
    throw error;
  }
  const workspaces = await listControlWorkspaces();
  if (!workspaceId) return <><ControlIntro /><WorkspacePicker workspaces={workspaces} /></>;

  const known = workspaces.find((workspace) => workspace.id === workspaceId);
  const workspace: WorkspaceOption | null = known ?? await getControlWorkspace(workspaceId);
  if (!workspace) {
    return (
      <section className="space-y-4">
        <p className="text-sm text-[var(--revint-text-2)]">Bu çalışma alanı bulunamadı.</p>
        <WorkspacePicker workspaces={workspaces} />
      </section>
    );
  }

  return (
    <>
      <ControlStrip workspace={workspace} role={actor.role} email={actor.email} workspaces={workspaces} />
      <ControlIntro />
      {children}
    </>
  );
}
