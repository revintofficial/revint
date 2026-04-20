import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { getUsage } from "@/lib/quotas";
import { isBillingEnabled } from "@/lib/stripe";
import { BillingPanel } from "@/components/app/billing-panel";

export default async function BillingSettingsPage() {
  const session = await requireUser();
  const usage = await getUsage(session.workspaceId);
  return (
    // BillingPanel uses `useSearchParams` (for ?plan, ?autocheckout, ?success)
    // so Next.js requires it to be inside a Suspense boundary at the route
    // level - otherwise the whole page bails out of static rendering with a
    // build-time warning.
    <Suspense
      fallback={
        <div className="space-y-3 animate-pulse">
          <div className="h-32 rounded-xl bg-white/5" />
          <div className="h-72 rounded-xl bg-white/5" />
        </div>
      }
    >
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
    </Suspense>
  );
}
