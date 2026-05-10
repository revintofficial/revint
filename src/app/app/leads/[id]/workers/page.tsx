/**
 * Lead Detail v2 — Phase 6 dedicated Power Tools route.
 *
 * Goal: move the AI Workers panel off the lead detail page onto its
 * own deep-linkable URL so the v2 narrative stays uncluttered while
 * power users can still bookmark, share, and Slack-link the workers
 * grid.
 *
 * Hard rules:
 *   - `requireUser()` resolves `workspaceId` BEFORE the lead lookup.
 *   - Lead lookup is `findFirst({ id, workspaceId })` — cross-tenant
 *     leak is the highest-severity bug class on this project.
 *   - 404 (not 403) when the lead is missing or owned by a different
 *     workspace so we never disclose existence.
 *   - The `<AiWorkersPanel>` component is reused unchanged. Plan
 *     gating, quota enforcement, and run history all flow through
 *     the existing `/api/leads/[id]/workers` endpoint that the
 *     panel already polls.
 *
 * A11y: the breadcrumb uses `<nav aria-label="lead-secondary">` so
 * screen readers can distinguish the back-to-lead nav from the
 * primary app shell nav (per PLAN §6 a11y callout).
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AiWorkersPanel } from "@/components/app/ai-workers-panel";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadLeadDetailDictionary } from "@/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";

interface WorkersPageProps {
  params: Promise<{ id: string }>;
}

export default async function LeadWorkersPage({ params }: WorkersPageProps) {
  const [{ id }, session] = await Promise.all([params, requireUser()]);

  const lead = await prisma.lead.findFirst({
    where: { id, workspaceId: session.workspaceId },
    select: { id: true, businessName: true },
  });
  if (!lead) {
    notFound();
  }

  const dict = await loadLeadDetailDictionary(DEFAULT_LOCALE);
  const labels = dict.common.leadDetailV2.workersRoute;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 sm:px-6">
      <nav
        aria-label="lead-secondary"
        className="flex items-center gap-1.5 text-[12px]"
        style={{ color: "var(--leadac-text-3)" }}
      >
        <Link
          href={`/app/leads/${lead.id}`}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-(--leadac-500)"
          style={{ color: "var(--leadac-text-2)" }}
          aria-label={labels.backToLeadAriaTemplate.replace(
            "{business}",
            lead.businessName,
          )}
        >
          <ArrowLeft className="h-3 w-3" aria-hidden />
          <span>{lead.businessName}</span>
        </Link>
        <span aria-hidden>›</span>
        <span
          aria-current="page"
          style={{ color: "var(--leadac-text-1)" }}
        >
          {labels.crumb}
        </span>
      </nav>

      <header className="flex flex-col gap-1">
        <h1
          className="text-[20px] font-semibold tracking-tight"
          style={{ color: "var(--leadac-text-1)" }}
        >
          {labels.heading}
        </h1>
        <p
          className="text-[13px]"
          style={{ color: "var(--leadac-text-3)" }}
        >
          {labels.subheading}
        </p>
      </header>

      <AiWorkersPanel leadId={lead.id} />
    </div>
  );
}
