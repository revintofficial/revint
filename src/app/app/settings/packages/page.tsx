import { requireUser } from "@/lib/auth";
import { PackagesForm } from "@/components/app/packages-form";

export default async function PackagesSettingsPage() {
  const session = await requireUser();
  const canEdit = session.role === "OWNER" || session.role === "ADMIN";
  return <PackagesForm canEdit={canEdit} />;
}
