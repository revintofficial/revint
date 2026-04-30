import { PageHeader } from "@/components/ui/page-header";
import { SettingsNav } from "@/components/app/settings-nav";
import { requireUser } from "@/lib/auth";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await requireUser();

  return (
    <div className="p-4 sm:p-6 md:p-8 lg:p-10 max-w-4xl mx-auto space-y-6">
      <PageHeader title="Settings" subtitle="Manage your account, workspace, and billing" />
      <SettingsNav role={session.role} />
      <div>{children}</div>
    </div>
  );
}
