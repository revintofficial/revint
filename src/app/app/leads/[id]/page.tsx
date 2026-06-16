/**
 * Lead Detail route.
 *
 * FineDine v1 update — the Lead Detail v2 / decision-surface experiment
 * has been removed. Everyone lands on the v1 (legacy) 5-tab surface,
 * which carries the call-first Action Sheet at the top (`LeadActionSheet`).
 *
 * `requireUser()` still resolves `workspaceId` before render for
 * multi-tenant safety.
 */
import LegacyLeadDetailClient from "@/components/app/leads/LegacyLeadDetailClient";
import { requireUser } from "@/lib/auth";

interface LeadDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function LeadDetailPage({ params }: LeadDetailPageProps) {
  const [{ id }] = await Promise.all([params, requireUser()]);
  return <LegacyLeadDetailClient id={id} />;
}
