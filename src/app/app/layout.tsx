import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { getOptionalUser } from "@/lib/auth";
import { getUsage } from "@/lib/quotas";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getOptionalUser();
  if (!session) redirect("/login");

  const usage = await getUsage(session.workspaceId).catch(() => null);

  return (
    <AppShell
      user={session.user}
      workspace={session.workspace}
      role={session.role}
      usage={
        usage
          ? {
              plan: usage.plan.id,
              planName: usage.plan.name,
              leadsUsed: usage.leadsUsed,
              leadsLimit: usage.plan.leadsPerCycle,
              aiUsed: usage.aiUsed,
              aiLimit: usage.plan.aiCreditsPerCycle,
            }
          : null
      }
    >
      {children}
    </AppShell>
  );
}
