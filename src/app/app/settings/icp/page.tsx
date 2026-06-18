import { requireWorkspaceAdmin } from "@/lib/auth";
import { IcpForm } from "@/components/app/icp-form";

export default async function IcpSettingsPage() {
  await requireWorkspaceAdmin();
  return <IcpForm canEdit={true} />;
}
