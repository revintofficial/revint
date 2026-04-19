import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { SettingsNav } from "@/components/app/settings-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-4 sm:p-6 md:p-8 lg:p-10 max-w-4xl mx-auto space-y-6">
      <PageHeader title="Settings" subtitle="Manage your account, workspace, and billing" />
      <SettingsNav />
      <div>{children}</div>
    </div>
  );
}
