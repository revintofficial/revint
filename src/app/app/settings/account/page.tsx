import { requireUser } from "@/lib/auth";
import { AccountForm } from "@/components/app/account-form";

export default async function AccountSettingsPage() {
  const session = await requireUser();
  return <AccountForm initial={session.user} />;
}
