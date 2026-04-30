import { requireWorkspaceAdmin } from "@/lib/auth";
import { PackagesForm } from "@/components/app/packages-form";

export default async function PackagesSettingsPage() {
  await requireWorkspaceAdmin();
  return <PackagesForm canEdit={true} />;
}
