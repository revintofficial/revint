import { requireWorkspaceAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBranding, planAllowsWhiteLabel } from "@/lib/branding";
import { BrandingForm } from "@/components/app/branding-form";

export default async function BrandingSettingsPage() {
  const session = await requireWorkspaceAdmin();
  const ws = await prisma.workspace.findUnique({
    where: { id: session.workspaceId },
    select: { plan: true, branding: true, publicProfilesEnabled: true, name: true },
  });

  const plan = ws?.plan ?? session.workspace.plan;
  const branding = parseBranding(ws?.branding);

  return (
    <BrandingForm
      plan={plan}
      planAllowsWhiteLabel={planAllowsWhiteLabel(plan)}
      initialBranding={branding}
      publicProfilesEnabled={ws?.publicProfilesEnabled ?? false}
      workspaceName={ws?.name ?? "Workspace"}
      role={session.role}
    />
  );
}
