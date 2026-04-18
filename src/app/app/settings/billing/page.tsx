import { requireUser } from "@/lib/auth";
import { getUsage } from "@/lib/quotas";
import { isBillingEnabled } from "@/lib/stripe";
import { BillingPanel } from "@/components/app/billing-panel";

export default async function BillingSettingsPage() {
  const session = await requireUser();
  const usage = await getUsage(session.workspaceId);
  return (
    <BillingPanel
      plan={session.workspace.plan}
      role={session.role}
      billingEnabled={isBillingEnabled()}
      usage={{
        leadsUsed: usage.leadsUsed,
        leadsLimit: usage.plan.leadsPerCycle,
        aiUsed: usage.aiUsed,
        aiLimit: usage.plan.aiCreditsPerCycle,
      }}
    />
  );
}
