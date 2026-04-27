import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AppShell } from "@/components/app/app-shell";
import { getOptionalUser } from "@/lib/auth";
import { getUsage } from "@/lib/quotas";
import { prisma } from "@/lib/prisma";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getOptionalUser();
  if (!session) redirect("/login");

  // Redirect workspace owners who haven't completed onboarding to the wizard.
  // Skip if the workspace already has leads — that means it's an existing
  // workspace that pre-dates the onboarding flow; auto-mark it complete.
  //
  // We also exempt billing/auth-callback paths: paid-intent signups
  // (?plan=PRO_TEAM&autocheckout=1) land on /app/settings/billing before
  // they finish onboarding. Forcing them back into the wizard would
  // break the "pricing CTA → Stripe Checkout in one click" funnel.
  if (session.role === "OWNER" && !session.workspace.onboardingCompletedAt) {
    const headersList = await headers();
    const pathname = headersList.get("x-pathname") ?? "";
    const ONBOARDING_EXEMPT_PREFIXES = [
      "/app/onboarding",
      "/app/settings/billing",
      "/auth/callback",
    ];
    const isExempt = ONBOARDING_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p));
    if (!isExempt) {
      // Check if workspace has existing leads (pre-onboarding workspace).
      const leadCount = await prisma.lead.count({
        where: { workspaceId: session.workspaceId },
      });
      if (leadCount > 0) {
        // Silently mark complete so the gate doesn't fire again.
        await prisma.workspace.update({
          where: { id: session.workspaceId },
          data: { onboardingCompletedAt: new Date() },
        });
      } else {
        redirect("/app/onboarding");
      }
    }
  }

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
